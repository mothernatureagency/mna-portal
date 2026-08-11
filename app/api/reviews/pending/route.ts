import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Make.com integration for posting review replies back to Google.
 *
 * ── GET /api/reviews/pending ──
 * Header: X-Sync-Key: <SYNC_SECRET>
 * Returns replies cleared to post (5★ auto-approved, or human-approved):
 *   { pending: [ { clientId, googleReviewId, placeId, locationName, rating, replyText } ] }
 * The Make scenario posts each to Google, then calls POST below to mark it sent.
 *
 * ── POST /api/reviews/pending ──  (mark sent)
 * Header: X-Sync-Key: <SYNC_SECRET>
 * Body: { clientId, googleReviewId }  → sets reply_status='sent', reply_date=now.
 */

function authed(req: NextRequest): boolean {
  const key = process.env.SYNC_SECRET;
  return !!key && req.headers.get('x-sync-key') === key;
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query<any>(
    `select client_id, google_review_id, place_id, location_name, rating, reply_text
       from google_reviews
      where reply_status in ('auto', 'approved')
        and coalesce(reply_text, '') <> ''
      order by review_date asc nulls last
      limit 100`,
  );
  const pending = rows.map((r) => ({
    clientId: r.client_id,
    googleReviewId: r.google_review_id,
    placeId: r.place_id,
    locationName: r.location_name,
    rating: r.rating,
    replyText: r.reply_text,
  }));
  return NextResponse.json({ pending, count: pending.length });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clientId = (body?.clientId || '').toString();
  const googleReviewId = (body?.googleReviewId || '').toString();
  if (!clientId || !googleReviewId) return NextResponse.json({ error: 'clientId and googleReviewId required' }, { status: 400 });

  const { rows } = await query(
    `update google_reviews set reply_status = 'sent', reply_date = now()
      where client_id = $1 and google_review_id = $2 returning id`,
    [clientId, googleReviewId],
  );
  return NextResponse.json({ ok: true, updated: rows.length });
}
