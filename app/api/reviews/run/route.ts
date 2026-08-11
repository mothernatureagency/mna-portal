import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { draftReplies } from '@/lib/review-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scheduled Google-review auto-responder. Runs 1–2×/day (Vercel Cron).
 * Drafts an on-brand reply for every new, unreplied review, then:
 *   - 5★  → reply_status 'auto'    (ready for Make.com to post)
 *   - <5★ → reply_status 'flagged' (waits for human approval in the portal)
 * Never posts to Google itself — the Make.com scenario reads /api/reviews/pending.
 * Secret-gated (CRON_SECRET bearer or ?secret=SEED_SECRET).
 */

async function businessNameFor(clientId: string, fallback: string | null): Promise<string> {
  const s = staticClients.find((c) => c.id === clientId);
  if (s) return s.name;
  const { rows } = await query<{ name: string }>(`select name from custom_clients where id = $1`, [clientId]);
  return rows[0]?.name || fallback || 'our business';
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const authHeader = req.headers.get('authorization') || '';
  const secret = req.nextUrl.searchParams.get('secret') || '';
  const okCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const okSecret = !!process.env.SEED_SECRET && secret === process.env.SEED_SECRET;
  if (!okCron && !okSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set', drafted: 0 }, { status: 200 });

  // New reviews with no reply yet (Google hasn't one, and we haven't drafted).
  const { rows: due } = await query<any>(
    `select id, client_id, google_review_id, author_name, rating, review_text, location_name
       from google_reviews
      where coalesce(reply_status, '') = ''
        and coalesce(reply_text, '') = ''
      order by review_date desc nulls last
      limit 60`,
  );
  if (due.length === 0) return NextResponse.json({ drafted: 0, auto: 0, flagged: 0, considered: 0 });

  // Group by client so each batch drafts with the right business name.
  const byClient = new Map<string, any[]>();
  for (const r of due) { if (!byClient.has(r.client_id)) byClient.set(r.client_id, []); byClient.get(r.client_id)!.push(r); }

  let auto = 0, flagged = 0, failed = 0;
  for (const [clientId, list] of Array.from(byClient.entries())) {
    const businessName = await businessNameFor(clientId, list[0]?.location_name || null);
    let drafts: { index: number; reply: string }[] = [];
    try {
      drafts = await draftReplies(businessName, list.map((r) => ({ author: r.author_name, rating: r.rating, text: r.review_text })));
    } catch { failed += list.length; continue; }
    const byIndex = new Map(drafts.map((d) => [d.index, d.reply]));
    for (let i = 0; i < list.length; i++) {
      const reply = byIndex.get(i);
      if (!reply) { failed++; continue; }
      const status = Number(list[i].rating) >= 5 ? 'auto' : 'flagged';
      await query(
        `update google_reviews set reply_text = $1, reply_status = $2, reply_drafted_at = now() where id = $3`,
        [reply, status, list[i].id],
      );
      if (status === 'auto') auto++; else flagged++;
    }
  }

  return NextResponse.json({ drafted: auto + flagged, auto, flagged, failed, considered: due.length });
}
