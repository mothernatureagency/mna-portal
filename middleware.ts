import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'mna_portal_auth';

function isPublic(pathname: string) {
  return (
    pathname.startsWith('/lock') ||
    pathname.startsWith('/api/lock') ||
    pathname.startsWith('/api/seed-users') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  );
}

function isAuthenticated(req: NextRequest): boolean {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.username === 'string' && parsed.username.length > 0;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (isPublic(pathname)) return NextResponse.next();

  if (isAuthenticated(req)) return NextResponse.next();

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = '/lock';
  redirectUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
