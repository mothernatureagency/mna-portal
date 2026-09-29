import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { isAllowedRedirectUri, registerClient } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dynamic client registration (RFC 7591).
 *
 * Open by design: an MCP client can't be handed a client id in advance, so
 * the spec has it register itself. That sounds alarming and isn't, because a
 * client id grants nothing on its own — it only lets the client *ask*, and
 * every request still ends at a consent screen where a signed-in member of
 * staff has to approve it by name. Registering is not access.
 *
 * What is enforced here is the part that does matter: redirect URIs are
 * recorded now and matched exactly later, and only https or loopback ones
 * are accepted, so a registration can't be used to bounce a user somewhere
 * hostile with a code in the URL.
 */

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return res;
}

function badRequest(error: string, description: string) {
  return cors(NextResponse.json({ error, error_description: description }, { status: 400 }));
}

export async function POST(request: NextRequest) {
  await ensureSchema();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid_client_metadata', 'The body must be JSON.');
  }

  const redirectUris: unknown = body?.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return badRequest('invalid_redirect_uri', 'redirect_uris is required and must be a non-empty array.');
  }
  if (redirectUris.length > 10) {
    return badRequest('invalid_redirect_uri', 'At most 10 redirect_uris.');
  }

  const uris = redirectUris.map((u) => String(u));
  const bad = uris.filter((u) => !isAllowedRedirectUri(u));
  if (bad.length) {
    return badRequest('invalid_redirect_uri', `Redirect URIs must be https, or http on loopback, with no fragment: ${bad.join(', ')}`);
  }

  const authMethod = String(body?.token_endpoint_auth_method || 'none');
  if (authMethod !== 'none') {
    // Public clients only. Issuing a secret to a client we've never met adds
    // a credential to leak without adding anything PKCE doesn't already give.
    return badRequest('invalid_client_metadata', 'Only public clients are supported (token_endpoint_auth_method must be "none").');
  }

  const grantTypes = Array.isArray(body?.grant_types) ? body.grant_types.map(String) : ['authorization_code', 'refresh_token'];
  const unsupported = grantTypes.filter((g: string) => g !== 'authorization_code' && g !== 'refresh_token');
  if (unsupported.length) {
    return badRequest('invalid_client_metadata', `Unsupported grant types: ${unsupported.join(', ')}`);
  }

  const client = await registerClient({
    clientName: body?.client_name ? String(body.client_name).slice(0, 200) : undefined,
    redirectUris: uris,
    grantTypes,
    responseTypes: Array.isArray(body?.response_types) ? body.response_types.map(String) : undefined,
    scope: body?.scope ? String(body.scope).slice(0, 500) : undefined,
    clientUri: body?.client_uri ? String(body.client_uri).slice(0, 500) : undefined,
    tokenEndpointAuthMethod: 'none',
  });

  return cors(
    NextResponse.json(
      {
        client_id: client.client_id,
        client_id_issued_at: client.client_id_issued_at,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: client.scope || undefined,
      },
      { status: 201 },
    ),
  );
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}
