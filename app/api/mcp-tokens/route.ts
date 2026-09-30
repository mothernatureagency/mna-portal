import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/staff';
import { MCP_SCOPES, defaultScopesForRole, hashToken, isMcpScope, mintRawToken, tokenPreview } from '@/lib/mcp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MCP token administration — owner only.
 *
 * GET    /api/mcp-tokens                → { tokens, connections } (never the
 *                                         raw values)
 * POST   /api/mcp-tokens                → mint; the raw token is in the
 *          { name, subjectEmail, role?,   response ONCE and is unrecoverable
 *            scopes?, clientIds? }        afterwards, because only its hash
 *                                         is stored.
 * DELETE /api/mcp-tokens?id=            → revoke a token (kept for the audit
 *                                         trail)
 * DELETE /api/mcp-tokens?connection=&subject=
 *                                       → revoke an OAuth grant: every token
 *                                         that application holds for that
 *                                         person, in one go
 *
 * Minting a token hands out standing access to the portal's data, so this is
 * restricted to the owner rather than all staff.
 */

const ROLES = ['owner', 'staff', 'manager', 'agent', 'readonly'];

async function requireOwner(): Promise<{ email: string } | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = (user?.email || '').toLowerCase();
    return isOwner(email) ? { email } : null;
  } catch {
    return null;
  }
}

export async function GET() {
  await ensureSchema();
  if (!(await requireOwner())) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  const { rows } = await query(
    `select id, name, token_prefix, subject_email, role, scopes, client_ids,
            created_by, created_at, last_used_at, revoked_at
       from mcp_tokens order by created_at desc`,
  );
  // Applications connected over OAuth. Refresh rotation means one grant is
  // many rows, so they are folded back into one line per application and
  // person — which is how someone thinks about revoking it.
  const { rows: connections } = await query(
    `select t.client_id,
            t.subject_email,
            coalesce(c.client_name, 'Unnamed application') as client_name,
            min(t.created_at) as connected_at,
            max(t.last_used_at) as last_used_at,
            -- Unnested before aggregating: array_agg over a text[] builds a
            -- two-dimensional array, which subscripts to null rather than to
            -- the scope list you wanted.
            array_remove(array_agg(distinct s), null) as scopes
       from oauth_tokens t
       join oauth_clients c on c.client_id = t.client_id
       left join lateral unnest(t.scopes) as s on true
      where t.revoked_at is null and t.refresh_expires_at > now()
      group by t.client_id, t.subject_email, c.client_name
      order by 4 desc`,
  );

  // Clients that registered and never connected. Registration is open — it is
  // how an MCP client gets a client_id without anyone typing one — so these
  // accumulate, from abandoned attempts and from probes. They hold no access
  // on their own, but there should be a way to see and clear them.
  const { rows: staleClients } = await query(
    `select c.client_id, c.client_name, c.redirect_uris, c.created_at
       from oauth_clients c
      where not exists (
        select 1 from oauth_tokens t
         where t.client_id = c.client_id and t.revoked_at is null
      )
      order by c.created_at desc
      limit 50`,
  );

  return NextResponse.json({ tokens: rows, connections, staleClients, availableScopes: MCP_SCOPES, roles: ROLES });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const name = (body?.name || '').toString().trim();
  const subjectEmail = (body?.subjectEmail || '').toString().trim().toLowerCase();
  const role = (body?.role || 'staff').toString().trim();
  if (!name) return NextResponse.json({ error: 'name is required (what this token is for)' }, { status: 400 });
  if (!subjectEmail) return NextResponse.json({ error: 'subjectEmail is required (who the token acts as)' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: `role must be one of ${ROLES.join(', ')}` }, { status: 400 });

  // An explicit scope list always wins; the role only supplies the default.
  let scopes = defaultScopesForRole(role);
  if (Array.isArray(body?.scopes)) {
    const requested = body.scopes.map((s: unknown) => String(s));
    const unknown = requested.filter((s: string) => !isMcpScope(s));
    if (unknown.length) return NextResponse.json({ error: `Unknown scopes: ${unknown.join(', ')}` }, { status: 400 });
    scopes = requested.filter(isMcpScope);
  }
  if (scopes.length === 0) return NextResponse.json({ error: 'A token with no scopes can do nothing' }, { status: 400 });

  const clientIds = Array.isArray(body?.clientIds) && body.clientIds.length
    ? body.clientIds.map((c: unknown) => String(c).trim()).filter(Boolean)
    : null;

  const raw = mintRawToken();
  const { rows } = await query<{ id: string }>(
    `insert into mcp_tokens (name, token_hash, token_prefix, subject_email, role, scopes, client_ids, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [name, hashToken(raw), tokenPreview(raw), subjectEmail, role, scopes, clientIds, owner.email],
  );

  return NextResponse.json({
    id: rows[0].id,
    token: raw,
    warning: 'Copy this now — it is stored hashed and cannot be shown again.',
    name, subjectEmail, role, scopes, clientIds,
  });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  if (!(await requireOwner())) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  // Revoking an OAuth grant: kill every live token that application holds for
  // that person, so the connection is gone rather than merely expiring later.
  const connection = req.nextUrl.searchParams.get('connection') || '';
  if (connection) {
    const subject = req.nextUrl.searchParams.get('subject') || '';
    if (!subject) return NextResponse.json({ error: 'subject is required alongside connection' }, { status: 400 });
    const { rows } = await query(
      `update oauth_tokens set revoked_at = now()
        where client_id = $1 and subject_email = $2 and revoked_at is null
        returning id`,
      [connection, subject],
    );
    if (!rows.length) return NextResponse.json({ error: 'No active connection to revoke' }, { status: 404 });
    return NextResponse.json({ revokedTokens: rows.length });
  }

  // Delete a registration that never connected. Guarded by the same check the
  // listing uses, so this can't be used to cut off a live connection by the
  // back door — that goes through ?connection= above, which revokes rather
  // than deletes and leaves the trail intact.
  const client = req.nextUrl.searchParams.get('client') || '';
  if (client) {
    const { rows } = await query(
      `delete from oauth_clients c
        where c.client_id = $1
          and not exists (
            select 1 from oauth_tokens t
             where t.client_id = c.client_id and t.revoked_at is null
          )
        returning c.client_id`,
      [client],
    );
    if (!rows.length) {
      return NextResponse.json(
        { error: 'No such registration, or it has a live connection. Disconnect it first.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ deletedClient: rows[0].client_id });
  }

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id, connection or client is required' }, { status: 400 });

  // Revoked, not deleted: the row stays so "who had access, and when" survives.
  const { rows } = await query(
    `update mcp_tokens set revoked_at = now() where id = $1 and revoked_at is null returning id, name`,
    [id],
  );
  if (!rows.length) return NextResponse.json({ error: 'No active token with that id' }, { status: 404 });
  return NextResponse.json({ revoked: rows[0] });
}
