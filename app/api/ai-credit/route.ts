import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/staff';
import { creditSummary, invalidateCreditCache } from '@/lib/ai-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Anthropic credit — owner only.
 *
 * GET    /api/ai-credit          → balance, spend breakdowns, the top-up ledger
 * POST   /api/ai-credit          → record a top-up (or a negative correction)
 *          { amountUsd, note? }
 * PATCH  /api/ai-credit          → { lowBalanceUsd?, hardStop? }
 * DELETE /api/ai-credit?id=      → remove a ledger row entered by mistake
 *
 * This is the money page: it says what the agency has paid Anthropic and
 * lets someone change that number, so it is restricted to the owner rather
 * than all staff — same bar as minting an MCP token.
 */

/** Day buckets follow the portal's default timezone, not the server's. */
const TZ = 'America/Chicago';

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

export async function GET(req: NextRequest) {
  await ensureSchema();
  if (!(await requireOwner())) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  const window = `${days} days`;

  const [summary, bySource, byModel, byClient, byDay, ledger, recent, failures] = await Promise.all([
    creditSummary(),
    query(
      `select source,
              sum(cost_usd)::float8 as cost_usd,
              count(*)::int as calls,
              sum(input_tokens + output_tokens)::bigint as tokens
         from ai_usage
        where ok and at > now() - $1::interval
        group by source order by 2 desc limit 50`,
      [window],
    ),
    query(
      `select model, sum(cost_usd)::float8 as cost_usd, count(*)::int as calls
         from ai_usage
        where ok and at > now() - $1::interval
        group by model order by 2 desc`,
      [window],
    ),
    query(
      `select coalesce(client_id, '') as client_id,
              sum(cost_usd)::float8 as cost_usd, count(*)::int as calls
         from ai_usage
        where ok and at > now() - $1::interval
        group by 1 order by 2 desc limit 50`,
      [window],
    ),
    query(
      `select (at at time zone $2)::date::text as day,
              sum(cost_usd)::float8 as cost_usd, count(*)::int as calls
         from ai_usage
        where ok and at > now() - $1::interval
        group by 1 order by 1`,
      [window, TZ],
    ),
    query(
      `select id, at, amount_usd::float8 as amount_usd, note, created_by
         from ai_credit_ledger order by at desc limit 100`,
    ),
    query(
      `select id, at, source, model, client_id, actor,
              input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
              cost_usd::float8 as cost_usd
         from ai_usage where ok order by at desc limit 25`,
    ),
    query(
      `select count(*)::int as failed from ai_usage
        where not ok and at > now() - $1::interval`,
      [window],
    ),
  ]);

  return NextResponse.json({
    summary,
    days,
    timezone: TZ,
    bySource: bySource.rows,
    byModel: byModel.rows,
    byClient: byClient.rows,
    byDay: byDay.rows,
    ledger: ledger.rows,
    recent: recent.rows,
    failedCalls: failures.rows[0]?.failed ?? 0,
  });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const amountUsd = Number(body?.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd === 0) {
    return NextResponse.json({ error: 'amountUsd must be a non-zero number' }, { status: 400 });
  }
  // Large enough to cover a real top-up, small enough that a slipped decimal
  // point shows up as a rejection rather than as a wrong balance.
  if (Math.abs(amountUsd) > 100_000) {
    return NextResponse.json({ error: 'amountUsd looks wrong — over $100,000' }, { status: 400 });
  }

  const note = (body?.note || '').toString().trim().slice(0, 300) || null;
  const { rows } = await query(
    `insert into ai_credit_ledger (amount_usd, note, created_by)
     values ($1, $2, $3)
     returning id, at, amount_usd::float8 as amount_usd, note, created_by`,
    [amountUsd.toFixed(2), note, owner.email],
  );

  invalidateCreditCache();
  return NextResponse.json({ entry: rows[0], summary: await creditSummary() });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const current = await creditSummary();
  const lowBalanceUsd = body?.lowBalanceUsd === undefined ? current.lowBalanceUsd : Number(body.lowBalanceUsd);
  const hardStop = body?.hardStop === undefined ? current.hardStop : !!body.hardStop;
  if (!Number.isFinite(lowBalanceUsd) || lowBalanceUsd < 0) {
    return NextResponse.json({ error: 'lowBalanceUsd must be zero or more' }, { status: 400 });
  }

  await query(
    `insert into ai_credit_settings (id, low_balance_usd, hard_stop, updated_at, updated_by)
     values (true, $1, $2, now(), $3)
     on conflict (id) do update
       set low_balance_usd = excluded.low_balance_usd,
           hard_stop = excluded.hard_stop,
           updated_at = now(),
           updated_by = excluded.updated_by`,
    [lowBalanceUsd.toFixed(2), hardStop, owner.email],
  );

  invalidateCreditCache();
  return NextResponse.json({ summary: await creditSummary() });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  if (!(await requireOwner())) return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { rows } = await query(`delete from ai_credit_ledger where id = $1 returning id`, [id]);
  if (!rows.length) return NextResponse.json({ error: 'No such ledger entry' }, { status: 404 });

  invalidateCreditCache();
  return NextResponse.json({ deleted: rows[0].id, summary: await creditSummary() });
}
