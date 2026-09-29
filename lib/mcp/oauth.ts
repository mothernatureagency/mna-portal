import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { query } from '@/lib/db';
import { MCP_SCOPES, defaultScopesForRole, isMcpScope, type McpIdentity, type McpScope } from '@/lib/mcp/auth';

/**
 * OAuth 2.1 for the MCP server.
 *
 * The portal plays both roles the MCP authorization spec names: the resource
 * server at /api/mcp, and the authorization server that issues tokens for it.
 * Keeping them together is allowed and is much less machinery than standing up
 * a separate one for a single resource.
 *
 * Why this exists at all: a static bearer token has to be typed into the
 * client, and Claude's connector can only carry one through a beta that not
 * every account has. OAuth needs nothing typed — the client registers itself,
 * sends the user here to sign in with the portal account they already have,
 * and gets a token bound to this server.
 *
 * Shape of the thing:
 *   - clients register themselves at runtime (RFC 7591); no shared secret,
 *     they are public clients and PKCE is what protects the code
 *   - codes are single use, live five minutes, and are bound to the S256
 *     challenge the client committed to before the user ever saw a screen
 *   - access tokens last an hour, refresh tokens thirty days and rotate on
 *     every use, as OAuth 2.1 requires for public clients
 *   - every token carries the resource it was minted for, and /api/mcp
 *     refuses one minted for anything else
 */

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 5 * 60;

const ACCESS_PREFIX = 'mna_at_';
const REFRESH_PREFIX = 'mna_rt_';
const CODE_PREFIX = 'mna_ac_';

export function hashSecret(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function mint(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url');
}

/** Constant-time compare of two hex digests of equal length. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

// ── Discovery documents ───────────────────────────────────────────────

/**
 * The canonical URI of this MCP server, per RFC 8707. Derived from the
 * request rather than hard-coded so preview deploys advertise themselves
 * correctly instead of pointing clients at production.
 */
export function mcpResourceUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  const base = origin.replace(/\/$/, '');
  return {
    resource: mcpResourceUri(base),
    authorization_servers: [base],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Mother Nature Agency Portal',
    resource_documentation: `${base}/settings/mcp`,
  };
}

export function authorizationServerMetadata(origin: string) {
  const base = origin.replace(/\/$/, '');
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: [...MCP_SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 only. OAuth 2.1 removes `plain`, and accepting it would undo the
    // protection the code challenge is there to provide.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    service_documentation: `${base}/settings/mcp`,
  };
}

// ── Clients ───────────────────────────────────────────────────────────

export type OAuthClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  scope: string | null;
};

/**
 * Redirect URIs must be exactly what the client registered, and must be
 * https or loopback. Anything else is an open redirect waiting to happen.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === 'https:') return true;
  // Loopback over http is the one exception the spec keeps, for native clients.
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')) {
    return true;
  }
  return false;
}

export async function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  scope?: string;
  clientUri?: string;
  tokenEndpointAuthMethod?: string;
}): Promise<OAuthClient & { client_id_issued_at: number }> {
  const clientId = 'mna_client_' + randomBytes(16).toString('base64url');
  const { rows } = await query<OAuthClient>(
    `insert into oauth_clients
       (client_id, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, scope, client_uri)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning client_id, client_name, redirect_uris, grant_types, scope`,
    [
      clientId,
      input.clientName || null,
      input.redirectUris,
      input.grantTypes?.length ? input.grantTypes : ['authorization_code', 'refresh_token'],
      input.responseTypes?.length ? input.responseTypes : ['code'],
      input.tokenEndpointAuthMethod || 'none',
      input.scope || null,
      input.clientUri || null,
    ],
  );
  return { ...rows[0], client_id_issued_at: Math.floor(Date.now() / 1000) };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const { rows } = await query<OAuthClient>(
    `select client_id, client_name, redirect_uris, grant_types, scope
       from oauth_clients where client_id = $1`,
    [clientId],
  );
  return rows[0] || null;
}

// ── Scopes ────────────────────────────────────────────────────────────

/**
 * What this person may actually grant. A requested scope is only honoured if
 * their role already carries it, so a client cannot talk its way into more
 * than the user has.
 */
export function grantableScopes(role: string, requested: string | null | undefined): McpScope[] {
  const allowed = defaultScopesForRole(role);
  if (!requested) return allowed;
  const asked = requested.split(/\s+/).filter(Boolean).filter(isMcpScope);
  if (asked.length === 0) return allowed;
  return allowed.filter((s) => asked.includes(s));
}

// ── Authorization codes ───────────────────────────────────────────────

export async function issueAuthCode(input: {
  clientId: string;
  subjectEmail: string;
  redirectUri: string;
  scopes: McpScope[];
  resource: string | null;
  codeChallenge: string;
}): Promise<string> {
  const raw = mint(CODE_PREFIX);
  await query(
    `insert into oauth_auth_codes
       (code_hash, client_id, subject_email, redirect_uri, scopes, resource, code_challenge, code_challenge_method, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,'S256', now() + ($8 || ' seconds')::interval)`,
    [
      hashSecret(raw),
      input.clientId,
      input.subjectEmail,
      input.redirectUri,
      input.scopes,
      input.resource,
      input.codeChallenge,
      String(AUTH_CODE_TTL_SECONDS),
    ],
  );
  return raw;
}

type AuthCodeRow = {
  code_hash: string;
  client_id: string;
  subject_email: string;
  redirect_uri: string;
  scopes: string[];
  resource: string | null;
  code_challenge: string;
  used_at: string | null;
};

/** PKCE S256: base64url(sha256(verifier)) must equal the stored challenge. */
function verifierMatches(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier, 'utf8').digest('base64url');
  if (computed.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

export type CodeRedemption =
  | { ok: true; row: AuthCodeRow }
  | { ok: false; error: string; description: string };

/**
 * Redeem a code, once. Marking it used and reading it happen in one statement
 * so two simultaneous redemptions can't both win.
 */
export async function redeemAuthCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<CodeRedemption> {
  const { rows } = await query<AuthCodeRow>(
    `update oauth_auth_codes
        set used_at = now()
      where code_hash = $1 and used_at is null and expires_at > now()
      returning code_hash, client_id, subject_email, redirect_uri, scopes, resource, code_challenge, used_at`,
    [hashSecret(input.code)],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: 'invalid_grant', description: 'The code is unknown, already used, or expired.' };

  if (row.client_id !== input.clientId) {
    return { ok: false, error: 'invalid_grant', description: 'This code was issued to a different client.' };
  }
  if (row.redirect_uri !== input.redirectUri) {
    return { ok: false, error: 'invalid_grant', description: 'redirect_uri does not match the one in the authorization request.' };
  }
  if (!input.codeVerifier || !verifierMatches(input.codeVerifier, row.code_challenge)) {
    return { ok: false, error: 'invalid_grant', description: 'The PKCE code_verifier does not match the challenge.' };
  }
  return { ok: true, row };
}

// ── Tokens ────────────────────────────────────────────────────────────

export type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
};

export async function issueTokens(input: {
  clientId: string;
  subjectEmail: string;
  scopes: string[];
  resource: string | null;
}): Promise<IssuedTokens> {
  const access = mint(ACCESS_PREFIX);
  const refresh = mint(REFRESH_PREFIX);
  await query(
    `insert into oauth_tokens
       (access_token_hash, refresh_token_hash, client_id, subject_email, scopes, resource,
        access_expires_at, refresh_expires_at)
     values ($1,$2,$3,$4,$5,$6,
             now() + ($7 || ' seconds')::interval,
             now() + ($8 || ' seconds')::interval)`,
    [
      hashSecret(access),
      hashSecret(refresh),
      input.clientId,
      input.subjectEmail,
      input.scopes,
      input.resource,
      String(ACCESS_TOKEN_TTL_SECONDS),
      String(REFRESH_TOKEN_TTL_SECONDS),
    ],
  );
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: input.scopes.join(' '),
  };
}

export type RefreshResult = { ok: true; tokens: IssuedTokens } | { ok: false; error: string; description: string };

/**
 * Rotate a refresh token. OAuth 2.1 requires rotation for public clients: the
 * old one is revoked as it is read, so a replayed refresh token fails and the
 * theft is at least visible as a broken client.
 */
export async function refreshTokens(input: { refreshToken: string; clientId: string }): Promise<RefreshResult> {
  const { rows } = await query<{ client_id: string; subject_email: string; scopes: string[]; resource: string | null }>(
    `update oauth_tokens
        set revoked_at = now()
      where refresh_token_hash = $1 and revoked_at is null and refresh_expires_at > now()
      returning client_id, subject_email, scopes, resource`,
    [hashSecret(input.refreshToken)],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: 'invalid_grant', description: 'The refresh token is unknown, used, revoked or expired.' };
  if (row.client_id !== input.clientId) {
    return { ok: false, error: 'invalid_grant', description: 'This refresh token was issued to a different client.' };
  }
  return {
    ok: true,
    tokens: await issueTokens({
      clientId: row.client_id,
      subjectEmail: row.subject_email,
      scopes: row.scopes,
      resource: row.resource,
    }),
  };
}

export async function revokeToken(raw: string): Promise<void> {
  const h = hashSecret(raw);
  await query(
    `update oauth_tokens set revoked_at = now()
      where (access_token_hash = $1 or refresh_token_hash = $1) and revoked_at is null`,
    [h],
  );
}

// ── Resource-server side: validating an access token ──────────────────

type AccessRow = {
  id: string;
  subject_email: string;
  scopes: string[];
  resource: string | null;
  client_id: string;
  client_name: string | null;
};

export function looksLikeOAuthAccessToken(raw: string): boolean {
  return raw.startsWith(ACCESS_PREFIX);
}

/**
 * Turn an OAuth access token into an identity, or null.
 *
 * The audience check is the important line here. A token minted for some
 * other resource is refused even though it is one of ours and unexpired —
 * that is what the MCP spec means by not accepting tokens issued for
 * somebody else, and it is what stops a token from one service being
 * replayed against this one.
 */
export async function identityFromAccessToken(raw: string, expectedResource: string): Promise<McpIdentity | null> {
  const { rows } = await query<AccessRow>(
    `select t.id, t.subject_email, t.scopes, t.resource, t.client_id, c.client_name
       from oauth_tokens t
       join oauth_clients c on c.client_id = t.client_id
      where t.access_token_hash = $1
        and t.revoked_at is null
        and t.access_expires_at > now()`,
    [hashSecret(raw)],
  );
  const row = rows[0];
  if (!row) return null;

  if (row.resource && !sameAudience(row.resource, expectedResource)) return null;

  const scopes = (row.scopes || []).filter(isMcpScope);
  if (scopes.length === 0) return null;

  void query(`update oauth_tokens set last_used_at = now() where id = $1`, [row.id]).catch(() => {});

  return {
    tokenId: row.id,
    tokenName: row.client_name || 'OAuth client',
    email: row.subject_email,
    name: row.subject_email,
    role: 'staff',
    scopes,
    clientIds: null,
  };
}

/** Compare audiences, tolerating a trailing slash and case in scheme/host. */
function sameAudience(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const url = new URL(u);
      return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname.replace(/\/$/, '')}`;
    } catch {
      return u.replace(/\/$/, '').toLowerCase();
    }
  };
  return norm(a) === norm(b);
}

export { sameHash };
