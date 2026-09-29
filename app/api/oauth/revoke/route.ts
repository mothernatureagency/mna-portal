import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { revokeToken } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Token revocation (RFC 7009). Always answers 200, revoked or not: telling a
 * caller whether a token existed would turn this into a way to test guesses.
 */
export async function POST(request: NextRequest) {
  await ensureSchema();

  let token = '';
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    token = String((body as any)?.token || '');
  } else {
    const form = await request.formData().catch(() => null);
    token = String(form?.get('token') || '');
  }

  if (token) await revokeToken(token).catch(() => {});

  const res = new NextResponse(null, { status: 200 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return res;
}
