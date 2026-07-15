import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Auth callback — exchanges the Supabase auth code for a session.
 * Used by password reset emails and any OAuth flows.
 *
 * Supabase redirects here with ?code=xxx after the user clicks a reset link.
 * We exchange the code server-side, set the session cookies, then redirect
 * to /reset-password so the user can set their new password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/reset-password';

  if (code || tokenHash) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          },
        },
      }
    );

    // Newer Supabase links deliver a PKCE ?code=; older/recovery links deliver
    // a ?token_hash=&type=recovery. Handle both so the reset link always works.
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: (type as any) || 'recovery', token_hash: tokenHash! });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=reset_failed`);
}
