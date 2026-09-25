import { query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { STAFF } from '@/lib/staff';
import { spawnMonthlyTasks, currentMonthKey } from '@/lib/team-tasks';
import type { McpIdentity, McpScope } from '@/lib/mcp/auth';

/**
 * The MCP tool surface over the portal.
 *
 * Deliberately coarse: the portal has ~100 API routes, and one tool per route
 * would bury a model in choices it can't rank. Each tool here answers a
 * question someone actually asks ("what's Sable carrying?", "what's late?"),
 * and reads straight from lib/ so there is no second copy of the rules.
 *
 * Every tool declares the scope it needs; the route refuses the call and hides
 * the tool from tools/list when the caller's token lacks it.
 */

/** A failure the model should see and can recover from (bad client id, etc.). */
export class ToolError extends Error {}

export type McpTool = {
  name: string;
  title: string;
  description: string;
  scope: McpScope;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, any>, identity: McpIdentity) => Promise<unknown>;
};

// ── Shared lookups ────────────────────────────────────────────────────

type ClientRef = { id: string; name: string };

/** Static roster (lib/clients.ts) plus clients staff added from the portal. */
async function allClients(): Promise<ClientRef[]> {
  const out: ClientRef[] = staticClients.map((c) => ({ id: c.id, name: c.name }));
  const seen = new Set(out.map((c) => c.id));
  try {
    const { rows } = await query<ClientRef>(`select id, name from custom_clients order by created_at asc`);
    for (const r of rows) if (!seen.has(r.id)) { out.push(r); seen.add(r.id); }
  } catch { /* table may not exist yet on a cold database */ }
  return out;
}

type StaffRef = { email: string; name: string; role: string };

/** Built-in roster (lib/staff.ts) plus teammates added from the portal. */
async function allStaff(): Promise<StaffRef[]> {
  const out: StaffRef[] = STAFF.map((s) => ({ email: s.email.toLowerCase(), name: s.name, role: s.role }));
  const seen = new Set(out.map((s) => s.email));
  try {
    const { rows } = await query<{ email: string; name: string; role: string | null }>(
      `select email, name, role from staff_members order by created_at asc`,
    );
    for (const r of rows) {
      const email = (r.email || '').toLowerCase();
      if (!email || seen.has(email)) continue;
      out.push({ email, name: r.name, role: r.role || 'Staff' });
      seen.add(email);
    }
  } catch { /* non-fatal */ }
  return out;
}

/**
 * Turn "sable", "Sable", or an email into the email the board stores.
 * Throws with the valid options rather than silently returning nothing, so a
 * model that guessed a name gets told the real ones instead of "0 tasks".
 */
async function resolveAssignee(input: string): Promise<string> {
  const wanted = input.trim().toLowerCase();
  const staff = await allStaff();
  const byEmail = staff.find((s) => s.email === wanted);
  if (byEmail) return byEmail.email;
  if (wanted.includes('@')) return wanted; // an address we don't know — let it match nothing
  const byName = staff.filter((s) => s.name.toLowerCase().split(/\s+/).includes(wanted) || s.name.toLowerCase() === wanted);
  if (byName.length === 1) return byName[0].email;
  if (byName.length > 1) {
    throw new ToolError(`"${input}" matches more than one teammate: ${byName.map((s) => `${s.name} <${s.email}>`).join(', ')}. Pass the email.`);
  }
  throw new ToolError(`No teammate matches "${input}". Known: ${staff.map((s) => `${s.name} <${s.email}>`).join(', ')}.`);
}

async function resolveClient(input: string): Promise<string> {
  const wanted = input.trim().toLowerCase();
  const list = await allClients();
  const byId = list.find((c) => c.id.toLowerCase() === wanted);
  if (byId) return byId.id;
  const byName = list.filter((c) => c.name.toLowerCase().includes(wanted));
  if (byName.length === 1) return byName[0].id;
  if (byName.length > 1) {
    throw new ToolError(`"${input}" matches more than one client: ${byName.map((c) => c.id).join(', ')}. Pass the id.`);
  }
  throw new ToolError(`No client matches "${input}". Known ids: ${list.map((c) => c.id).join(', ')}.`);
}

/**
 * Recurring tasks are materialized lazily on read — the same thing the Team
 * Tasks page does on load (see lib/team-tasks.ts). Without it, an agent asking
 * on the 1st would see last month's board. Idempotent via team_task_spawns.
 */
async function materializeRecurring(): Promise<void> {
  try { await spawnMonthlyTasks(currentMonthKey()); } catch { /* never block a read */ }
}

/**
 * SQL fragment restricting rows to the clients this token may read.
 * A token scoped to specific clients does NOT see internal tasks that have no
 * client attached — those are agency business, not that client's.
 */
function clientScope(identity: McpIdentity, column: string, params: any[]): string {
  if (!identity.clientIds) return '';
  params.push(identity.clientIds);
  return ` and ${column} = any($${params.length})`;
}

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// ── Tools ─────────────────────────────────────────────────────────────

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'list_tasks',
    title: 'List team tasks',
    description:
      "Search the agency's internal task board (the Team Tasks page). Use this to answer anything about what the team is working on, what is assigned to a person, what is due, or what is late. Filters combine with AND; omit them all to get the whole board. Returns tasks with assignee, client, due date, priority and status.",
    scope: 'tasks:read',
    inputSchema: {
      type: 'object',
      properties: {
        assignee: { type: 'string', description: 'Teammate email, or a first name like "Sable". Omit for everyone. Pass "unassigned" for tasks with no owner.' },
        client: { type: 'string', description: 'Client id (e.g. "prime-iv") or part of the client name. Omit for all clients.' },
        status: { type: 'string', enum: STATUSES, description: 'Omit to get open work only (todo + in_progress). Pass "done" for completed tasks.' },
        priority: { type: 'string', enum: PRIORITIES },
        overdue: { type: 'boolean', description: 'True returns only unfinished tasks whose due date has passed.' },
        search: { type: 'string', description: 'Case-insensitive match against the task title and description.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Default 50.' },
      },
      additionalProperties: false,
    },
    async handler(args, identity) {
      await materializeRecurring();
      const params: any[] = [];
      const where: string[] = [];

      if (typeof args.assignee === 'string' && args.assignee.trim()) {
        if (args.assignee.trim().toLowerCase() === 'unassigned') {
          where.push(`(assignee_email is null or assignee_email = '')`);
        } else {
          params.push(await resolveAssignee(args.assignee));
          where.push(`lower(assignee_email) = $${params.length}`);
        }
      }
      if (typeof args.client === 'string' && args.client.trim()) {
        params.push(await resolveClient(args.client));
        where.push(`client_id = $${params.length}`);
      }
      if (typeof args.status === 'string' && args.status) {
        if (!STATUSES.includes(args.status)) throw new ToolError(`status must be one of ${STATUSES.join(', ')}`);
        params.push(args.status);
        where.push(`status = $${params.length}`);
      } else {
        where.push(`status <> 'done'`);
      }
      if (typeof args.priority === 'string' && args.priority) {
        if (!PRIORITIES.includes(args.priority)) throw new ToolError(`priority must be one of ${PRIORITIES.join(', ')}`);
        params.push(args.priority);
        where.push(`priority = $${params.length}`);
      }
      if (args.overdue === true) where.push(`due_date is not null and due_date < current_date and status <> 'done'`);
      if (typeof args.search === 'string' && args.search.trim()) {
        params.push(`%${args.search.trim()}%`);
        where.push(`(title ilike $${params.length} or coalesce(description,'') ilike $${params.length})`);
      }

      const scoped = clientScope(identity, 'client_id', params);
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
      params.push(limit);

      const { rows } = await query(
        `select id, title, description, assignee_email, client_id, due_date, priority, status,
                recurrence, created_at, completed_at,
                (due_date is not null and due_date < current_date and status <> 'done') as overdue
           from team_tasks
          where ${where.join(' and ') || 'true'}${scoped}
          order by (status = 'done') asc, due_date asc nulls last, created_at asc
          limit $${params.length}`,
        params,
      );
      return { count: rows.length, truncated: rows.length === limit, tasks: rows };
    },
  },

  {
    name: 'get_task',
    title: 'Get one task',
    description: 'Full detail for a single task by its id, including the recurring template it came from when it was spawned by one. Use after list_tasks when you need the description or provenance of a specific task.',
    scope: 'tasks:read',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'The task id (a UUID) from list_tasks.' } },
      required: ['task_id'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const id = String(args.task_id || '').trim();
      if (!id) throw new ToolError('task_id is required');
      const params: any[] = [id];
      const scoped = clientScope(identity, 'client_id', params);
      const { rows } = await query<any>(
        `select *, (due_date is not null and due_date < current_date and status <> 'done') as overdue
           from team_tasks where id::text = $1${scoped} limit 1`,
        params,
      );
      const task = rows[0];
      if (!task) throw new ToolError(`No task with id ${id} that this token can read.`);
      let template = null;
      if (task.template_id) {
        const t = await query(`select id, title, recurrence, due_day, active from team_task_templates where id = $1`, [task.template_id]);
        template = t.rows[0] || null;
      }
      return { task, template };
    },
  },

  {
    name: 'team_workload',
    title: 'Team workload',
    description:
      "Per-teammate summary of the board: how many tasks are open, how many are overdue, how many fall due in the next seven days, and how many were completed this month. Use this to answer 'who is overloaded', 'is anyone behind', or before assigning new work.",
    scope: 'tasks:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler(_args, identity) {
      await materializeRecurring();
      const params: any[] = [];
      const scoped = clientScope(identity, 'client_id', params);
      const { rows } = await query<any>(
        `select coalesce(lower(nullif(assignee_email, '')), '(unassigned)') as assignee_email,
                count(*) filter (where status <> 'done')                                            as open_tasks,
                count(*) filter (where status <> 'done' and due_date < current_date)                as overdue,
                count(*) filter (where status <> 'done' and due_date between current_date and current_date + 7) as due_next_7_days,
                count(*) filter (where status = 'done' and completed_at >= date_trunc('month', current_date)) as done_this_month
           from team_tasks
          where true${scoped}
          group by 1
          order by overdue desc, open_tasks desc`,
        params,
      );
      const staff = await allStaff();
      const byEmail = new Map(staff.map((s) => [s.email, s]));
      const seen = new Set(rows.map((r) => r.assignee_email));
      // Teammates with a clean board still belong in the answer — otherwise
      // "who has capacity" silently excludes the person with nothing on.
      for (const s of staff) {
        if (!seen.has(s.email)) rows.push({ assignee_email: s.email, open_tasks: '0', overdue: '0', due_next_7_days: '0', done_this_month: '0' });
      }
      return {
        month: currentMonthKey(),
        workload: rows.map((r) => ({
          name: byEmail.get(r.assignee_email)?.name || (r.assignee_email === '(unassigned)' ? 'Unassigned' : r.assignee_email),
          role: byEmail.get(r.assignee_email)?.role || null,
          email: r.assignee_email === '(unassigned)' ? null : r.assignee_email,
          open_tasks: Number(r.open_tasks),
          overdue: Number(r.overdue),
          due_next_7_days: Number(r.due_next_7_days),
          done_this_month: Number(r.done_this_month),
        })),
      };
    },
  },

  {
    name: 'whats_blocked',
    title: "What's blocked",
    description:
      "The standing 'what needs attention right now' report: overdue team tasks, open tasks nobody owns, and client requests that have been sitting open. Use this for a status check, a standup, or when asked what is slipping. Costs one call and replaces several list_tasks queries.",
    scope: 'tasks:read',
    inputSchema: {
      type: 'object',
      properties: { stale_after_days: { type: 'integer', minimum: 1, maximum: 120, description: 'How old an open client request must be to count as stale. Default 7.' } },
      additionalProperties: false,
    },
    async handler(args, identity) {
      await materializeRecurring();
      const staleDays = Math.min(Math.max(Number(args.stale_after_days) || 7, 1), 120);

      const p1: any[] = [];
      const s1 = clientScope(identity, 'client_id', p1);
      const overdue = await query(
        `select id, title, assignee_email, client_id, due_date, priority, status,
                (current_date - due_date) as days_overdue
           from team_tasks
          where status <> 'done' and due_date is not null and due_date < current_date${s1}
          order by due_date asc limit 50`,
        p1,
      );

      const p2: any[] = [];
      const s2 = clientScope(identity, 'client_id', p2);
      const unowned = await query(
        `select id, title, client_id, due_date, priority
           from team_tasks
          where status <> 'done' and (assignee_email is null or assignee_email = '')${s2}
          order by due_date asc nulls last limit 50`,
        p2,
      );

      const p3: any[] = [staleDays];
      const s3 = clientScope(identity, 'client_id', p3);
      const stale = await query(
        `select id, client_id, title, assigned_to, created_at,
                extract(day from now() - created_at)::int as days_open
           from client_requests
          where status = 'open' and created_at < now() - ($1 || ' days')::interval${s3}
          order by created_at asc limit 50`,
        p3,
      );

      return {
        as_of: new Date().toISOString().slice(0, 10),
        overdue_tasks: { count: overdue.rows.length, items: overdue.rows },
        unassigned_tasks: { count: unowned.rows.length, items: unowned.rows },
        stale_client_requests: { count: stale.rows.length, stale_after_days: staleDays, items: stale.rows },
      };
    },
  },

  {
    name: 'list_staff',
    title: 'List teammates',
    description: 'The agency roster: every teammate, their role, and the email the task board uses to identify them. Call this before assigning work or filtering by a person so you use a real address.',
    scope: 'tasks:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      return { staff: await allStaff() };
    },
  },

  {
    name: 'list_clients',
    title: 'List clients',
    description: 'Every client id and name the portal knows about. Client ids are the values used by the `client` filter on the other tools.',
    scope: 'tasks:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler(_args, identity) {
      const list = await allClients();
      const visible = identity.clientIds ? list.filter((c) => identity.clientIds!.includes(c.id)) : list;
      return { clients: visible, scoped: identity.clientIds !== null };
    },
  },
];

export function toolsFor(identity: McpIdentity): McpTool[] {
  return MCP_TOOLS.filter((t) => identity.scopes.includes(t.scope));
}

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
