import { query } from '@/lib/db';

/**
 * Recurring team-task materialization.
 *
 * Templates (team_task_templates) describe tasks that repeat; this module
 * turns them into real team_tasks rows exactly once per period, using
 * team_task_spawns as the idempotency log:
 *
 *   monthly        → one instance per template per calendar month
 *                    (period_key 'YYYY-MM'), due on due_day of that month
 *                    (or the last day of the month when unset).
 *   per_new_client → one instance per template per client
 *                    (period_key = client id), due due_day days after it
 *                    spawns (default 7).
 *
 * Every caller path funnels through here — the lazy materialization on the
 * Team Tasks page load, the manual "generate now"/"apply to client" buttons,
 * and the hook in client creation — so a task can never double-spawn no
 * matter how many of those fire together.
 */

export type TaskTemplate = {
  id: string;
  title: string;
  description: string | null;
  assignee_email: string | null;
  recurrence: string;
  due_day: number | null;
  priority: string;
  active: boolean;
};

/** 'YYYY-MM' for the current month (UTC — matches the DB's current_date). */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Materialize every active monthly template for the given month ('YYYY-MM').
 * Safe to call on every page load. Returns how many new tasks were created.
 */
export async function spawnMonthlyTasks(monthKey: string): Promise<number> {
  const { rows: templates } = await query<TaskTemplate>(
    `select * from team_task_templates where recurrence = 'monthly' and active = true`,
  );
  let created = 0;
  for (const t of templates) {
    // Claim the (template, month) slot first; only the claimer inserts.
    const claim = await query(
      `insert into team_task_spawns (template_id, period_key) values ($1, $2)
       on conflict do nothing returning template_id`,
      [t.id, monthKey],
    );
    if (claim.rows.length === 0) continue;
    // Due date: due_day of the month (clamped to 28 to survive February),
    // else the last day of the month.
    await query(
      `insert into team_tasks (title, description, assignee_email, due_date, priority, status, recurrence, template_id, created_by)
       values ($1, $2, $3,
               case when $4::int is not null
                    then make_date(split_part($5,'-',1)::int, split_part($5,'-',2)::int, least($4::int, 28))
                    else (to_date($5 || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date
               end,
               $6, 'todo', 'monthly', $7, $8)`,
      [t.title, t.description, t.assignee_email, t.due_day, monthKey, t.priority, t.id, 'recurring:monthly'],
    );
    created++;
  }
  return created;
}

/**
 * Materialize per-new-client templates for one client. Called automatically
 * when a client is created, and manually from the "apply to client" button.
 * Pass templateId to apply just one template. Returns how many were created.
 */
export async function spawnClientTasks(clientId: string, clientName?: string, templateId?: string): Promise<number> {
  const { rows: templates } = await query<TaskTemplate>(
    templateId
      ? `select * from team_task_templates where recurrence = 'per_new_client' and active = true and id = $1`
      : `select * from team_task_templates where recurrence = 'per_new_client' and active = true`,
    templateId ? [templateId] : [],
  );
  let created = 0;
  for (const t of templates) {
    const claim = await query(
      `insert into team_task_spawns (template_id, period_key) values ($1, $2)
       on conflict do nothing returning template_id`,
      [t.id, clientId],
    );
    if (claim.rows.length === 0) continue;
    const title = clientName ? `${t.title} — ${clientName}` : t.title;
    await query(
      `insert into team_tasks (title, description, assignee_email, client_id, due_date, priority, status, recurrence, template_id, created_by)
       values ($1, $2, $3, $4, current_date + coalesce($5::int, 7), $6, 'todo', 'per_new_client', $7, $8)`,
      [title, t.description, t.assignee_email, clientId, t.due_day, t.priority, t.id, 'recurring:per_new_client'],
    );
    created++;
  }
  return created;
}
