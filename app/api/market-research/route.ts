import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Market-research / local-outreach targets per client (B2B partners, gyms,
 * urgent cares near a Prime IV location).
 *
 * GET    /api/market-research?clientId=      → list targets
 * POST   /api/market-research  { clientId, category, name, address?, phone? }
 * PATCH  /api/market-research  { id, status?, notes? }
 * DELETE /api/market-research?id=
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ targets: [] });
  const { rows } = await query(
    `select id, client_id, category, name, address, phone, place_id, maps_uri, status, notes, created_at
       from market_targets where client_id = $1 order by category, name`,
    [clientId],
  );
  return NextResponse.json({ targets: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can add targets' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, category, name, address, phone } = body || {};
  if (!clientId || !category || !name) return NextResponse.json({ error: 'clientId, category and name required' }, { status: 400 });

  const { rows } = await query(
    `insert into market_targets (client_id, category, name, address, phone)
     values ($1, $2, $3, $4, $5) returning *`,
    [clientId, category, name, address || null, phone || null],
  );
  return NextResponse.json({ target: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can edit targets' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, status, notes } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const fields: string[] = [];
  const values: any[] = [];
  if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
  if (notes !== undefined) { values.push(notes); fields.push(`notes = $${values.length}`); }
  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(id);
  const { rows } = await query(`update market_targets set ${fields.join(', ')} where id = $${values.length} returning *`, values);
  return NextResponse.json({ target: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can delete targets' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from market_targets where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
