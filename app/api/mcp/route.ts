import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { resolveMcpIdentity, type McpIdentity } from '@/lib/mcp/auth';
import { toolsFor, findTool, ToolError } from '@/lib/mcp/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * MCP server — the portal's tool surface for Claude.
 *
 * Speaks MCP over Streamable HTTP: JSON-RPC 2.0 in a POST body, a single JSON
 * response back. Deliberately STATELESS (no session id, no server-initiated
 * SSE stream) because Vercel functions don't survive between invocations —
 * a session-based transport would drop connections at random.
 *
 * Auth is a bearer token from the mcp_tokens table (see lib/mcp/auth.ts), not
 * the portal's session cookie, so this path is listed as public in
 * middleware.ts and does its own check on every request.
 *
 * One server, many clients: the same URL serves Claude Code / Claude Desktop
 * and our own in-portal agents (via the Messages API MCP connector), so a tool
 * added here is available everywhere at once.
 */

const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL = SUPPORTED_PROTOCOLS[0];

const SERVER_INFO = { name: 'mna-portal', title: 'Mother Nature Agency Portal', version: '0.1.0' };

const INSTRUCTIONS = [
  "Tools for Mother Nature Agency's internal portal: the team task board, the staff roster and the client list.",
  'Task ids and client ids are opaque strings — get them from list_tasks and list_clients rather than guessing.',
  "For a status check ('what's late', 'what needs attention'), prefer whats_blocked over several list_tasks calls.",
  'Results are already scoped to what the calling token may see; an empty list means nothing matched, not that access was denied.',
].join(' ');

// ── JSON-RPC plumbing ─────────────────────────────────────────────────

type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method?: unknown; params?: unknown };
type RpcResponse = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function ok(id: string | number | null, result: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, result };
}
function fail(id: string | number | null, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Accept',
  'Access-Control-Max-Age': '86400',
};

function withHeaders(res: NextResponse, protocol: string): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  res.headers.set('MCP-Protocol-Version', protocol);
  return res;
}

/** Text content block — every tool result is returned as pretty-printed JSON. */
function textContent(value: unknown) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }];
}

// ── Method dispatch ───────────────────────────────────────────────────

async function dispatch(req: RpcRequest, identity: McpIdentity, protocol: string): Promise<RpcResponse | null> {
  const id = req.id === undefined ? null : req.id;
  const isNotification = req.id === undefined;
  const method = typeof req.method === 'string' ? req.method : '';

  // Notifications get no response at all, whatever they say.
  if (isNotification) return null;

  switch (method) {
    case 'initialize': {
      const asked = (req.params as any)?.protocolVersion;
      const negotiated = typeof asked === 'string' && SUPPORTED_PROTOCOLS.includes(asked) ? asked : LATEST_PROTOCOL;
      return ok(id, {
        protocolVersion: negotiated,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      return ok(id, {
        tools: toolsFor(identity).map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case 'tools/call': {
      const params = (req.params || {}) as { name?: unknown; arguments?: unknown };
      const name = typeof params.name === 'string' ? params.name : '';
      if (!name) return fail(id, INVALID_PARAMS, 'tools/call requires a tool name');

      const tool = findTool(name);
      // A tool the token can't reach is reported as unknown, the same as one
      // that doesn't exist — tools/list already told the caller what it has,
      // and naming the others just invites retries against a closed door.
      if (!tool || !identity.scopes.includes(tool.scope)) {
        return fail(id, METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }

      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, any>;
      try {
        const result = await tool.handler(args, identity);
        return ok(id, { content: textContent(result) });
      } catch (err) {
        // A ToolError is the model's to fix (bad id, ambiguous name), so it
        // comes back as a tool result it can read and retry from. Anything
        // else is ours, and is logged rather than described to the caller.
        if (err instanceof ToolError) {
          return ok(id, { content: textContent(err.message), isError: true });
        }
        console.error(`[mcp] ${name} failed for ${identity.email}:`, err);
        return ok(id, { content: textContent('That tool failed unexpectedly. The error has been logged.'), isError: true });
      }
    }

    // Declared-capability-free methods: answer politely rather than erroring,
    // so a client that probes them doesn't treat the server as broken.
    case 'resources/list':
      return ok(id, { resources: [] });
    case 'prompts/list':
      return ok(id, { prompts: [] });

    default:
      return fail(id, METHOD_NOT_FOUND, `Unknown method: ${method || '(none)'}`);
  }
}

// ── HTTP surface ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const protocol = request.headers.get('mcp-protocol-version') || LATEST_PROTOCOL;

  const identity = await resolveMcpIdentity(request.headers.get('authorization')).catch((err) => {
    console.error('[mcp] identity lookup failed:', err);
    return null;
  });
  if (!identity) {
    const res = NextResponse.json(fail(null, INVALID_REQUEST, 'Unauthorized'), { status: 401 });
    res.headers.set('WWW-Authenticate', 'Bearer realm="mna-portal-mcp"');
    return withHeaders(res, protocol);
  }
  if (identity.scopes.length === 0) {
    return withHeaders(NextResponse.json(fail(null, INVALID_REQUEST, 'This token has no scopes.'), { status: 403 }), protocol);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withHeaders(NextResponse.json(fail(null, PARSE_ERROR, 'Invalid JSON'), { status: 400 }), protocol);
  }

  await ensureSchema();

  const batch = Array.isArray(body) ? body : [body];
  if (batch.length === 0) {
    return withHeaders(NextResponse.json(fail(null, INVALID_REQUEST, 'Empty batch'), { status: 400 }), protocol);
  }

  const responses: RpcResponse[] = [];
  for (const entry of batch) {
    if (!entry || typeof entry !== 'object') {
      responses.push(fail(null, INVALID_REQUEST, 'Each message must be a JSON-RPC object'));
      continue;
    }
    const rpc = entry as RpcRequest;
    try {
      const res = await dispatch(rpc, identity, protocol);
      if (res) responses.push(res);
    } catch (err) {
      console.error('[mcp] dispatch failed:', err);
      responses.push(fail(rpc.id ?? null, INTERNAL_ERROR, 'Internal error'));
    }
  }

  // Every message was a notification — acknowledge with no body, per spec.
  if (responses.length === 0) return withHeaders(new NextResponse(null, { status: 202 }), protocol);

  const payload = Array.isArray(body) ? responses : responses[0];
  return withHeaders(NextResponse.json(payload), protocol);
}

/**
 * This server never pushes to the client, so it offers no SSE stream and no
 * session to delete. The spec's prescribed answer for both is 405.
 */
export async function GET() {
  return withHeaders(
    NextResponse.json({ error: 'This MCP endpoint is stateless — POST JSON-RPC messages instead.' }, { status: 405 }),
    LATEST_PROTOCOL,
  );
}

export async function DELETE() {
  return withHeaders(NextResponse.json({ error: 'No sessions to terminate.' }, { status: 405 }), LATEST_PROTOCOL);
}

export async function OPTIONS() {
  return withHeaders(new NextResponse(null, { status: 204 }), LATEST_PROTOCOL);
}
