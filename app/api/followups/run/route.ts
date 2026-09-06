import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { draftFollowups } from '@/lib/followups';
import { getClientNotificationEmail } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Friday follow-up runner (Vercel Cron, 16:00 UTC = 11am Central).
 *
 * Drafting happens the moment a meeting note is ingested, so by Friday
 * the drafts have been sitting on the Email Drafts page all week. This
 * cron does two things:
 *
 * 1. Catch-up drafting for any note that somehow has no follow-up yet.
 * 2. AUTO-SEND: every follow_up campaign still in status 'drafting' is
 *    promoted to 'approved' and handed to the send rail (client_kv
 *    weekly_email_draft, which the Make Gmail scenario polls and sends).
 *
 * The human controls between ingest and Friday:
 *  - approve in the UI earlier → it sends sooner;
 *  - edit the draft → the edited version is what goes out;
 *  - change its status to anything other than 'drafting' → held, never
 *    auto-sent.
 * A client with no owner-contact email on file is skipped (reported), so
 * nothing fires into the void.
 *
 * Auth: Vercel Cron bearer, or ?secret=SEED_SECRET for manual runs.
 */

export async function GET(req: NextRequest) {
  await ensureSchema();

  const authHeader = req.headers.get('authorization') || '';
  const secret = req.nextUrl.searchParams.get('secret') || '';
  const okCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const okSecret = !!process.env.SEED_SECRET && secret === process.env.SEED_SECRET;
  if (!okCron && !okSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) Catch-up drafting.
  const drafting = await draftFollowups();

  // 2) Auto-send everything still sitting in 'drafting'.
  const { rows: pending } = await query<any>(
    `select id, client_id, subject, body from campaigns
      where campaign_type = 'follow_up' and status = 'drafting'
      order by created_at asc limit 40`,
  );

  let queued = 0, held = 0;
  const sendResults: any[] = [];
  for (const c of pending) {
    try {
      const to = await getClientNotificationEmail(c.client_id);
      if (!to) {
        held++;
        sendResults.push({ clientId: c.client_id, held: 'no client contact email on file' });
        continue;
      }
      await query(
        `insert into client_kv (client_id, key, value, updated_at)
         values ($1, 'weekly_email_draft', $2::jsonb, now())
         on conflict (client_id, key) do update set value = $2::jsonb, updated_at = now()`,
        [c.client_id, JSON.stringify({ subject: c.subject, body: c.body, to, status: 'approved', approvedAt: new Date().toISOString(), sentAt: null, campaignId: c.id })],
      );
      await query(`update campaigns set status = 'approved', approved_at = now() where id = $1`, [c.id]);
      queued++;
      sendResults.push({ clientId: c.client_id, to, queued: true });
    } catch (e: any) {
      sendResults.push({ clientId: c.client_id, error: e?.message || 'queue failed' });
    }
  }

  return NextResponse.json({ drafting, autoSend: { queued, held, considered: pending.length, results: sendResults } });
}
