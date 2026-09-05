import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { STAFF } from '@/lib/staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Meeting-notes ingest — the webhook end of the Google → portal pipeline.
 *
 * POST { secret, title, text, date? }
 *
 * Make.com watches the Drive folder where Gemini's "take notes for me"
 * docs land after Google Meet calls, and posts each new doc here raw.
 * This endpoint does the smart part portal-side: figures out which client
 * the meeting was about, distills a summary, pulls out attendees and
 * action items (with owners), then files it into meeting_notes — which
 * also auto-creates client_requests for the action items, exactly like a
 * hand-entered note. Same-title-same-day docs are deduped so a re-run
 * never double-files.
 *
 * Auth: shared secret (SEED_SECRET) — this route is outside cookie auth
 * so Make can reach it.
 */

export async function POST(req: NextRequest) {
  await ensureSchema();

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const secret = (body?.secret || req.nextUrl.searchParams.get('secret') || '').toString();
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const docTitle = (body?.title || '').toString().trim().slice(0, 300);
  const text = (body?.text || '').toString().trim();
  const dateHint = /^\d{4}-\d{2}-\d{2}/.test(body?.date || '') ? String(body.date).slice(0, 10) : '';
  if (!text || text.length < 40) return NextResponse.json({ error: 'text required (the meeting notes body)' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // Client + team rosters for classification and task assignment.
  let clientList = staticClients.map((c) => ({ id: c.id, name: c.name }));
  try {
    const { rows } = await query<{ id: string; name: string }>(`select id, name from custom_clients`);
    clientList = [...clientList, ...rows.filter((r) => !clientList.some((c) => c.id === r.id))];
  } catch { /* statics still work */ }
  let team = STAFF.map((s) => ({ name: s.name.split(' ')[0], email: s.email.toLowerCase() }));
  try {
    const { rows } = await query<{ email: string; name: string }>(`select email, name from staff_members`);
    for (const r of rows) {
      const e = (r.email || '').toLowerCase();
      if (e && !team.some((t) => t.email === e)) team.push({ name: (r.name || e.split('@')[0]).split(' ')[0], email: e });
    }
  } catch { /* fine */ }

  const anthropic = new Anthropic({ apiKey });
  const prompt = `You are filing a Google Meet notes document into Mother Nature Agency's portal. Today is ${new Date().toISOString().slice(0, 10)}.

CLIENTS (id = name):
${clientList.map((c) => `- ${c.id} = ${c.name}`).join('\n')}

TEAM (assignedTo emails):
${team.map((t) => `- ${t.name} <${t.email}>`).join('\n')}

DOC TITLE: ${docTitle || '(untitled)'}
${dateHint ? `DOC DATE HINT: ${dateHint}` : ''}

DOC BODY:
"""
${text.slice(0, 12000)}
"""

Return ONLY strict JSON (no fences):
{
  "clientId": "<best-matching client id, or 'mna' if internal/unclear>",
  "meetingDate": "YYYY-MM-DD",
  "title": "<short human title for the meeting>",
  "summary": "<5-8 sentences: what was discussed, decisions made, numbers mentioned, next steps>",
  "attendees": "<comma-separated names, or ''>",
  "actionItems": [{ "title": "<the task>", "assignee": "<'client' if it's on the client, else the team member's first name, else 'team'>", "assignedTo": "<team member email or null>" }]
}`;

  let parsed: any;
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const out = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = out.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  } catch (e: any) {
    return NextResponse.json({ error: `Could not parse the notes: ${e?.message || 'AI error'}` }, { status: 500 });
  }
  if (!parsed) return NextResponse.json({ error: 'The AI did not return valid JSON' }, { status: 500 });

  const clientId = clientList.some((c) => c.id === parsed.clientId) ? parsed.clientId : 'mna';
  const meetingDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.meetingDate || '') ? parsed.meetingDate : (dateHint || new Date().toISOString().slice(0, 10));
  const title = (parsed.title || docTitle || 'Meeting notes').toString().slice(0, 200);
  const summary = (parsed.summary || '').toString().slice(0, 4000) || text.slice(0, 1500);
  const attendees = (parsed.attendees || '').toString().slice(0, 300) || null;
  const actionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems
        .map((a: any) => ({
          title: String(a?.title || '').trim().slice(0, 200),
          assignee: String(a?.assignee || 'team').slice(0, 40),
          assignedTo: team.some((t) => t.email === String(a?.assignedTo || '').toLowerCase()) ? String(a.assignedTo).toLowerCase() : null,
        }))
        .filter((a: any) => a.title)
        .slice(0, 10)
    : [];

  // Dedupe: the same doc posted twice files once.
  const { rows: dupe } = await query(
    `select id from meeting_notes where client_id = $1 and meeting_date = $2 and title = $3 limit 1`,
    [clientId, meetingDate, title],
  );
  if (dupe.length > 0) return NextResponse.json({ ok: true, deduped: true, noteId: dupe[0].id });

  const { rows } = await query(
    `insert into meeting_notes (client_id, meeting_date, title, summary, attendees, action_items)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [clientId, meetingDate, title, summary, attendees, actionItems.length ? JSON.stringify(actionItems) : null],
  );

  // Action items become open asks, same as a hand-entered note.
  let tasksCreated = 0;
  for (const item of actionItems) {
    try {
      await query(
        `insert into client_requests (client_id, title, description, assigned_to) values ($1, $2, $3, $4)`,
        [clientId, item.title, `From ${meetingDate} call${item.assignee === 'client' ? ' — waiting on client' : ' — internal task'} (auto-filed from Google Meet notes)`, item.assignedTo],
      );
      tasksCreated++;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, noteId: rows[0]?.id, clientId, meetingDate, tasksCreated });
}
