import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require authentication
function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/google/callback') ||
    pathname.startsWith('/api/lock') ||
    // The MCP server authenticates with its own bearer token (lib/mcp/auth.ts),
    // not the session cookie. Matched exactly (with an optional trailing slash)
    // so /api/mcp-tokens — the owner-only admin route, which DOES use the
    // cookie — keeps going through this middleware and gets its session
    // refreshed. /api/mcp/health is the unauthenticated liveness probe.
    pathname === '/api/mcp' ||
    pathname === '/api/mcp/' ||
    pathname === '/api/mcp/health' ||
    // MCP clients probe /.well-known/oauth-* to discover how to authenticate.
    // This server uses static bearer tokens and publishes no OAuth metadata,
    // so the honest answer is 404. Without this the middleware redirects the
    // probe to /login, and the client reads an HTML page where it expected
    // JSON and concludes the server is unreachable.
    pathname.startsWith('/.well-known/') ||
    // OAuth endpoints a client must reach before anyone has signed in:
    // registration, the token exchange, revocation and the two discovery
    // documents. /oauth/authorize is deliberately NOT here — it is the
    // consent screen and needs the session.
    pathname === '/api/oauth/register' ||
    pathname === '/api/oauth/token' ||
    pathname === '/api/oauth/revoke' ||
    pathname === '/api/oauth/protected-resource' ||
    pathname === '/api/oauth/authorization-server' ||
    pathname.startsWith('/api/seed-users') ||
    pathname.startsWith('/api/hospitable-sync') ||
    pathname.startsWith('/api/google-reviews-sync') ||
    pathname.startsWith('/api/meeting-notes') ||
    pathname.startsWith('/api/weekly-summary') ||
    pathname.startsWith('/api/send-weekly-email') ||
    pathname.startsWith('/api/followups') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/social/run') ||
    pathname.startsWith('/api/ai-crm/webhook') ||
    pathname.startsWith('/api/ai-crm/process') ||
    pathname.startsWith('/api/ai-crm/reviews/sync') ||
    pathname.startsWith('/api/meta/refresh-kpis') ||
    pathname.startsWith('/api/reviews/run') ||
    pathname.startsWith('/api/reviews/pending') ||
    pathname.startsWith('/book') ||
    // Invoice payment: the pay page and checkout redirect check the invoice's
    // pay token themselves; Stripe's webhook is verified by signature; the
    // reminder cron checks CRON_SECRET.
    pathname.startsWith('/pay/') ||
    pathname === '/api/pay/checkout' ||
    pathname === '/api/stripe/webhook' ||
    pathname === '/api/cron/invoice-reminders' ||
    pathname.startsWith('/api/booking') ||
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

  // No session → redirect to /login.
  // API routes get a 401 instead: a redirect returns the login page's HTML
  // with a 200, so `fetch` looks successful and callers fail silently at
  // JSON.parse. That silently emptied the client switcher whenever a request
  // raced session refresh.
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    const target = pathname + request.nextUrl.search;
    url.pathname = '/login';
    // Clear first: cloning carries the original query across, which would
    // scatter the request's own parameters over the login URL beside `next`.
    url.search = '';
    // `next` keeps the query string. /oauth/authorize carries the whole
    // authorization request in it, so dropping it would send the user back to
    // a bare page that can't continue.
    url.searchParams.set('next', target);
    return NextResponse.redirect(url);
  }

  // Role-based routing.
  // - role 'client'     → locked to /client/*
  // - role 'contractor' → locked to /contractor/*
  // - everything else (staff, owner, admin) → full app
  const role = (user.user_metadata as Record<string, unknown> | null)?.role as string | undefined;
  if (role === 'client' && !pathname.startsWith('/client') && !pathname.startsWith('/api/') && !pathname.startsWith('/security')) {
    const url = request.nextUrl.clone();
    url.pathname = '/client';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (role === 'contractor' && !pathname.startsWith('/contractor') && !pathname.startsWith('/api/') && !pathname.startsWith('/security')) {
    const url = request.nextUrl.clone();
    url.pathname = '/contractor';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (role === 'student' && !pathname.startsWith('/student') && !pathname.startsWith('/api/') && !pathname.startsWith('/security')) {
    const url = request.nextUrl.clone();
    url.pathname = '/student';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (role === 'creator' && !pathname.startsWith('/creator') && !pathname.startsWith('/api/') && !pathname.startsWith('/security')) {
    const url = request.nextUrl.clone();
    url.pathname = '/creator';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Authenticated → allow access
  return supabaseResponse;
}

export const config = {
  // Skip middleware for static assets (logos, icons, and any file with an
  // image/font extension). Otherwise unauthenticated asset requests on public
  // pages like /login get redirected to /login and render as a broken image.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logos/|icons/|.*\\.(?:png|jpe?g|svg|gif|webp|ico|woff2?)).*)',
  ],
};
