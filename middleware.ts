import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require authentication
function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/lock') ||
    pathname.startsWith('/api/seed-users') ||
    pathname.startsWith('/api/hospitable-sync') ||
    pathname.startsWith('/api/meeting-notes') ||
    pathname.startsWith('/api/weekly-summary') ||
    pathname.startsWith('/api/send-weekly-email') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  );
}

export async function middleware(request: NextRequest) {
  // Start with a passthrough response — we'll replace it if needed
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Write cookies onto the request object first
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Then recreate the response so cookies are forwarded to the browser
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  // Refresh the session — this must happen before any redirect logic
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Let public routes through
  if (isPublicRoute(pathname)) return supabaseResponse;

  // No session → redirect to /login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Role-based routing.
  // A user with user_metadata.role === 'client' is a client portal user and can
  // only see /client/*. If they hit anything else, bounce them to their portal.
  // Conversely, staff (anything other than 'client') should not linger on /client
  // unless they explicitly opt in (we allow it so you can QA the client view).
  const role = (user.user_metadata as Record<string, unknown> | null)?.role as string | undefined;
  if (role === 'client' && !pathname.startsWith('/client')) {
    const url = request.nextUrl.clone();
    url.pathname = '/client';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Authenticated → allow access
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
