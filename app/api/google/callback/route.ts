import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/google-calendar';
import { ensureSchema, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET — Google OAuth callback. Exchanges code for tokens and stores them.
 * Google redirects here with ?code=xxx&state=userEmail
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const code = req.nextUrl.searchParams.get('code');
  const userEmail = req.nextUrl.searchParams.get('state');
  const origin = req.nextUrl.origin;

  if (!code || !userEmail) {
    return NextResponse.redirect(`${origin}/schedule?gcal=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert tokens
    await query(
      `INSERT INTO google_tokens (user_email, access_token, refresh_token, token_expiry)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_email) DO UPDATE SET
         access_token = $2, refresh_token = $3, token_expiry = $4, connected_at = now()`,
      [userEmail, tokens.access_token, tokens.refresh_token, expiry.toISOString()]
    );

    return NextResponse.redirect(`${origin}/schedule?gcal=connected`);
  } catch (err: any) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(`${origin}/schedule?gcal=error`);
  }
}
