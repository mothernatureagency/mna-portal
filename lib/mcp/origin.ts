import type { NextRequest } from 'next/server';

/**
 * The public origin this request arrived on.
 *
 * Everything OAuth advertises — the issuer, the endpoints, the resource the
 * token is bound to — has to match the host the client actually used, or the
 * client rejects the metadata. Hard-coding production would make every
 * preview deploy hand out URLs pointing somewhere else, so it is read from
 * the proxy headers Vercel sets.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return request.nextUrl.origin.replace(/\/$/, '');
  const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`.replace(/\/$/, '');
}
