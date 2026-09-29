import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { getClient, issueTokens, redeemAuthCode, refreshTokens } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The token endpoint. Two grants: authorization_code and refresh_token.
 *
 * Clients here are public — there is no secret to check — so what proves the
 * caller is the same one that started the flow is PKCE, checked inside
 * redeemAuthCode. Refresh tokens rotate on every use, which OAuth 2.1
 * requires for public clients: a stolen refresh token works at most once, and
 * the legitimate client breaking is the signal that it was stolen.
 */

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function oauthError(error: string, description: string, status = 400) {
  return cors(NextResponse.json({ error, error_description: description }, { status }));
}

/** The spec says form encoding; accept JSON too rather than fail a client over it. */
async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      const body = await request.json();
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(body || {})) out[k] = String(v);
      return out;
    } catch {
      return {};
    }
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  const out: Record<string, string> = {};
  form.forEach((v, k) => { out[k] = String(v); });
  return out;
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  const params = await readParams(request);

  const grantType = params.grant_type || '';
  const clientId = params.client_id || '';
  if (!clientId) return oauthError('invalid_request', 'client_id is required.');

  const client = await getClient(clientId);
  if (!client) return oauthError('invalid_client', 'Unknown client_id.', 401);

  if (grantType === 'authorization_code') {
    const code = params.code || '';
    const redirectUri = params.redirect_uri || '';
    const verifier = params.code_verifier || '';
    if (!code) return oauthError('invalid_request', 'code is required.');
    if (!redirectUri) return oauthError('invalid_request', 'redirect_uri is required.');
    if (!verifier) return oauthError('invalid_request', 'code_verifier is required (PKCE).');

    const redeemed = await redeemAuthCode({ code, clientId, redirectUri, codeVerifier: verifier });
    if (!redeemed.ok) return oauthError(redeemed.error, redeemed.description);

    const tokens = await issueTokens({
      clientId,
      subjectEmail: redeemed.row.subject_email,
      scopes: redeemed.row.scopes,
      // The audience is fixed at authorization time. Honouring a `resource`
      // sent only now would let a client widen what the user agreed to.
      resource: redeemed.row.resource,
    });
    return cors(NextResponse.json(tokens));
  }

  if (grantType === 'refresh_token') {
    const refreshToken = params.refresh_token || '';
    if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required.');
    const result = await refreshTokens({ refreshToken, clientId });
    if (!result.ok) return oauthError(result.error, result.description);
    return cors(NextResponse.json(result.tokens));
  }

  return oauthError('unsupported_grant_type', `Supported grants: authorization_code, refresh_token. Got: ${grantType || '(none)'}`);
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}
