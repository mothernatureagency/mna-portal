import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';

/**
 * Follow-up email drafting engine.
 *
 * Called in two places so drafts exist as soon as possible and never get
 * missed: the meeting-notes ingest fires it the moment a note is filed
 * (scoped to that client), and the Friday cron runs it unscoped as a
 * catch-up before auto-sending. One draft per note — re-runs skip clients
 * whose latest note already has a follow-up drafted after it.
 *
 * Drafts land in campaigns as status 'drafting' (campaign_type
 * 'follow_up') and appear on the Email Drafts page. The Friday cron
 * pushes anything still in 'drafting' out the door; approving earlier in
 * the UI sends sooner; changing a draft's status to anything else holds it.
 */

export async function draftFollowups(opts: { clientId?: string } = {}): Promise<{ drafted: number; skipped: number; failed: number; results: any[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { drafted: 0, skipped: 0, failed: 0, results: [{ error: 'ANTHROPIC_API_KEY not set' }] };
  const anthropic = new Anthropic({ apiKey });

  const params: any[] = [];
  let clientClause = '';
  if (opts.clientId) {
    params.push(opts.clientId);
    clientClause = ` and client_id = $${params.length}`;
  }
  const { rows: notes } = await query<any>(
    `select distinct on (client_id) id, client_id, to_char(meeting_date, 'YYYY-MM-DD') as meeting_date,
            title, summary, attendees, action_items, created_at
       from meeting_notes
      where created_at > now() - interval '8 days'${clientClause}
      order by client_id, created_at desc`,
    params,
  );

  const nameById = new Map<string, string>(staticClients.map((c) => [c.id, c.name]));
  try {
    const { rows } = await query<{ id: string; name: string }>(`select id, name from custom_clients`);
    for (const r of rows) if (!nameById.has(r.id)) nameById.set(r.id, r.name);
  } catch { /* fine */ }

  let drafted = 0, skipped = 0, failed = 0;
  const results: any[] = [];

  for (const note of notes) {
    try {
      const { rows: existing } = await query(
        `select id from campaigns where client_id = $1 and campaign_type = 'follow_up' and created_at >= $2 limit 1`,
        [note.client_id, note.created_at],
      );
      if (existing.length > 0) { skipped++; continue; }

      const clientName = nameById.get(note.client_id) || note.client_id;

      const [asksQ, contentQ] = await Promise.all([
        query(`select title from client_requests where client_id = $1 and status = 'open' order by created_at desc limit 6`, [note.client_id]).catch(() => ({ rows: [] as any[] })),
        query(
          `select count(*) filter (where cc.client_approval_status = 'pending_review' and cc.post_date >= current_date)::int as pending,
                  count(*) filter (where cc.post_date between current_date and current_date + 7)::int as this_week
             from content_calendar cc join projects p on p.id = cc.project_id
            where p.client_name = $1`,
          [clientName],
        ).catch(() => ({ rows: [{ pending: 0, this_week: 0 }] as any[] })),
      ]);
      const asks = (asksQ.rows as any[]).map((x) => String(x.title || '')).filter(Boolean);
      const content: any = contentQ.rows[0] || {};
      const actionItems = Array.isArray(note.action_items) ? note.action_items : [];

      const prompt = `Draft the weekly follow-up email from Alexus at Mother Nature Agency to her client ${clientName}, after their call on ${note.meeting_date}.

MEETING: ${note.title || 'Weekly call'}${note.attendees ? ` — attendees: ${note.attendees}` : ''}
SUMMARY OF THE CALL:
${(note.summary || '').slice(0, 2500)}

ACTION ITEMS FROM THE CALL:
${actionItems.length ? actionItems.map((a: any) => `- ${a.title} (${a.assignee === 'client' ? 'on the client' : `on our team${a.assignee && a.assignee !== 'team' ? ` — ${a.assignee}` : ''}`})`).join('\n') : '(none captured)'}

STILL WAITING ON THE CLIENT: ${asks.length ? asks.join('; ') : 'nothing'}
CONTENT: ${Number(content.pending || 0)} posts awaiting their approval; ${Number(content.this_week || 0)} going out in the next 7 days.

Write it ready to send: warm but efficient, first person from Alexus, no fluff, no invented facts — only what's above. Structure: quick thanks + one-line recap, decisions made, who's doing what (theirs vs ours, with any deadlines), what we need from them, what's shipping next week, sign-off "— Alexus, Mother Nature Agency". Plain text, no markdown.

Return ONLY strict JSON (no fences): { "subject": "...", "body": "..." }`;

      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });
      const out = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      const m = out.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      const subject = (parsed?.subject || `Follow-up from our ${note.meeting_date} call`).toString().slice(0, 200);
      const emailBody = (parsed?.body || '').toString().slice(0, 8000);
      if (!emailBody) throw new Error('empty draft');

      await query(
        `insert into campaigns (client_id, campaign_type, name, subject, body, status, client_visible)
         values ($1, 'follow_up', $2, $3, $4, 'drafting', false)`,
        [note.client_id, `Follow-up — ${clientName} — ${note.meeting_date}`, subject, emailBody],
      );
      drafted++;
      results.push({ clientId: note.client_id, subject });
    } catch (e: any) {
      failed++;
      results.push({ clientId: note.client_id, error: e?.message || 'draft failed' });
    }
  }

  return { drafted, skipped, failed, results };
}
