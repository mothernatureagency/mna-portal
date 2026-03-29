import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'mna_portal_auth';

function isPublic(pathname: string) {
  return (
    pathname.startsWith('/lock') ||
    pathname.startsWith('/api/lock') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  );
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // If AUTH_PASS isn't set, don't lock you out.
  if (!process.env.AUTH_PASS) return res;

  const pathname = req.nextUrl.pathname;
  if (isPublic(pathname)) return res;

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) return res;

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = '/lock';
  redirectUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
