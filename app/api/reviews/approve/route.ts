import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Staff approval for flagged (<5★) review replies.
 *
 * POST { clientId, googleReviewId, action, replyText? }
 *   action 'approve' → reply_status 'approved' (Make will post it); saves replyText if given
 *   action 'save'    → update the draft text, keep it flagged
 *   action 'reject'  → reply_status 'rejected' (won't be posted)
 */
async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can approve replies' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clientId = (body?.clientId || '').toString();
  const googleReviewId = (body?.googleReviewId || '').toString();
  const action = (body?.action || '').toString();
  const replyText = body?.replyText != null ? String(body.replyText) : null;
  if (!clientId || !googleReviewId) return NextResponse.json({ error: 'clientId and googleReviewId required' }, { status: 400 });

  let status: string;
  if (action === 'approve') status = 'approved';
  else if (action === 'reject') status = 'rejected';
  else if (action === 'save') status = 'flagged';
  else return NextResponse.json({ error: 'action must be approve, save, or reject' }, { status: 400 });

  const sets = ['reply_status = $3'];
  const vals: any[] = [clientId, googleReviewId, status];
  if (replyText !== null) { vals.push(replyText); sets.push(`reply_text = $${vals.length}`); }

  const { rows } = await query(
    `update google_reviews set ${sets.join(', ')} where client_id = $1 and google_review_id = $2 returning id`,
    vals,
  );
  return NextResponse.json({ ok: true, updated: rows.length, status });
}
