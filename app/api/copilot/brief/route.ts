import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { clients as staticClients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pre-call brief for the Call Copilot's Meeting Mode.
 *
 * GET /api/copilot/brief?clientId=chill-house
 *   → { brief, agenda }
 *
 * Deterministic (no AI call — instant): pulls the client's last meeting
 * note, open asks of the client, open team tasks, and content-calendar
 * status, then assembles a facts block for the copilot prompt and a
 * ready-to-run agenda the teleprompter tracks during the call.
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const clientId = (req.nextUrl.searchParams.get('clientId') || '').trim();
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  // Resolve the display name (static or custom client).
  let clientName = staticClients.find((c) => c.id === clientId)?.name || '';
  if (!clientName) {
    const { rows } = await query<{ name: string }>(`select name from custom_clients where id = $1 limit 1`, [clientId]);
    clientName = rows[0]?.name || clientId;
  }

  const [lastNoteQ, requestsQ, teamTasksQ, contentQ] = await Promise.all([
    query(`select * from meeting_notes where client_id = $1 order by meeting_date desc, created_at desc limit 1`, [clientId]).catch(() => ({ rows: [] as any[] })),
    query(`select title from client_requests where client_id = $1 and status = 'open' order by created_at desc limit 5`, [clientId]).catch(() => ({ rows: [] as any[] })),
    query(
      `select title, assignee_email, to_char(due_date, 'YYYY-MM-DD') as due_date from team_tasks
        where client_id = $1 and status <> 'done' order by due_date asc nulls last limit 6`,
      [clientId],
    ).catch(() => ({ rows: [] as any[] })),
    query(
      `select count(*) filter (where cc.client_approval_status = 'pending_review' and cc.post_date >= current_date)::int as pending,
              count(*) filter (where cc.post_date between current_date and current_date + 7)::int as this_week,
              to_char(min(cc.post_date) filter (where cc.post_date >= current_date), 'YYYY-MM-DD') as next_post
         from content_calendar cc join projects p on p.id = cc.project_id
        where p.client_name = $1`,
      [clientName],
    ).catch(() => ({ rows: [] as any[] })),
  ]);

  const note: any = lastNoteQ.rows[0] || null;
  const noteText = note
    ? [note.title, note.summary, note.content, note.notes].filter((v) => typeof v === 'string' && v.trim()).join(' — ').slice(0, 600)
    : '';
  const noteDate = note?.meeting_date ? String(note.meeting_date).slice(0, 10) : '';

  const asks = (requestsQ.rows as any[]).map((x) => String(x.title || '')).filter(Boolean);
  const tasks = (teamTasksQ.rows as any[]);
  const content: any = contentQ.rows[0] || {};
  const pending = Number(content.pending || 0);
  const thisWeek = Number(content.this_week || 0);

  // The facts block the copilot grounds itself in during the call.
  const brief = [
    `CLIENT: ${clientName}`,
    noteText ? `LAST MEETING${noteDate ? ` (${noteDate})` : ''}: ${noteText}` : 'LAST MEETING: no notes on file.',
    `CONTENT: ${pending} post${pending === 1 ? '' : 's'} awaiting client approval; ${thisWeek} scheduled this week${content.next_post ? `; next post ${content.next_post}` : ''}.`,
    asks.length ? `WAITING ON CLIENT: ${asks.join('; ')}` : '',
    tasks.length ? `OPEN TEAM TASKS: ${tasks.map((t) => `${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('; ')}` : '',
  ].filter(Boolean).join('\n');

  // The agenda the teleprompter walks through and checks off.
  const agenda: string[] = [
    'Open — wins and highlights since last call',
    ...(noteText ? ['Follow up on last meeting’s action items'] : []),
    pending > 0
      ? `Content review — ${pending} post${pending === 1 ? '' : 's'} need approval (${thisWeek} going out this week)`
      : 'Content — what’s coming this month',
    ...asks.slice(0, 3).map((a) => `Still need from client: ${a}`),
    ...(tasks.length ? [`Status on ${tasks.length} open team item${tasks.length === 1 ? '' : 's'}`] : []),
    'New assignments and deadlines',
    'Next steps — confirm the follow-up and book the next call',
  ];

  return NextResponse.json({ brief, agenda, clientName });
}
