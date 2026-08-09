import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getLocationByGhlId } from '@/lib/ai-crm/locations';
import { postReviewReply } from '@/lib/ai-crm/reviews';
import { audit } from '@/lib/ai-crm/engine';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Human actions on a queued review reply. Session-authenticated.
 *
 * POST /api/ai-crm/reviews/:id
 *   { action: "approve", text? }  → post reply (edited text wins)
 *   { action: "reject" }          → discard
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action: string = body?.action;

  let actor = 'staff';
  try {
    const { data } = await createClient().auth.getUser();
    actor = data.user?.email || 'staff';
  } catch {}

  const { rows } = await query<any>(`select * from ai_review_queue where id = $1`, [params.id]);
  const review = rows[0];
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'reject') {
    await query(`update ai_review_queue set status = 'rejected', updated_at = now() where id = $1`, [params.id]);
    await audit({ ghlLocationId: review.ghl_location_id, reviewId: params.id, event: 'review_reply_rejected', actor });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    if (['auto_posted', 'posted'].includes(review.status)) {
      return NextResponse.json({ error: 'Already posted' }, { status: 409 });
    }
    const text = String(body?.text || review.suggested_response || '').trim();
    if (!text) return NextResponse.json({ error: 'Nothing to post' }, { status: 400 });
    const loc = await getLocationByGhlId(review.ghl_location_id);
    if (!loc) return NextResponse.json({ error: 'Unknown location' }, { status: 400 });
    try {
      await postReviewReply(loc, review.google_review_name, text);
      await query(
        `update ai_review_queue set status = 'posted', final_response = $2, posted_at = now(), updated_at = now() where id = $1`,
        [params.id, text],
      );
      await audit({ ghlLocationId: review.ghl_location_id, reviewId: params.id, event: 'review_reply_posted', detail: { edited: text !== review.suggested_response }, actor });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      const err = String(e?.message || e).slice(0, 400);
      await query(`update ai_review_queue set error = $2, updated_at = now() where id = $1`, [params.id, err]);
      return NextResponse.json({ error: err }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
