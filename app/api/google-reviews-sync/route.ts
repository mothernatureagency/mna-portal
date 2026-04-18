import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Reviews sync webhook for Make.com.
 *
 * ── POST /api/google-reviews-sync ──
 * Headers: X-Sync-Key: <SYNC_SECRET>
 * Body (per-review or array):
 *   {
 *     clientId: "prime-iv",
 *     placeId: "ChIJ...",            (optional)
 *     locationName: "Prime IV Niceville",
 *     reviews: [
 *       {
 *         googleReviewId: "unique-id-from-google",
 *         authorName: "Jane Doe",
 *         authorPhotoUrl: "https://...",
 *         rating: 5,                 (1-5)
 *         reviewText: "Amazing clinic!",
 *         reviewLanguage: "en",
 *         reviewDate: "2026-04-12T14:30:00Z",
 *         replyText: "Thanks Jane!", (optional)
 *         replyDate: "2026-04-13T09:00:00Z", (optional)
 *       },
 *       ...
 *     ]
 *   }
 *
 * Upserts by (client_id, google_review_id). Make can re-run the scenario
 * daily and only new reviews insert; existing ones update if their text
 * or reply changed.
 *
 * Returns: { inserted, updated, total }
 *
 * ── GET /api/google-reviews?clientId=prime-iv ──
 * Returns list of reviews + rolling stats for display on the dashboard.
 */

function authed(req: NextRequest): boolean {
  const syncKey = process.env.SYNC_SECRET;
  if (!syncKey) return true; // allow in dev if not set
  return req.headers.get('x-sync-key') === syncKey;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const clientId: string = data?.clientId;
  const placeId: string | null = data?.placeId || null;
  const locationName: string | null = data?.locationName || null;
  const reviews: any[] = Array.isArray(data?.reviews) ? data.reviews : Array.isArray(data) ? data : [data];
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  let inserted = 0;
  let updated = 0;
  for (const r of reviews) {
    if (!r || !r.googleReviewId || r.rating == null) continue;
    const res = await query<{ inserted: boolean }>(
      `insert into google_reviews (
         client_id, google_review_id, author_name, author_photo_url, rating,
         review_text, review_language, review_date, reply_text, reply_date,
         location_name, place_id, synced_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
       on conflict (client_id, google_review_id) do update set
         author_name = excluded.author_name,
         author_photo_url = excluded.author_photo_url,
         rating = excluded.rating,
         review_text = excluded.review_text,
         review_language = excluded.review_language,
         review_date = excluded.review_date,
         reply_text = excluded.reply_text,
         reply_date = excluded.reply_date,
         location_name = excluded.location_name,
         place_id = excluded.place_id,
         synced_at = now()
       returning (xmax = 0) as inserted`,
      [
        clientId,
        String(r.googleReviewId),
        r.authorName || null,
        r.authorPhotoUrl || null,
        Number(r.rating) || 0,
        r.reviewText || null,
        r.reviewLanguage || null,
        r.reviewDate ? new Date(r.reviewDate).toISOString() : null,
        r.replyText || null,
        r.replyDate ? new Date(r.replyDate).toISOString() : null,
        locationName,
        placeId,
      ],
    );
    if (res.rows[0]?.inserted) inserted++;
    else updated++;
  }

  return NextResponse.json({ inserted, updated, total: reviews.length });
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const limit = Math.min(100, Number(req.nextUrl.searchParams.get('limit')) || 25);

  const { rows: reviews } = await query(
    `select google_review_id, author_name, author_photo_url, rating, review_text,
            review_date, reply_text, reply_date, location_name, synced_at
       from google_reviews
      where client_id = $1
      order by review_date desc nulls last, synced_at desc
      limit $2`,
    [clientId, limit],
  );

  const { rows: summary } = await query<{
    total: string;
    avg_rating: string;
    last_7d: string;
    last_30d: string;
    five_star: string;
    four_star: string;
    three_star: string;
    two_star: string;
    one_star: string;
  }>(
    `select
       count(*) as total,
       coalesce(avg(rating), 0)::numeric(3,2) as avg_rating,
       count(*) filter (where review_date >= now() - interval '7 days') as last_7d,
       count(*) filter (where review_date >= now() - interval '30 days') as last_30d,
       count(*) filter (where rating = 5) as five_star,
       count(*) filter (where rating = 4) as four_star,
       count(*) filter (where rating = 3) as three_star,
       count(*) filter (where rating = 2) as two_star,
       count(*) filter (where rating = 1) as one_star
       from google_reviews where client_id = $1`,
    [clientId],
  );

  return NextResponse.json({
    reviews,
    summary: summary[0] || null,
  });
}
