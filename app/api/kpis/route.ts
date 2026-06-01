import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual KPI overrides. The dashboard pulls what it can automatically (Meta ad
 * metrics); anything entered here overrides the auto value for that month —
 * same MoM-style click-to-edit pattern as the sales benchmarks.
 *
 * GET    /api/kpis?clientId=prime-iv         → all manual entries
 * POST   /api/kpis  { clientId, metric, yearMonth, value, note? }  → upsert
 * DELETE /api/kpis?clientId=..&metric=..&yearMonth=..  → clear an override
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const { rows } = await query(
    `select id, metric, year_month, value, note, updated_at
       from kpi_entries
      where client_id = $1
      order by year_month desc, metric asc`,
    [clientId],
  );
  return NextResponse.json({ entries: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, metric, yearMonth, value, note } = b || {};
  if (!clientId || !metric || !yearMonth || value == null) {
    return NextResponse.json({ error: 'clientId, metric, yearMonth, value required' }, { status: 400 });
  }
  const { rows } = await query(
    `insert into kpi_entries (client_id, metric, year_month, value, note)
     values ($1, $2, $3, $4, $5)
     on conflict (client_id, metric, year_month)
     do update set value = excluded.value, note = excluded.note, updated_at = now()
     returning *`,
    [clientId, metric, yearMonth, Number(value), note || null],
  );
  return NextResponse.json({ entry: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  const metric = req.nextUrl.searchParams.get('metric');
  const yearMonth = req.nextUrl.searchParams.get('yearMonth');
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    await query('delete from kpi_entries where id = $1', [id]);
    return NextResponse.json({ ok: true });
  }
  if (!clientId || !metric || !yearMonth) {
    return NextResponse.json({ error: 'id, or clientId+metric+yearMonth required' }, { status: 400 });
  }
  await query(
    'delete from kpi_entries where client_id = $1 and metric = $2 and year_month = $3',
    [clientId, metric, yearMonth],
  );
  return NextResponse.json({ ok: true });
}
