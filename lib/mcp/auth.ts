import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { query } from '@/lib/db';
import { getStaffByEmail } from '@/lib/staff';

/**
 * Authentication + authorization for the MCP server (/api/mcp).
 *
 * /api/mcp sits outside the portal's cookie auth — an MCP client has no
 * browser session — so it carries its own credential: a bearer token minted
 * from /api/mcp-tokens (owner only) and stored hashed.
 *
 * Authority lives in the token's `scopes`, never in the role string. The role
 * is a human-readable label that only decides the DEFAULT scope set at mint
 * time; once minted, the row's scopes are the whole truth. `client_ids`
 * narrows the token to a subset of clients (null = the full portfolio).
 */

export const MCP_SCOPES = [
  'tasks:read',
  'tasks:write',
  'approvals:read',
  'approvals:decide',
  'team:notify',
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export function isMcpScope(s: string): s is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(s);
}

export type McpIdentity = {
  tokenId: string;
  tokenName: string;
  /** Who this token acts as. Every write is attributed to this address. */
  email: string;
  name: string;
  role: string;
  scopes: McpScope[];
  /** null = every client; otherwise the only client ids this token may read. */
  clientIds: string[] | null;
};

/**
 * Default scopes per role, applied when a token is minted without an explicit
 * list. Deliberately conservative: only the owner can decide approvals, and an
 * agent token can look but not act until someone widens it on purpose.
 */
export function defaultScopesForRole(role: string): McpScope[] {
  switch (role) {
    case 'owner':
      return [...MCP_SCOPES];
    case 'staff':
    case 'manager':
      return ['tasks:read', 'tasks:write', 'approvals:read', 'team:notify'];
    case 'agent':
      return ['tasks:read', 'approvals:read'];
    default:
      return ['tasks:read'];
  }
}

const TOKEN_PREFIX = 'mna_mcp_';

/** Mint a new raw token. Shown to the user exactly once — never stored. */
export function mintRawToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** First 12 chars, for identifying a token in a list without revealing it. */
export function tokenPreview(raw: string): string {
  return raw.slice(0, TOKEN_PREFIX.length + 4) + '…';
}

type TokenRow = {
  id: string;
  name: string;
  token_hash: string;
  subject_email: string;
  role: string;
  scopes: string[] | null;
  client_ids: string[] | null;
};

/**
 * Resolve an `Authorization: Bearer …` header to an identity, or null when the
 * header is missing, malformed, or names a token that doesn't exist or was
 * revoked. Callers must treat null as 401 and say nothing about which it was.
 */
export async function resolveMcpIdentity(authHeader: string | null): Promise<McpIdentity | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader || '');
  if (!match) return null;
  const raw = match[1];
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(raw);
  const { rows } = await query<TokenRow>(
    `select id, name, token_hash, subject_email, role, scopes, client_ids
       from mcp_tokens
      where token_hash = $1 and revoked_at is null
      limit 1`,
    [hash],
  );
  const row = rows[0];
  if (!row) return null;

  // The lookup above already matched on the hash; compare again in constant
  // time so a future change to the query (e.g. a prefix lookup) can't turn
  // this into a byte-by-byte comparison against the stored digest.
  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(row.token_hash, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort usage stamp — never block the request on it.
  void query(`update mcp_tokens set last_used_at = now() where id = $1`, [row.id]).catch(() => {});

  const email = (row.subject_email || '').toLowerCase();
  const staff = getStaffByEmail(email);
  const scopes = (row.scopes || []).filter(isMcpScope);

  return {
    tokenId: row.id,
    tokenName: row.name,
    email,
    name: staff?.name || email || row.name,
    role: row.role,
    scopes,
    clientIds: row.client_ids && row.client_ids.length > 0 ? row.client_ids : null,
  };
}

export function hasScope(identity: McpIdentity, scope: McpScope): boolean {
  return identity.scopes.includes(scope);
}
