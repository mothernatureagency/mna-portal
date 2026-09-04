import { NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { clients as staticClients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Command Center feed — one call returns everything the Jarvis dashboard
 * shows, so the page can poll a single endpoint for near-real-time panels:
 * team workload + overdue, the caller's upcoming schedule, the content
 * pipeline per client, campaign backlog, and the client roster size.
 */

async function me(): Promise<{ role: string; email: string }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
    return { role, email: (user?.email || '').toLowerCase() };
  } catch { return { role: '', email: '' }; }
}

export async function GET() {
  await ensureSchema();
  const { role, email } = await me();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);

  const [tasksQ, scheduleQ, contentQ, campaignsQ, customClientsQ] = await Promise.all([
    query(
      `select id, title, assignee_email, client_id, to_char(due_date, 'YYYY-MM-DD') as due_date, priority, status, recurrence
         from team_tasks where status <> 'done'
        order by due_date asc nulls last, created_at asc limit 200`,
    ),
    query(
      `select id, title, to_char(event_date, 'YYYY-MM-DD') as event_date, start_time, end_time, event_type, priority, client_id
         from schedule_events
        where lower(user_email) = $1 and event_date between current_date and current_date + 3
          and coalesce(completed, false) = false
        order by event_date asc, start_time asc nulls last limit 12`,
      [email],
    ),
    query(
      `select p.client_name,
              count(*) filter (where cc.client_approval_status = 'pending_review' and cc.post_date >= current_date) as pending,
              count(*) filter (where cc.post_date between current_date and current_date + 7) as this_week,
              to_char(min(cc.post_date) filter (where cc.post_date >= current_date), 'YYYY-MM-DD') as next_post
         from content_calendar cc join projects p on p.id = cc.project_id
        group by p.client_name
       having count(*) filter (where cc.post_date >= current_date - 30) > 0
        order by p.client_name asc`,
    ),
    query(
      `select count(*)::int as pending from campaigns where status in ('drafting', 'pending_review')`,
    ).catch(() => ({ rows: [{ pending: 0 }] })),
    query(`select count(*)::int as n from custom_clients`).catch(() => ({ rows: [{ n: 0 }] })),
  ]);

  const tasks = tasksQ.rows as Array<{ id: string; title: string; assignee_email: string | null; client_id: string | null; due_date: string | null; priority: string; status: string; recurrence: string }>;
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);

  const byMember = new Map<string, { open: number; overdue: number }>();
  for (const t of tasks) {
    const key = (t.assignee_email || 'unassigned').toLowerCase();
    const cur = byMember.get(key) || { open: 0, overdue: 0 };
    cur.open++;
    if (t.due_date && t.due_date < today) cur.overdue++;
    byMember.set(key, cur);
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    today,
    tasks: {
      open: tasks.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      byMember: Array.from(byMember, ([emailKey, v]) => ({ email: emailKey, ...v })),
      overdueList: overdue.slice(0, 8),
      todayList: dueToday.slice(0, 8),
      upcoming: tasks.filter((t) => t.due_date && t.due_date >= today).slice(0, 10),
    },
    schedule: scheduleQ.rows,
    content: contentQ.rows,
    campaignsPending: Number((campaignsQ.rows[0] as any)?.pending || 0),
    clientCount: staticClients.length + Number((customClientsQ.rows[0] as any)?.n || 0),
  });
}
