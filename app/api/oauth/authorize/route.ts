import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/staff';
import { getClient, grantableScopes, issueAuthCode, mcpResourceUri } from '@/lib/mcp/oauth';
import { publicOrigin } from '@/lib/mcp/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The approval half of the authorization endpoint. The consent screen at
 * /oauth/authorize posts here; this mints the code and sends the browser back
 * to the client.
 *
 * Never reachable without a portal session, because it is not a public route
 * in middleware.ts — and it re-reads the session here anyway rather than
 * trusting anything the form said about who is approving.
 */

const STAFF_EXCLUDED = ['client', 'contractor', 'student', 'creator'];

function errorPage(message: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Authorization failed</title>` +
      `<body style="font:16px system-ui;padding:3rem;max-width:36rem;margin:auto">` +
      `<h1 style="font-size:1.25rem">Authorization failed</h1><p>${message}</p></body>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  const origin = publicOrigin(request);

  // A cross-site POST here would be one click away from granting a token, so
  // only this origin's own form may submit it.
  const reqOrigin = request.headers.get('origin');
  if (reqOrigin && reqOrigin.replace(/\/$/, '') !== origin) {
    return errorPage('This request did not come from the portal.');
  }

  const form = await request.formData().catch(() => null);
  if (!form) return errorPage('Malformed request.');
  const get = (k: string) => String(form.get(k) || '');

  const clientId = get('client_id');
  const redirectUri = get('redirect_uri');
  const state = get('state');
  const codeChallenge = get('code_challenge');
  const scope = get('scope');
  const resource = get('resource');
  const decision = get('decision');

  const client = await getClient(clientId);
  // An unknown client or an unregistered redirect URI must not be redirected
  // to — that is exactly the open redirect the check exists to prevent. Show
  // the error here instead.
  if (!client) return errorPage('Unknown client. Ask the application to register again.');
  if (!client.redirect_uris.includes(redirectUri)) {
    return errorPage('That redirect address is not one this application registered.');
  }

  const target = new URL(redirectUri);
  if (state) target.searchParams.set('state', state);

  if (decision !== 'allow') {
    target.searchParams.set('error', 'access_denied');
    target.searchParams.set('error_description', 'The request was declined.');
    return NextResponse.redirect(target.toString(), { status: 303 });
  }

  if (!codeChallenge) {
    target.searchParams.set('error', 'invalid_request');
    target.searchParams.set('error_description', 'A PKCE code_challenge is required.');
    return NextResponse.redirect(target.toString(), { status: 303 });
  }

  // Identity comes from the session cookie, never from the form.
  let email = '';
  let portalRole = 'staff';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = (user?.email || '').toLowerCase();
    portalRole = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  } catch {
    /* falls through to the sign-in check below */
  }
  if (!email) return errorPage('You are not signed in to the portal.');
  if (STAFF_EXCLUDED.includes(portalRole)) {
    return errorPage('These tools read the agency task board and client list, which this account cannot access.');
  }

  const scopes = grantableScopes(isOwner(email) ? 'owner' : 'staff', scope || null);
  if (scopes.length === 0) {
    target.searchParams.set('error', 'invalid_scope');
    target.searchParams.set('error_description', 'None of the requested scopes are available to this account.');
    return NextResponse.redirect(target.toString(), { status: 303 });
  }

  const code = await issueAuthCode({
    clientId,
    subjectEmail: email,
    redirectUri,
    scopes,
    // Bind the token to this MCP server. A client that named a different
    // resource gets a token for ours or nothing — never a token that would
    // be accepted somewhere else.
    resource: resource || mcpResourceUri(origin),
    codeChallenge,
  });

  target.searchParams.set('code', code);
  return NextResponse.redirect(target.toString(), { status: 303 });
}
