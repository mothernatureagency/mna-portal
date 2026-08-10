import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { listReviews, GbpError } from '@/lib/google-business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/google-business/sync  { clientId }
 *
 * Pulls ALL reviews for the client's mapped GBP location using the OAuth
 * tokens of whoever saved the mapping, then upserts into google_reviews —
 * the same table the Make.com webhook fills, so GoogleReviewsCard and the
 * dashboards pick them up with zero changes.
 *
 * Staff only. Returns { inserted, updated, total }.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const meta = (user.user_metadata as Record<string, unknown> | null) || {};
  if (((meta.role as string) || 'staff') === 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clientId: string = body?.clientId;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { rows } = await query(
    `select value from client_kv where client_id = $1 and key = 'gbp_location'`,
    [clientId],
  );
  const mapping = rows[0]?.value as { email: string; account: string; location: string; title?: string } | undefined;
  if (!mapping?.email || !mapping?.account || !mapping?.location) {
    return NextResponse.json({ error: 'No Google Business Profile location mapped for this client yet' }, { status: 400 });
  }

  let reviews;
  try {
    reviews = await listReviews(mapping.email, mapping.account, mapping.location);
  } catch (e: any) {
    const status = e instanceof GbpError ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'Failed to fetch reviews' }, { status });
  }

  let inserted = 0;
  let updated = 0;
  for (const r of reviews) {
    if (!r.googleReviewId || !r.rating) continue;
    const res = await query<{ inserted: boolean }>(
      `insert into google_reviews (
         client_id, google_review_id, author_name, author_photo_url, rating,
         review_text, review_date, reply_text, reply_date,
         location_name, place_id, synced_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       on conflict (client_id, google_review_id) do update set
         author_name = excluded.author_name,
         author_photo_url = excluded.author_photo_url,
         rating = excluded.rating,
         review_text = excluded.review_text,
         review_date = excluded.review_date,
         reply_text = excluded.reply_text,
         reply_date = excluded.reply_date,
         location_name = excluded.location_name,
         synced_at = now()
       returning (xmax = 0) as inserted`,
      [
        clientId,
        r.googleReviewId,
        r.authorName,
        r.authorPhotoUrl,
        r.rating,
        r.reviewText,
        r.reviewDate ? new Date(r.reviewDate).toISOString() : null,
        r.replyText,
        r.replyDate ? new Date(r.replyDate).toISOString() : null,
        mapping.title || null,
        null,
      ],
    );
    if (res.rows[0]?.inserted) inserted++;
    else updated++;
  }

  return NextResponse.json({ inserted, updated, total: reviews.length });
}
