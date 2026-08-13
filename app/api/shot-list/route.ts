import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getPortalAuth, canAccessClient, type PortalAuth } from '@/lib/portal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-client shot list — the shared checklist of photo/video assets to capture.
 * Client-role users can read and edit their own list (it's collaborative:
 * clients tick off what they've filmed, MNA adds what the calendar needs).
 *
 * GET    /api/shot-list?clientId=prime-iv
 * POST   /api/shot-list      { clientId, title, description?, shotType?, platform?, priority? }
 * PATCH  /api/shot-list      { id, title?, description?, shotType?, platform?, priority?, status? }
 * DELETE /api/shot-list?id=...
 */

const STATUSES = ['needed', 'scheduled', 'captured'];
const PRIORITIES = ['high', 'medium', 'low'];

async function itemClientId(id: string): Promise<string | null> {
  const { rows } = await query<{ client_id: string }>(
    `select client_id from shot_list_items where id = $1`, [id],
  );
  return rows[0]?.client_id ?? null;
}

async function guardItem(auth: PortalAuth, id: string): Promise<NextResponse | null> {
  const clientId = await itemClientId(id);
  if (!clientId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessClient(auth, clientId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  if (!canAccessClient(auth, clientId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await query(
    `select id, title, description, shot_type, platform, priority, status, created_at, updated_at
       from shot_list_items
      where client_id = $1
      order by case status when 'needed' then 0 when 'scheduled' then 1 else 2 end,
               case priority when 'high' then 0 when 'medium' then 1 else 2 end,
               created_at desc`,
    [clientId],
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, title, description, shotType, platform, priority } = b || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId and title required' }, { status: 400 });
  if (!canAccessClient(auth, clientId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await query(
    `insert into shot_list_items (client_id, title, description, shot_type, platform, priority)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      clientId,
      String(title).trim(),
      description || null,
      shotType || null,
      platform || null,
      PRIORITIES.includes(priority) ? priority : 'medium',
    ],
  );
  return NextResponse.json({ item: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, title, description, shotType, platform, priority, status } = b || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const denied = await guardItem(auth, id);
  if (denied) return denied;

  const fields: string[] = [];
  const values: any[] = [];
  if (title !== undefined)       { values.push(String(title).trim()); fields.push(`title = $${values.length}`); }
  if (description !== undefined) { values.push(description || null); fields.push(`description = $${values.length}`); }
  if (shotType !== undefined)    { values.push(shotType || null); fields.push(`shot_type = $${values.length}`); }
  if (platform !== undefined)    { values.push(platform || null); fields.push(`platform = $${values.length}`); }
  if (priority !== undefined && PRIORITIES.includes(priority)) { values.push(priority); fields.push(`priority = $${values.length}`); }
  if (status !== undefined && STATUSES.includes(status))       { values.push(status); fields.push(`status = $${values.length}`); }
  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update shot_list_items set ${fields.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values,
  );
  return NextResponse.json({ item: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const denied = await guardItem(auth, id);
  if (denied) return denied;

  await query('delete from shot_list_items where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
