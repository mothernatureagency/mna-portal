import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { isOwner, getStaffByEmail } from '@/lib/staff';
import { defaultScopesForRole, type McpIdentity } from '@/lib/mcp/auth';
import { toolsFor, findTool, ToolError } from '@/lib/mcp/tools';

/**
 * In-process bridge between the MCP tool registry and the portal's own agents.
 *
 * The registry in lib/mcp/tools.ts is just data plus handlers — being an "MCP
 * server" is what app/api/mcp/route.ts does with it over the wire. Code running
 * inside the portal shares the process and the database with those handlers, so
 * it calls them directly rather than round-tripping out to Anthropic's servers
 * and back into our own Vercel function. Same tools, no network hop.
 *
 * The result: a tool added to the registry appears in Jarvis, in Claude Code
 * and in every future agent at once, defined once.
 */

/**
 * Who a logged-in portal user is, as far as the tools are concerned.
 *
 * Identity comes from the session cookie, never from the request body: the
 * tools act on the caller's own schedule and memories, so letting a caller name
 * themselves would let anyone read anyone's.
 */
export async function identityForSession(): Promise<McpIdentity | null> {
  let email = '';
  let portalRole = '';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    email = (user.email || '').toLowerCase();
    portalRole = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  } catch {
    return null;
  }
  if (!email) return null;

  // Client, contractor, student and creator accounts are portal users but not
  // agency staff — the task board, campaign pipeline and content calendar are
  // not theirs to read. Only staff-side roles get a tool identity at all.
  if (['client', 'contractor', 'student', 'creator'].includes(portalRole)) return null;

  const role = isOwner(email) ? 'owner' : 'staff';
  return {
    tokenId: 'session',
    tokenName: 'portal session',
    email,
    name: getStaffByEmail(email)?.name || email,
    role,
    scopes: defaultScopesForRole(role),
    clientIds: null,
  };
}

/** The registry, in the shape the Messages API wants for `tools`. */
export function anthropicToolsFor(identity: McpIdentity): Anthropic.Tool[] {
  return toolsFor(identity).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }));
}

/**
 * Run one tool and return the JSON string to hand back as a `tool_result`.
 *
 * Never throws: a failure the model can act on (bad id, unknown teammate) comes
 * back as `{ error }` so it can correct itself and try again, which is what the
 * agent loop expects. Anything unexpected is logged rather than described.
 */
export async function runLocalTool(name: string, input: unknown, identity: McpIdentity): Promise<string> {
  const tool = findTool(name);
  if (!tool || !identity.scopes.includes(tool.scope)) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  const args = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  try {
    return JSON.stringify(await tool.handler(args, identity));
  } catch (err) {
    if (err instanceof ToolError) return JSON.stringify({ error: err.message });
    console.error(`[mcp/local] ${name} failed for ${identity.email}:`, err);
    return JSON.stringify({ error: 'That tool failed unexpectedly. The error has been logged.' });
  }
}
