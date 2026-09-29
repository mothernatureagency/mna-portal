import { NextRequest, NextResponse } from 'next/server';
import { protectedResourceMetadata } from '@/lib/mcp/oauth';
import { publicOrigin } from '@/lib/mcp/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * RFC 9728 protected resource metadata, served at
 * /.well-known/oauth-protected-resource (and with the resource's path
 * appended) via the rewrites in next.config.js.
 *
 * This is the first thing an MCP client reads after a 401: it says which
 * authorization server can issue tokens for /api/mcp.
 */
function payload(request: NextRequest) {
  const res = NextResponse.json(protectedResourceMetadata(publicOrigin(request)));
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version');
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
}

export async function GET(request: NextRequest) {
  return payload(request);
}

export async function OPTIONS(request: NextRequest) {
  return payload(request);
}
