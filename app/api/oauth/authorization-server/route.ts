import { NextRequest, NextResponse } from 'next/server';
import { authorizationServerMetadata } from '@/lib/mcp/oauth';
import { publicOrigin } from '@/lib/mcp/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * RFC 8414 authorization server metadata. The portal is its own
 * authorization server, so this describes endpoints on this same host.
 */
function payload(request: NextRequest) {
  const res = NextResponse.json(authorizationServerMetadata(publicOrigin(request)));
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
