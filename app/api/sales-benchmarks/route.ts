import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual sales benchmark entries — MNA plugs in monthly numbers for
 * each competitor (e.g. "mine", "destin", "corporate") and each metric
 * (leads, revenue, bookings, conversion).
 *
 * GET /api/sales-benchmarks?clientId=prime-iv
 *   → all entries for that client
 *
 * POST /api/sales-benchmarks
 *   body: { clientId, competitorKey, metric, yearMonth, value, note? }
 *   Upserts one row.
 *
 * DELETE /api/sales-benchmarks?id=...
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const { rows } = await query(
    `select id, competitor_key, metric, year_month, value, note, updated_at
       from sales_benchmarks
      where client_id = $1
      order by year_month desc, metric asc, competitor_key asc`,
    [clientId],
  );
  return NextResponse.json({ entries: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, competitorKey, metric, yearMonth, value, note } = b || {};
  if (!clientId || !competitorKey || !metric || !yearMonth || value == null) {
    return NextResponse.json({ error: 'clientId, competitorKey, metric, yearMonth, value required' }, { status: 400 });
  }
  const { rows } = await query(
    `insert into sales_benchmarks (client_id, competitor_key, metric, year_month, value, note)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (client_id, competitor_key, metric, year_month)
     do update set value = excluded.value, note = excluded.note, updated_at = now()
     returning *`,
    [clientId, competitorKey, metric, yearMonth, Number(value), note || null],
  );
  return NextResponse.json({ entry: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from sales_benchmarks where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
