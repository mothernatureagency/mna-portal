import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { spawnMonthlyTasks, spawnClientTasks, currentMonthKey } from '@/lib/team-tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Team Tasks — the Asana/Monday-style board for internal assignments.
 *
 * GET    /api/team-tasks
 *          Lazily materializes this month's recurring tasks first (idempotent),
 *          then returns { items, templates }. Every staff account can see the
 *          whole board; clients get 403.
 *
 * POST   /api/team-tasks
 *          One-off task:   { title, description?, assigneeEmail?, clientId?,
 *                            dueDate?, priority? }               (recurrence
 *                            omitted or 'one_time')
 *          Recurring:      { ..., recurrence: 'monthly'|'per_new_client',
 *                            dueDay? }
 *            'monthly'        also materializes this month's instance right away.
 *            'per_new_client' just stores the template — instances appear when
 *                             a client is added (or via the apply action below).
 *          Manual actions: { action: 'apply_client', templateId, clientId, clientName? }
 *                          { action: 'run_monthly' }   ← generate this month now
 *
 * PATCH  /api/team-tasks   { id, ...fields }         — update a task
 *                          { templateId, active }    — pause/resume a template
 * DELETE /api/team-tasks?id= | ?templateId=
 */

async function me(): Promise<{ role: string; email: string }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
    return { role, email: (user?.email || '').toLowerCase() };
  } catch { return { role: '', email: '' }; }
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES = ['todo', 'in_progress', 'done'];

export async function GET() {
  await ensureSchema();
  const { role } = await me();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  // Materialize this month's recurring tasks before reading — makes the board
  // self-maintaining without a cron. Never blocks the read.
  try { await spawnMonthlyTasks(currentMonthKey()); } catch { /* non-fatal */ }

  const [{ rows: items }, { rows: templates }] = await Promise.all([
    query(`select * from team_tasks order by (status = 'done') asc, due_date asc nulls last, created_at asc`),
    query(`select * from team_task_templates order by created_at asc`),
  ]);
  return NextResponse.json({ items, templates });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { role, email } = await me();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ── Manual recurring actions ──────────────────────────────────────
  const action = (body?.action || '').toString();
  if (action === 'run_monthly') {
    const created = await spawnMonthlyTasks(currentMonthKey());
    return NextResponse.json({ created });
  }
  if (action === 'apply_client') {
    const templateId = (body?.templateId || '').toString();
    const clientId = (body?.clientId || '').toString();
    const clientName = (body?.clientName || '').toString() || undefined;
    if (!templateId || !clientId) return NextResponse.json({ error: 'templateId and clientId required' }, { status: 400 });
    const created = await spawnClientTasks(clientId, clientName, templateId);
    return NextResponse.json({ created, alreadyApplied: created === 0 });
  }

  // ── Create a task or a recurring template ─────────────────────────
  const title = (body?.title || '').toString().trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const description = (body?.description || '').toString().trim() || null;
  const assigneeEmail = (body?.assigneeEmail || '').toString().trim().toLowerCase() || null;
  const clientId = (body?.clientId || '').toString().trim() || null;
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body?.dueDate || '') ? body.dueDate : null;
  const priority = PRIORITIES.includes(body?.priority) ? body.priority : 'normal';
  const recurrence = (body?.recurrence || 'one_time').toString();
  const dueDay = Number.isFinite(Number(body?.dueDay)) && Number(body?.dueDay) > 0 ? Math.min(31, Math.floor(Number(body.dueDay))) : null;

  if (recurrence === 'monthly' || recurrence === 'per_new_client') {
    const { rows } = await query(
      `insert into team_task_templates (title, description, assignee_email, recurrence, due_day, priority, created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [title, description, assigneeEmail, recurrence, dueDay, priority, email],
    );
    const template = rows[0];
    // A monthly task the owner creates today is wanted this month too.
    let created = 0;
    if (recurrence === 'monthly') {
      try { created = await spawnMonthlyTasks(currentMonthKey()); } catch { /* non-fatal */ }
    }
    return NextResponse.json({ template, created });
  }

  const { rows } = await query(
    `insert into team_tasks (title, description, assignee_email, client_id, due_date, priority, status, recurrence, created_by)
     values ($1,$2,$3,$4,$5,$6,'todo','one_time',$7) returning *`,
    [title, description, assigneeEmail, clientId, dueDate, priority, email],
  );
  return NextResponse.json({ item: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { role } = await me();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Pause / resume a recurring template.
  if (body?.templateId) {
    const { rows } = await query(
      `update team_task_templates set active = $1 where id = $2 returning *`,
      [body?.active !== false, (body.templateId || '').toString()],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ template: rows[0] });
  }

  const id = (body?.id || '').toString();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];
  if (body.title !== undefined) { values.push((body.title || '').toString().trim()); fields.push(`title = $${values.length}`); }
  if (body.description !== undefined) { values.push((body.description || '').toString().trim() || null); fields.push(`description = $${values.length}`); }
  if (body.assigneeEmail !== undefined) { values.push((body.assigneeEmail || '').toString().trim().toLowerCase() || null); fields.push(`assignee_email = $${values.length}`); }
  if (body.clientId !== undefined) { values.push((body.clientId || '').toString().trim() || null); fields.push(`client_id = $${values.length}`); }
  if (body.dueDate !== undefined) { values.push(/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate || '') ? body.dueDate : null); fields.push(`due_date = $${values.length}`); }
  if (body.priority !== undefined && PRIORITIES.includes(body.priority)) { values.push(body.priority); fields.push(`priority = $${values.length}`); }
  if (body.status !== undefined && STATUSES.includes(body.status)) {
    values.push(body.status); fields.push(`status = $${values.length}`);
    fields.push(body.status === 'done' ? `completed_at = now()` : `completed_at = null`);
  }
  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update team_tasks set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { role } = await me();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  const templateId = req.nextUrl.searchParams.get('templateId');
  if (templateId) {
    // Removing a template stops future spawns; tasks already created stay.
    await query('delete from team_task_templates where id = $1', [templateId]);
    return NextResponse.json({ ok: true });
  }
  if (!id) return NextResponse.json({ error: 'id or templateId required' }, { status: 400 });
  await query('delete from team_tasks where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
