import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { resolveMcpIdentity } from '@/lib/mcp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness and auth probe for the MCP server — deliberately unauthenticated.
 *
 * When a client says "couldn't reach the server" it never says why, and the
 * MCP endpoint itself can't help: it answers every unauthenticated request
 * with the same 401 whether the problem is a missing token, a wrong one, or
 * a database that never got its tables. This URL separates those. Open it in
 * a browser to see whether the server is alive at all; send the same
 * Authorization header the client sends to see whether that token is one the
 * portal recognises.
 *
 * It reveals nothing a caller couldn't already learn by trying the MCP
 * endpoint: whether the server is up, and whether a credential they already
 * hold is valid. It never echoes the credential back.
 */

const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const scheme = authHeader ? authHeader.trim().split(/\s+/)[0].toLowerCase() : null;

  const payload: Record<string, unknown> = {
    ok: true,
    server: 'mna-portal',
    endpoint: '/api/mcp',
    transport: 'streamable-http',
    protocolVersions: SUPPORTED_PROTOCOLS,
    auth: {
      // The portal issues static bearer tokens rather than running OAuth, so
      // there is no /.well-known/oauth-* metadata to discover. A client that
      // probes for it gets a 404, which is the correct "no OAuth here".
      type: 'bearer',
      oauth: false,
      headerPresent: !!authHeader,
      scheme: scheme,
      // Filled in below when a header was actually sent.
      recognized: null as boolean | null,
    },
  };

  try {
    await ensureSchema();
    const { rows } = await query<{ n: number }>(
      `select count(*)::int as n from mcp_tokens where revoked_at is null`,
    );
    // The single most common reason a correctly configured client can't get
    // in: nobody has minted a token yet.
    payload.activeTokens = rows[0]?.n ?? 0;
  } catch (err: any) {
    payload.ok = false;
    payload.database = 'unreachable';
    console.error('[mcp/health] database check failed:', err?.message || err);
  }

  if (authHeader) {
    try {
      const identity = await resolveMcpIdentity(authHeader);
      (payload.auth as Record<string, unknown>).recognized = !!identity;
      if (identity) {
        (payload.auth as Record<string, unknown>).actsAs = identity.email;
        (payload.auth as Record<string, unknown>).scopes = identity.scopes;
      }
    } catch (err: any) {
      (payload.auth as Record<string, unknown>).recognized = false;
      console.error('[mcp/health] token lookup failed:', err?.message || err);
    }
  }

  const res = NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
