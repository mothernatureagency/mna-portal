import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { replyToReview, GbpError } from '@/lib/google-business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/google-business/reply  { clientId, googleReviewId, reply }
 *
 * Publishes (or updates) the owner reply on a Google review through the
 * Business Profile API, then mirrors it onto the google_reviews row so
 * the dashboard reflects it immediately. Staff only.
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
  const googleReviewId: string = body?.googleReviewId;
  const reply: string = (body?.reply || '').toString().trim();
  if (!clientId || !googleReviewId || !reply) {
    return NextResponse.json({ error: 'clientId, googleReviewId, and reply required' }, { status: 400 });
  }
  if (reply.length > 4096) {
    return NextResponse.json({ error: 'Reply too long (Google caps replies at 4096 characters)' }, { status: 400 });
  }

  const { rows } = await query(
    `select value from client_kv where client_id = $1 and key = 'gbp_location'`,
    [clientId],
  );
  const mapping = rows[0]?.value as { email: string; account: string; location: string } | undefined;
  if (!mapping?.email || !mapping?.account || !mapping?.location) {
    return NextResponse.json({ error: 'No Google Business Profile location mapped for this client yet' }, { status: 400 });
  }

  try {
    await replyToReview(mapping.email, mapping.account, mapping.location, googleReviewId, reply);
  } catch (e: any) {
    const status = e instanceof GbpError ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'Failed to post reply' }, { status });
  }

  await query(
    `update google_reviews set reply_text = $1, reply_date = now(), synced_at = now()
      where client_id = $2 and google_review_id = $3`,
    [reply, clientId, googleReviewId],
  );

  return NextResponse.json({ ok: true });
}
