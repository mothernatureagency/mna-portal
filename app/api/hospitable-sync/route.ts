import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/hospitable-sync
 *
 * Webhook endpoint for Make.com to push Hospitable data into our database.
 * Accepts three payload types (set via `type` field):
 *
 *   1. "reservations" — Array of reservation objects
 *   2. "daily_metrics" — Array of daily metric snapshots
 *   3. "reviews" — Array of guest reviews
 *
 * Auth: Simple shared secret via X-Sync-Key header.
 * Set HOSPITABLE_SYNC_KEY in .env.local to enable auth.
 */

function checkAuth(req: NextRequest): boolean {
  const key = process.env.HOSPITABLE_SYNC_KEY;
  if (!key) return true; // No key configured = open (dev mode)
  return req.headers.get('x-sync-key') === key;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, clientId, data } = body || {};
  if (!type || !clientId || !Array.isArray(data)) {
    return NextResponse.json(
      { error: 'Required: type (reservations|daily_metrics|reviews), clientId, data[]' },
      { status: 400 },
    );
  }

  try {
    switch (type) {
      case 'reservations':
        return await syncReservations(clientId, data);
      case 'daily_metrics':
        return await syncDailyMetrics(clientId, data);
      case 'reviews':
        return await syncReviews(clientId, data);
      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[hospitable-sync]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/hospitable-sync?clientId=serenity-bayfront&type=summary
// Returns current metrics summary for the dashboard
export async function GET(req: NextRequest) {
  await ensureSchema();

  const clientId = req.nextUrl.searchParams.get('clientId');
  const type = req.nextUrl.searchParams.get('type') || 'summary';

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  if (type === 'summary') {
    return await getSummary(clientId);
  }
  if (type === 'reservations') {
    return await getReservations(clientId);
  }
  if (type === 'reviews') {
    return await getReviews(clientId);
  }

  return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
}

// ── Sync handlers ───────────────────────────────────────────────────

async function syncReservations(clientId: string, data: any[]) {
  let upserted = 0;
  for (const r of data) {
    if (!r.platform || !r.reservation_id || !r.check_in || !r.check_out) continue;
    const nights = Math.max(1, Math.round(
      (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 86400000
    ));
    await query(
      `INSERT INTO str_reservations
        (client_id, platform, reservation_id, guest_name, check_in, check_out, nights, nightly_rate, total_payout, status, booked_at, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (client_id, platform, reservation_id)
       DO UPDATE SET
         guest_name = EXCLUDED.guest_name,
         check_in = EXCLUDED.check_in,
         check_out = EXCLUDED.check_out,
         nights = EXCLUDED.nights,
         nightly_rate = EXCLUDED.nightly_rate,
         total_payout = EXCLUDED.total_payout,
         status = EXCLUDED.status,
         booked_at = EXCLUDED.booked_at,
         synced_at = now()`,
      [
        clientId,
        r.platform,
        r.reservation_id,
        r.guest_name || null,
        r.check_in,
        r.check_out,
        nights,
        r.nightly_rate || null,
        r.total_payout || null,
        r.status || 'confirmed',
        r.booked_at || null,
      ],
    );
    upserted++;
  }
  return NextResponse.json({ ok: true, upserted });
}

async function syncDailyMetrics(clientId: string, data: any[]) {
  let upserted = 0;
  for (const m of data) {
    if (!m.metric_date) continue;
    await query(
      `INSERT INTO str_daily_metrics
        (client_id, metric_date, occupancy_pct, adr, revpar, revenue, bookings_count, inquiries_count, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (client_id, metric_date)
       DO UPDATE SET
         occupancy_pct = COALESCE(EXCLUDED.occupancy_pct, str_daily_metrics.occupancy_pct),
         adr = COALESCE(EXCLUDED.adr, str_daily_metrics.adr),
         revpar = COALESCE(EXCLUDED.revpar, str_daily_metrics.revpar),
         revenue = COALESCE(EXCLUDED.revenue, str_daily_metrics.revenue),
         bookings_count = COALESCE(EXCLUDED.bookings_count, str_daily_metrics.bookings_count),
         inquiries_count = COALESCE(EXCLUDED.inquiries_count, str_daily_metrics.inquiries_count),
         synced_at = now()`,
      [
        clientId,
        m.metric_date,
        m.occupancy_pct ?? null,
        m.adr ?? null,
        m.revpar ?? null,
        m.revenue ?? null,
        m.bookings_count ?? 0,
        m.inquiries_count ?? 0,
      ],
    );
    upserted++;
  }
  return NextResponse.json({ ok: true, upserted });
}

async function syncReviews(clientId: string, data: any[]) {
  let upserted = 0;
  for (const r of data) {
    if (!r.platform || !r.rating) continue;
    const reviewId = r.review_id || `${r.platform}-${r.guest_name}-${r.review_date}`;
    await query(
      `INSERT INTO str_reviews
        (client_id, platform, review_id, guest_name, rating, review_text, review_date, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (client_id, platform, review_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         review_text = EXCLUDED.review_text,
         synced_at = now()`,
      [
        clientId,
        r.platform,
        reviewId,
        r.guest_name || null,
        r.rating,
        r.review_text || null,
        r.review_date || null,
      ],
    );
    upserted++;
  }
  return NextResponse.json({ ok: true, upserted });
}

// ── GET handlers ────────────────────────────────────────────────────

async function getSummary(clientId: string) {
  // Current month metrics
  const { rows: monthlyMetrics } = await query(
    `SELECT
       COALESCE(AVG(occupancy_pct), 0) as avg_occupancy,
       COALESCE(AVG(adr), 0) as avg_adr,
       COALESCE(AVG(revpar), 0) as avg_revpar,
       COALESCE(SUM(revenue), 0) as total_revenue,
       COALESCE(SUM(bookings_count), 0) as total_bookings,
       COALESCE(SUM(inquiries_count), 0) as total_inquiries
     FROM str_daily_metrics
     WHERE client_id = $1
       AND metric_date >= date_trunc('month', CURRENT_DATE)
       AND metric_date < date_trunc('month', CURRENT_DATE) + interval '1 month'`,
    [clientId],
  );

  // Revenue by channel (from reservations)
  const { rows: channelRevenue } = await query(
    `SELECT
       platform,
       COUNT(*) as booking_count,
       COALESCE(SUM(total_payout), 0) as total_revenue,
       COALESCE(AVG(nightly_rate), 0) as avg_nightly_rate
     FROM str_reservations
     WHERE client_id = $1 AND status = 'confirmed'
     GROUP BY platform`,
    [clientId],
  );

  // Upcoming bookings (next 90 days)
  const { rows: upcoming } = await query(
    `SELECT platform, check_in, check_out, nights, total_payout, guest_name
     FROM str_reservations
     WHERE client_id = $1
       AND status = 'confirmed'
       AND check_in >= CURRENT_DATE
       AND check_in < CURRENT_DATE + interval '90 days'
     ORDER BY check_in`,
    [clientId],
  );

  // Review stats
  const { rows: reviewStats } = await query(
    `SELECT
       COUNT(*) as total_reviews,
       COALESCE(AVG(rating), 0) as avg_rating,
       COUNT(*) FILTER (WHERE rating = 5) as five_star_count
     FROM str_reviews
     WHERE client_id = $1`,
    [clientId],
  );

  // Monthly revenue trend (last 6 months)
  const { rows: monthlyTrend } = await query(
    `SELECT
       to_char(metric_date, 'Mon YYYY') as month,
       COALESCE(SUM(revenue), 0) as revenue,
       COALESCE(AVG(occupancy_pct), 0) as avg_occupancy
     FROM str_daily_metrics
     WHERE client_id = $1
       AND metric_date >= CURRENT_DATE - interval '6 months'
     GROUP BY to_char(metric_date, 'Mon YYYY'), date_trunc('month', metric_date)
     ORDER BY date_trunc('month', metric_date)`,
    [clientId],
  );

  return NextResponse.json({
    currentMonth: monthlyMetrics[0] || null,
    channelRevenue,
    upcoming,
    reviewStats: reviewStats[0] || null,
    monthlyTrend,
  });
}

async function getReservations(clientId: string) {
  const { rows } = await query(
    `SELECT * FROM str_reservations
     WHERE client_id = $1
     ORDER BY check_in DESC
     LIMIT 50`,
    [clientId],
  );
  return NextResponse.json({ items: rows });
}

async function getReviews(clientId: string) {
  const { rows } = await query(
    `SELECT * FROM str_reviews
     WHERE client_id = $1
     ORDER BY review_date DESC NULLS LAST
     LIMIT 50`,
    [clientId],
  );
  return NextResponse.json({ items: rows });
}
