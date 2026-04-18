import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily Google review snapshots per competitor. Lets us compute growth
 * velocity even though Google Places itself only returns the CURRENT
 * total — we snapshot once per day per competitor and diff over time.
 *
 * POST /api/google-places/snapshot
 *   body: { clientId, competitorKey, placeId, rating, totalReviews }
 *   Upserts today's snapshot (unique on client/competitor/date).
 *
 * GET /api/google-places/snapshot?clientId=prime-iv
 *   Returns per-competitor history (last 90 days) + computed velocities.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, competitorKey, placeId, rating, totalReviews } = b || {};
  if (!clientId || !competitorKey || !placeId || totalReviews == null) {
    return NextResponse.json({ error: 'clientId, competitorKey, placeId, totalReviews required' }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `insert into google_review_snapshots (client_id, competitor_key, place_id, snapshot_date, rating, total_reviews)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (client_id, competitor_key, snapshot_date) do update set
       place_id = excluded.place_id,
       rating = excluded.rating,
       total_reviews = excluded.total_reviews,
       captured_at = now()`,
    [clientId, competitorKey, placeId, today, rating || null, Math.round(Number(totalReviews))],
  );
  return NextResponse.json({ ok: true, snapshot_date: today });
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { rows } = await query<{
    competitor_key: string;
    snapshot_date: string;
    rating: string;
    total_reviews: number;
  }>(
    `select competitor_key, snapshot_date, rating, total_reviews
       from google_review_snapshots
      where client_id = $1
        and snapshot_date >= (current_date - interval '90 days')
      order by competitor_key asc, snapshot_date asc`,
    [clientId],
  );

  // Group by competitor + compute velocities (7d, 30d, all-time)
  const byComp: Record<string, Array<{ date: string; rating: number; total: number }>> = {};
  for (const r of rows) {
    (byComp[r.competitor_key] ||= []).push({
      date: r.snapshot_date,
      rating: Number(r.rating) || 0,
      total: Number(r.total_reviews) || 0,
    });
  }

  const now = new Date();
  function daysAgo(n: number) {
    const d = new Date(now.getTime() - n * 86400000);
    return d.toISOString().slice(0, 10);
  }

  const velocity: Record<string, { current: number; rating: number; d7: number; d30: number; d90: number; since: string | null }> = {};
  for (const [key, arr] of Object.entries(byComp)) {
    if (arr.length === 0) continue;
    const latest = arr[arr.length - 1];
    const pick = (cutoff: string) => {
      // earliest snapshot on or after the cutoff
      const hit = arr.find((r) => r.date >= cutoff);
      return hit ? latest.total - hit.total : 0;
    };
    velocity[key] = {
      current: latest.total,
      rating: latest.rating,
      d7: pick(daysAgo(7)),
      d30: pick(daysAgo(30)),
      d90: pick(daysAgo(90)),
      since: arr[0]?.date || null,
    };
  }

  return NextResponse.json({ history: byComp, velocity });
}
