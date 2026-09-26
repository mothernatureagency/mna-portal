import { query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { STAFF } from '@/lib/staff';
import { spawnMonthlyTasks, currentMonthKey } from '@/lib/team-tasks';
import { createCalendarEvent, isConnected } from '@/lib/google-calendar';
import { resolveAttendees } from '@/lib/contacts';
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

type ClientRef = { id: string; name: string; short_name: string | null };

/** Static roster (lib/clients.ts) plus clients staff added from the portal. */
async function allClients(): Promise<ClientRef[]> {
  const out: ClientRef[] = staticClients.map((c) => ({ id: c.id, name: c.name, short_name: c.shortName ?? null }));
  const seen = new Set(out.map((c) => c.id));
  try {
    const { rows } = await query<ClientRef>(`select id, name, short_name from custom_clients order by created_at asc`);
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
  const byName = staff.filter((s) => s.name.toLowerCase() === wanted || s.name.toLowerCase().split(/\s+/).includes(wanted));
  if (byName.length === 1) return byName[0].email;
  if (byName.length > 1) {
    throw new ToolError(`"${input}" matches more than one teammate: ${byName.map((s) => `${s.name} <${s.email}>`).join(', ')}. Pass the email.`);
  }
  // Looser fallbacks, in the order Jarvis used them before these tools moved
  // here — a partial first name ("sab") should still land on one person.
  const loose = staff.filter((s) => s.name.toLowerCase().startsWith(wanted)) ;
  if (loose.length === 1) return loose[0].email;
  const looser = staff.filter((s) => s.name.toLowerCase().includes(wanted));
  if (looser.length === 1) return looser[0].email;
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

/** Reject a write aimed at a client this token isn't allowed to touch. */
function requireClientAccess(identity: McpIdentity, clientId: string): void {
  if (identity.clientIds && !identity.clientIds.includes(clientId)) {
    throw new ToolError(`This token can only act on: ${identity.clientIds.join(', ')}.`);
  }
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

  // ── Task writes ─────────────────────────────────────────────────────

  {
    name: 'create_task',
    title: 'Create a team task',
    description:
      'Put a task on the team board, optionally assigned to a teammate with a deadline and priority. Also creates recurring work: repeat "monthly" re-creates it every month on its due day, and repeat "per_new_client" creates it whenever a client is onboarded. Use for "assign X to Sable", "give Vanessa a task due Friday", "every month remind us to…".',
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What needs doing.' },
        description: { type: 'string', description: 'Optional detail.' },
        assignee: { type: 'string', description: 'Teammate first name or email. Omit to leave it unassigned.' },
        client_id: { type: 'string', description: 'Client this is about. Use list_clients for valid ids.' },
        due_date: { type: 'string', description: 'Deadline as YYYY-MM-DD. One-time tasks only.' },
        priority: { type: 'string', enum: PRIORITIES, description: 'Default normal.' },
        repeat: { type: 'string', enum: ['one_time', 'monthly', 'per_new_client'], description: 'Default one_time.' },
        due_day: { type: 'integer', description: 'For monthly, the day of the month it falls due (1-28). For per_new_client, days after onboarding (default 7).' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const title = String(args.title || '').trim();
      if (!title) throw new ToolError('title is required');

      const assigneeEmail = args.assignee ? await resolveAssignee(String(args.assignee)) : null;
      const clientId = args.client_id ? await resolveClient(String(args.client_id)) : null;
      if (clientId) requireClientAccess(identity, clientId);

      const priority = PRIORITIES.includes(args.priority) ? args.priority : 'normal';
      const repeat = ['monthly', 'per_new_client'].includes(args.repeat) ? args.repeat : 'one_time';
      const description = args.description ? String(args.description) : null;

      if (repeat !== 'one_time') {
        const dueDay = Number(args.due_day) > 0 ? Math.min(31, Math.floor(Number(args.due_day))) : null;
        const { rows } = await query(
          `insert into team_task_templates (title, description, assignee_email, recurrence, due_day, priority, created_by)
           values ($1,$2,$3,$4,$5,$6,$7) returning *`,
          [title, description, assigneeEmail, repeat, dueDay, priority, identity.email],
        );
        let createdNow = 0;
        if (repeat === 'monthly') { try { createdNow = await spawnMonthlyTasks(currentMonthKey()); } catch { /* non-fatal */ } }
        return {
          template: rows[0],
          instances_created_now: createdNow,
          note: repeat === 'monthly'
            ? "Recurring monthly — this month's instance exists now; future months create themselves."
            : 'Will be created for every client onboarded from now on. Apply it to an existing client from the Team Tasks page.',
        };
      }

      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.due_date || '')) ? args.due_date : null;
      const { rows } = await query(
        `insert into team_tasks (title, description, assignee_email, client_id, due_date, priority, status, recurrence, created_by)
         values ($1,$2,$3,$4,$5,$6,'todo','one_time',$7) returning *`,
        [title, description, assigneeEmail, clientId, dueDate, priority, identity.email],
      );
      return { task: rows[0] };
    },
  },

  {
    name: 'update_task',
    title: 'Update a team task',
    description: 'Change a task on the board: mark it done or in progress, move the deadline, reassign it, or change its priority. Look the task up with list_tasks first to get its id.',
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The task id from list_tasks.' },
        status: { type: 'string', enum: STATUSES },
        due_date: { type: 'string', description: 'New deadline as YYYY-MM-DD.' },
        assignee: { type: 'string', description: 'Reassign to this teammate (first name or email).' },
        priority: { type: 'string', enum: PRIORITIES },
      },
      required: ['task_id'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const taskId = String(args.task_id || '').trim();
      if (!taskId) throw new ToolError('task_id is required');

      const sets: string[] = [];
      const params: any[] = [];
      if (args.status) {
        if (!STATUSES.includes(args.status)) throw new ToolError(`status must be one of ${STATUSES.join(', ')}`);
        params.push(args.status);
        sets.push(`status = $${params.length}`);
        sets.push(args.status === 'done' ? `completed_at = now()` : `completed_at = null`);
      }
      if (args.due_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.due_date))) throw new ToolError('due_date must be YYYY-MM-DD');
        params.push(args.due_date);
        sets.push(`due_date = $${params.length}`);
      }
      if (args.assignee) {
        params.push(await resolveAssignee(String(args.assignee)));
        sets.push(`assignee_email = $${params.length}`);
      }
      if (args.priority) {
        if (!PRIORITIES.includes(args.priority)) throw new ToolError(`priority must be one of ${PRIORITIES.join(', ')}`);
        params.push(args.priority);
        sets.push(`priority = $${params.length}`);
      }
      if (sets.length === 0) throw new ToolError('Nothing to update — pass at least one of status, due_date, assignee, priority.');

      params.push(taskId);
      const idParam = params.length;
      const scoped = clientScope(identity, 'client_id', params);
      const { rows } = await query(
        `update team_tasks set ${sets.join(', ')} where id::text = $${idParam}${scoped} returning *`,
        params,
      );
      if (!rows.length) throw new ToolError(`No task with id ${taskId} that this token can change.`);
      return { task: rows[0] };
    },
  },

  // ── Personal schedule (the caller's own, never anyone else's) ────────

  {
    name: 'add_event',
    title: 'Add a schedule event',
    description:
      'Put a meeting, call, task, deadline or reminder on the caller\'s own schedule. Use for "add a task", "set a meeting", "schedule a call", "remind me to". Syncs to Google Calendar and sends invites when the caller has Google connected.',
    scope: 'schedule:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What it is.' },
        event_date: { type: 'string', description: 'Date as YYYY-MM-DD.' },
        start_time: { type: 'string', description: 'Like "09:00" or "2:30 PM". Leave out for an all-day item.' },
        end_time: { type: 'string' },
        event_type: { type: 'string', enum: ['meeting', 'call', 'task', 'deadline', 'review', 'personal'] },
        priority: { type: 'string', enum: ['normal', 'high'] },
        description: { type: 'string' },
        client_id: { type: 'string', description: 'Client this relates to, if any.' },
        attendees: { type: 'string', description: 'Comma-separated names or emails to invite, e.g. "Justin, Sable".' },
        meeting_mode: { type: 'string', enum: ['google_meet', 'in_person', 'none'], description: 'Defaults to google_meet for meetings and calls, none otherwise.' },
        location: { type: 'string', description: 'Physical location for in-person meetings.' },
      },
      required: ['title', 'event_date', 'event_type'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const clientId = args.client_id ? await resolveClient(String(args.client_id)) : null;
      if (clientId) requireClientAccess(identity, clientId);

      const resolved = args.attendees ? await resolveAttendees(String(args.attendees)) : [];
      const attendeesStr = resolved.length ? resolved.map((a) => a.name || a.email).join(', ') : null;
      const meetingMode = args.meeting_mode || (['meeting', 'call'].includes(args.event_type) ? 'google_meet' : 'none');

      const { rows } = await query<any>(
        `insert into schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees, meeting_mode, location)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [identity.email, clientId, args.title, args.description || null, args.event_date, args.start_time || null,
         args.end_time || null, args.event_type, args.priority || 'normal', attendeesStr, meetingMode, args.location || null],
      );

      let googleSync: any = null;
      try {
        if (await isConnected(identity.email)) {
          googleSync = await createCalendarEvent(identity.email, {
            title: args.title,
            description: args.description || undefined,
            date: args.event_date,
            startTime: args.start_time || undefined,
            endTime: args.end_time || undefined,
            eventType: args.event_type,
            attendees: resolved.filter((a) => a.email),
            meetingMode,
            location: args.location || undefined,
          });
          if (googleSync?.meetLink) {
            await query(`update schedule_events set meet_link = $1 where id = $2`, [googleSync.meetLink, rows[0].id]);
            rows[0].meet_link = googleSync.meetLink;
          }
        }
      } catch { /* the event is saved either way — Google sync is a bonus */ }

      return {
        event: rows[0],
        attendees_invited: resolved.filter((a) => a.email).map((a) => a.email),
        google_calendar_synced: googleSync?.success || false,
        meet_link: googleSync?.meetLink || null,
      };
    },
  },

  {
    name: 'list_events',
    title: 'List schedule events',
    description: "The caller's own schedule for a date or a range. Use for \"what's on my schedule\", \"what do I have today/tomorrow/this week\".",
    scope: 'schedule:read',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'A single day, YYYY-MM-DD.' },
        from: { type: 'string', description: 'Range start, YYYY-MM-DD.' },
        to: { type: 'string', description: 'Range end, YYYY-MM-DD.' },
      },
      additionalProperties: false,
    },
    async handler(args, identity) {
      const params: any[] = [identity.email];
      let where = 'user_email = $1';
      for (const [key, op] of [['date', '='], ['from', '>='], ['to', '<=']] as const) {
        if (args[key]) { params.push(args[key]); where += ` and event_date ${op} $${params.length}`; }
      }
      const { rows } = await query(
        `select * from schedule_events where ${where} order by event_date asc, start_time asc nulls last limit 20`,
        params,
      );
      return { count: rows.length, events: rows };
    },
  },

  {
    name: 'complete_event',
    title: 'Complete a schedule event',
    description: 'Mark one of the caller\'s own schedule events as done. Use for "done with X", "finished X".',
    scope: 'schedule:write',
    inputSchema: {
      type: 'object',
      properties: { event_id: { type: 'string', description: 'The event id from list_events.' } },
      required: ['event_id'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const { rows } = await query(
        `update schedule_events set completed = true where id::text = $1 and user_email = $2 returning *`,
        [String(args.event_id || ''), identity.email],
      );
      if (!rows.length) throw new ToolError('No such event on this schedule.');
      return { event: rows[0] };
    },
  },

  {
    name: 'delete_event',
    title: 'Delete a schedule event',
    description: 'Remove one of the caller\'s own schedule events. Use for "cancel X", "remove X".',
    scope: 'schedule:write',
    inputSchema: {
      type: 'object',
      properties: { event_id: { type: 'string', description: 'The event id from list_events.' } },
      required: ['event_id'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const { rows } = await query(
        `delete from schedule_events where id::text = $1 and user_email = $2 returning id`,
        [String(args.event_id || ''), identity.email],
      );
      if (!rows.length) throw new ToolError('No such event on this schedule.');
      return { deleted: rows[0].id };
    },
  },

  // ── Personal memory ─────────────────────────────────────────────────

  {
    name: 'remember',
    title: 'Remember something',
    description: 'Store a note in the caller\'s long-term memory. Use when they say "remember that…", "note that…", "keep in mind…", or share something they want kept.',
    scope: 'memory:write',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'What to remember.' },
        category: { type: 'string', description: 'Optional grouping, e.g. "preferences" or "clients". Default general.' },
      },
      required: ['content'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const content = String(args.content || '').trim();
      if (!content) throw new ToolError('content is required');
      const { rows } = await query(
        `insert into assistant_memory (user_email, category, content) values ($1,$2,$3) returning *`,
        [identity.email, args.category || 'general', content],
      );
      return { memory: rows[0] };
    },
  },

  {
    name: 'recall',
    title: 'Recall a memory',
    description: 'Search the caller\'s stored notes. Use for "what did I say about…", "do you remember…".',
    scope: 'memory:read',
    inputSchema: {
      type: 'object',
      properties: { search: { type: 'string', description: 'Word or topic to look for.' } },
      required: ['search'],
      additionalProperties: false,
    },
    async handler(args, identity) {
      const { rows } = await query(
        `select * from assistant_memory where user_email = $1 and content ilike $2 order by created_at desc limit 10`,
        [identity.email, `%${String(args.search || '')}%`],
      );
      return { count: rows.length, memories: rows };
    },
  },

  // ── Marketing pipeline ──────────────────────────────────────────────

  {
    name: 'list_campaigns',
    title: 'List campaigns',
    description: 'Email and SMS campaigns with their status and scheduled dates. Use when asked about campaigns, sends, or what is waiting for review.',
    scope: 'marketing:read',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Client id or part of the name.' },
        status: { type: 'string', description: 'drafting, pending_review, approved or sent.' },
      },
      additionalProperties: false,
    },
    async handler(args, identity) {
      const params: any[] = [];
      const where: string[] = [];
      if (args.client) { params.push(await resolveClient(String(args.client))); where.push(`client_id = $${params.length}`); }
      if (args.status) { params.push(String(args.status)); where.push(`status = $${params.length}`); }
      const scoped = clientScope(identity, 'client_id', params);
      const { rows } = await query(
        `select id, client_id, campaign_type, name, subject, scheduled_date, status, created_at
           from campaigns where ${where.join(' and ') || 'true'}${scoped}
          order by scheduled_date desc limit 20`,
        params,
      );
      return { count: rows.length, campaigns: rows };
    },
  },

  {
    name: 'list_content',
    title: 'List content calendar posts',
    description: 'Social posts on the content calendar, with their approval status. Use when asked about upcoming posts, the content calendar, or what is waiting on client review.',
    scope: 'marketing:read',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Client id or part of the name.' },
        status: { type: 'string', description: 'pending_review, approved or changes_requested.' },
        from: { type: 'string', description: 'Earliest post date, YYYY-MM-DD.' },
        to: { type: 'string', description: 'Latest post date, YYYY-MM-DD.' },
      },
      additionalProperties: false,
    },
    async handler(args, identity) {
      // content_calendar reaches its client through projects.client_name, which
      // stores the DISPLAY name — so a client id has to be translated first.
      const roster = await allClients();
      const nameFor = (id: string) => roster.find((c) => c.id === id)?.name;

      const params: any[] = [];
      const where: string[] = [];
      if (args.client) {
        const id = await resolveClient(String(args.client));
        requireClientAccess(identity, id);
        params.push(nameFor(id));
        where.push(`p.client_name = $${params.length}`);
      } else if (identity.clientIds) {
        params.push(identity.clientIds.map(nameFor).filter(Boolean));
        where.push(`p.client_name = any($${params.length})`);
      }
      if (args.status) { params.push(String(args.status)); where.push(`cc.client_approval_status = $${params.length}`); }
      if (args.from) { params.push(args.from); where.push(`cc.post_date >= $${params.length}`); }
      if (args.to) { params.push(args.to); where.push(`cc.post_date <= $${params.length}`); }

      const { rows } = await query(
        `select cc.id, p.client_name, cc.title, cc.post_date, cc.platform, cc.content_type,
                cc.status, cc.client_approval_status, cc.caption
           from content_calendar cc join projects p on p.id = cc.project_id
          where ${where.join(' and ') || 'true'}
          order by cc.post_date asc limit 25`,
        params,
      );
      return { count: rows.length, posts: rows };
    },
  },
];

export function toolsFor(identity: McpIdentity): McpTool[] {
  return MCP_TOOLS.filter((t) => identity.scopes.includes(t.scope));
}

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
