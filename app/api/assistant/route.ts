import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { createCalendarEvent, isConnected } from '@/lib/google-calendar';
import { resolveAttendees, getContactsForPrompt } from '@/lib/contacts';
import { spawnMonthlyTasks, currentMonthKey } from '@/lib/team-tasks';
import { STAFF } from '@/lib/staff';
import { clients as staticClients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Tool definitions for Claude ──────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'add_event',
    description: 'Add a new event, task, meeting, or deadline to the schedule. Use this when the user says things like "add a task", "set a meeting", "schedule a call", "remind me to", etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title of the event or task' },
        event_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        start_time: { type: 'string', description: 'Start time like "09:00" or "2:30 PM". Optional.' },
        end_time: { type: 'string', description: 'End time. Optional.' },
        event_type: { type: 'string', enum: ['meeting', 'call', 'task', 'deadline', 'review', 'personal'], description: 'Type of event' },
        priority: { type: 'string', enum: ['normal', 'high'], description: 'Priority level' },
        description: { type: 'string', description: 'Optional description or notes' },
        client_id: { type: 'string', description: 'Client ID if related to a specific client (prime-iv, prime-iv-pinecrest, serenity-bayfront, mna-realty, mna). Optional.' },
        attendees: { type: 'string', description: 'Comma-separated list of attendee names or emails to invite. e.g. "Justin, Sable" or "jkulkusky@primeivhydration.com". Optional.' },
        meeting_mode: { type: 'string', enum: ['google_meet', 'in_person', 'none'], description: 'Set to "google_meet" to auto-generate a Google Meet link, "in_person" for physical meetings, or "none" for tasks/deadlines. Default: "none" for tasks, "google_meet" for calls/meetings.' },
        location: { type: 'string', description: 'Physical location for in-person meetings. Optional.' },
      },
      required: ['title', 'event_date', 'event_type'],
    },
  },
  {
    name: 'list_events',
    description: 'Get schedule events for a date or date range. Use this when the user asks "what\'s on my schedule", "what do I have today/tomorrow/this week", etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Specific date YYYY-MM-DD' },
        from: { type: 'string', description: 'Start of range YYYY-MM-DD' },
        to: { type: 'string', description: 'End of range YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'complete_event',
    description: 'Mark an event or task as completed. Use when user says "done with X", "mark X complete", "finished X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        event_id: { type: 'string', description: 'UUID of the event to complete' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'delete_event',
    description: 'Delete/remove an event from the schedule. Use when user says "cancel X", "remove X", "delete X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        event_id: { type: 'string', description: 'UUID of the event to delete' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'remember',
    description: 'Store something in long-term memory. Use when the user says "remember that...", "note that...", "keep in mind...", or shares any information they want saved.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'What to remember' },
        category: { type: 'string', enum: ['client', 'personal', 'business', 'preference', 'general'], description: 'Category for the memory' },
      },
      required: ['content'],
    },
  },
  {
    name: 'recall',
    description: 'Search memories for something the user previously asked to remember. Use when user says "what did I say about...", "do you remember...", "what\'s the note about...".',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Search term or topic to look up in memories' },
      },
      required: ['search'],
    },
  },
  {
    name: 'list_campaigns',
    description: 'Get campaigns status, upcoming deadlines, or campaign details. Use when user asks about email/SMS campaigns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'Filter by client. Optional.' },
        status: { type: 'string', description: 'Filter by status (drafting, pending_review, approved, sent). Optional.' },
      },
      required: [],
    },
  },
  {
    name: 'list_content',
    description: 'Get content calendar posts, upcoming posts, or posts needing review. Use when user asks about social media content, posts, or the content calendar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'Filter by client (project_id). Optional.' },
        status: { type: 'string', description: 'Filter by approval status (pending_review, approved, changes_requested). Optional.' },
        from: { type: 'string', description: 'Start date YYYY-MM-DD. Optional.' },
        to: { type: 'string', description: 'End date YYYY-MM-DD. Optional.' },
      },
      required: [],
    },
  },
  {
    name: 'create_team_task',
    description: 'Assign a task to a team member on the Team Tasks board, with a deadline and priority. Also creates recurring tasks: repeat "monthly" auto-creates it every month on its due day, and repeat "per_new_client" auto-creates it whenever a new client is onboarded. Use for "assign X to Sable", "give Vanessa a task due Friday", "every month remind us to...", "whenever we sign a new client, have someone...".',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional details' },
        assignee: { type: 'string', description: 'Team member first name or email (e.g. "Sable"). Optional — omit for unassigned.' },
        client_id: { type: 'string', description: 'Client this task is about. Use list_clients for valid ids. Optional.' },
        due_date: { type: 'string', description: 'Deadline YYYY-MM-DD for one-time tasks. Optional.' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Default normal.' },
        repeat: { type: 'string', enum: ['one_time', 'monthly', 'per_new_client'], description: 'Default one_time.' },
        due_day: { type: 'number', description: 'For monthly: day of month it is due (1-28). For per_new_client: days after onboarding (default 7).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_team_tasks',
    description: 'See the team\'s assigned tasks and deadlines from the Team Tasks board. Use for "what\'s on Sable\'s plate", "what\'s overdue", "what is the team working on". Returns open tasks (to do + in progress) unless a status is given.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: { type: 'string', description: 'Filter to one team member by first name or email. Optional.' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Filter by status. Optional.' },
        overdue_only: { type: 'boolean', description: 'Only tasks past their deadline and not done.' },
        client_id: { type: 'string', description: 'Filter by client. Optional.' },
      },
      required: [],
    },
  },
  {
    name: 'update_team_task',
    description: 'Update a team task: mark it done or in progress, change the deadline, reassign it, or change priority. Get the task_id from list_team_tasks first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'UUID of the task' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        due_date: { type: 'string', description: 'New deadline YYYY-MM-DD' },
        assignee: { type: 'string', description: 'Reassign to this team member (first name or email)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'list_clients',
    description: 'List every client in the portal (built-in and custom) with their ids. Use when you need a client_id or the user mentions a client you don\'t recognize.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
];

// ── Team helpers ─────────────────────────────────────────────────────

/** Static staff + anyone added to the roster, deduped by email. */
async function teamDirectory(): Promise<Array<{ email: string; name: string }>> {
  const seen = new Map<string, string>();
  for (const s of STAFF) seen.set(s.email.toLowerCase(), s.name);
  try {
    const { rows } = await query(`select email, name from staff_members`);
    for (const r of rows) if (r.email) seen.set(r.email.toLowerCase(), r.name || r.email);
  } catch { /* roster table empty/unavailable — statics still work */ }
  return Array.from(seen, ([email, name]) => ({ email, name }));
}

/** "Sable" / "sable@..." → the roster email, or null when nobody matches. */
async function resolveTeamEmail(nameOrEmail: string): Promise<string | null> {
  const v = (nameOrEmail || '').trim().toLowerCase();
  if (!v) return null;
  if (v.includes('@')) return v;
  const dir = await teamDirectory();
  const hit = dir.find((d) => d.name.toLowerCase() === v)
    || dir.find((d) => d.name.toLowerCase().split(/\s+/)[0] === v)
    || dir.find((d) => d.name.toLowerCase().startsWith(v))
    || dir.find((d) => d.name.toLowerCase().includes(v));
  return hit?.email || null;
}

// ── Tool execution ───────────────────────────────────────────────────

async function executeTool(name: string, input: any, userEmail: string): Promise<string> {
  await ensureSchema();

  switch (name) {
    case 'add_event': {
      // Resolve attendees from names/emails
      const resolvedAttendees = input.attendees ? await resolveAttendees(input.attendees) : [];
      const attendeesStr = resolvedAttendees.length > 0
        ? resolvedAttendees.map(a => a.name || a.email).join(', ')
        : null;

      // Default meeting_mode: google_meet for calls/meetings, none for tasks/deadlines
      const meetingMode = input.meeting_mode ||
        (['meeting', 'call'].includes(input.event_type) ? 'google_meet' : 'none');

      const { rows } = await query(
        `INSERT INTO schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees, meeting_mode, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [userEmail, input.client_id || null, input.title, input.description || null, input.event_date, input.start_time || null, input.end_time || null, input.event_type, input.priority || 'normal', attendeesStr, meetingMode, input.location || null]
      );

      // Push to Google Calendar if connected (with attendees + Meet link)
      let googleSync = null;
      try {
        const connected = await isConnected(userEmail);
        if (connected) {
          googleSync = await createCalendarEvent(userEmail, {
            title: input.title,
            description: input.description || undefined,
            date: input.event_date,
            startTime: input.start_time || undefined,
            endTime: input.end_time || undefined,
            eventType: input.event_type,
            attendees: resolvedAttendees.filter(a => a.email),
            meetingMode,
            location: input.location || undefined,
          });

          // Store Meet link if generated
          if (googleSync?.meetLink) {
            await query('UPDATE schedule_events SET meet_link = $1 WHERE id = $2', [googleSync.meetLink, rows[0].id]);
            rows[0].meet_link = googleSync.meetLink;
          }
        }
      } catch {}

      return JSON.stringify({
        success: true,
        event: rows[0],
        attendees_invited: resolvedAttendees.filter(a => a.email).map(a => a.email),
        google_calendar_synced: googleSync?.success || false,
        meet_link: googleSync?.meetLink || null,
      });
    }

    case 'list_events': {
      let where = 'user_email = $1';
      const params: any[] = [userEmail];
      if (input.date) {
        params.push(input.date);
        where += ` AND event_date = $${params.length}`;
      }
      if (input.from) {
        params.push(input.from);
        where += ` AND event_date >= $${params.length}`;
      }
      if (input.to) {
        params.push(input.to);
        where += ` AND event_date <= $${params.length}`;
      }
      const { rows } = await query(
        `SELECT * FROM schedule_events WHERE ${where} ORDER BY event_date ASC, start_time ASC NULLS LAST LIMIT 20`,
        params
      );
      return JSON.stringify({ events: rows, count: rows.length });
    }

    case 'complete_event': {
      const { rows } = await query(
        `UPDATE schedule_events SET completed = true WHERE id = $1 AND user_email = $2 RETURNING *`,
        [input.event_id, userEmail]
      );
      return rows.length > 0
        ? JSON.stringify({ success: true, event: rows[0] })
        : JSON.stringify({ success: false, error: 'Event not found' });
    }

    case 'delete_event': {
      await query(
        `DELETE FROM schedule_events WHERE id = $1 AND user_email = $2`,
        [input.event_id, userEmail]
      );
      return JSON.stringify({ success: true });
    }

    case 'remember': {
      const { rows } = await query(
        `INSERT INTO assistant_memory (user_email, category, content) VALUES ($1, $2, $3) RETURNING *`,
        [userEmail, input.category || 'general', input.content]
      );
      return JSON.stringify({ success: true, memory: rows[0] });
    }

    case 'recall': {
      const { rows } = await query(
        `SELECT * FROM assistant_memory WHERE user_email = $1 AND content ILIKE $2 ORDER BY created_at DESC LIMIT 10`,
        [userEmail, `%${input.search}%`]
      );
      return JSON.stringify({ memories: rows, count: rows.length });
    }

    case 'list_campaigns': {
      let where = '1=1';
      const params: any[] = [];
      if (input.client_id) {
        params.push(input.client_id);
        where += ` AND client_id = $${params.length}`;
      }
      if (input.status) {
        params.push(input.status);
        where += ` AND status = $${params.length}`;
      }
      const { rows } = await query(
        `SELECT id, client_id, campaign_type, name, subject, scheduled_date, status, created_at
         FROM campaigns WHERE ${where} ORDER BY scheduled_date DESC LIMIT 10`,
        params
      );
      return JSON.stringify({ campaigns: rows, count: rows.length });
    }

    case 'list_content': {
      let where = '1=1';
      const params: any[] = [];
      if (input.status) {
        params.push(input.status);
        where += ` AND client_approval_status = $${params.length}`;
      }
      if (input.from) {
        params.push(input.from);
        where += ` AND post_date >= $${params.length}`;
      }
      if (input.to) {
        params.push(input.to);
        where += ` AND post_date <= $${params.length}`;
      }
      const { rows } = await query(
        `SELECT id, title, post_date, platform, content_type, status, client_approval_status, caption
         FROM content_calendar WHERE ${where} ORDER BY post_date ASC LIMIT 15`,
        params
      );
      return JSON.stringify({ posts: rows, count: rows.length });
    }

    case 'create_team_task': {
      const assigneeEmail = input.assignee ? await resolveTeamEmail(input.assignee) : null;
      if (input.assignee && !assigneeEmail) {
        return JSON.stringify({ success: false, error: `No team member matches "${input.assignee}" — ask the user which teammate they mean.` });
      }
      const priority = ['low', 'normal', 'high', 'urgent'].includes(input.priority) ? input.priority : 'normal';
      const repeat = ['monthly', 'per_new_client'].includes(input.repeat) ? input.repeat : 'one_time';

      if (repeat !== 'one_time') {
        const dueDay = Number(input.due_day) > 0 ? Math.min(31, Math.floor(Number(input.due_day))) : null;
        const { rows } = await query(
          `insert into team_task_templates (title, description, assignee_email, recurrence, due_day, priority, created_by)
           values ($1,$2,$3,$4,$5,$6,$7) returning *`,
          [input.title, input.description || null, assigneeEmail, repeat, dueDay, priority, userEmail],
        );
        let createdNow = 0;
        if (repeat === 'monthly') {
          try { createdNow = await spawnMonthlyTasks(currentMonthKey()); } catch { /* non-fatal */ }
        }
        return JSON.stringify({
          success: true,
          template: rows[0],
          instances_created_now: createdNow,
          note: repeat === 'monthly'
            ? 'Recurring monthly — this month\'s instance was just created; future months auto-create.'
            : 'Will auto-create for every new client onboarded from now on. It can be applied to an existing client from the Team Tasks page\'s Recurring panel.',
        });
      }

      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date || '') ? input.due_date : null;
      const { rows } = await query(
        `insert into team_tasks (title, description, assignee_email, client_id, due_date, priority, status, recurrence, created_by)
         values ($1,$2,$3,$4,$5,$6,'todo','one_time',$7) returning *`,
        [input.title, input.description || null, assigneeEmail, input.client_id || null, dueDate, priority, userEmail],
      );
      return JSON.stringify({ success: true, task: rows[0] });
    }

    case 'list_team_tasks': {
      let where = '1=1';
      const params: any[] = [];
      if (input.assignee) {
        const e = await resolveTeamEmail(input.assignee);
        if (!e) return JSON.stringify({ tasks: [], count: 0, error: `No team member matches "${input.assignee}"` });
        params.push(e);
        where += ` and lower(coalesce(assignee_email, '')) = $${params.length}`;
      }
      if (input.status) {
        params.push(input.status);
        where += ` and status = $${params.length}`;
      } else {
        where += ` and status <> 'done'`;
      }
      if (input.overdue_only) where += ` and due_date < current_date and status <> 'done'`;
      if (input.client_id) {
        params.push(input.client_id);
        where += ` and client_id = $${params.length}`;
      }
      const { rows } = await query(
        `select id, title, description, assignee_email, client_id, to_char(due_date, 'YYYY-MM-DD') as due_date, priority, status, recurrence
           from team_tasks where ${where}
          order by due_date asc nulls last, created_at asc limit 40`,
        params,
      );
      return JSON.stringify({ tasks: rows, count: rows.length, today: new Date().toISOString().slice(0, 10) });
    }

    case 'update_team_task': {
      const fields: string[] = [];
      const params: any[] = [];
      if (input.status && ['todo', 'in_progress', 'done'].includes(input.status)) {
        params.push(input.status);
        fields.push(`status = $${params.length}`);
        fields.push(input.status === 'done' ? `completed_at = now()` : `completed_at = null`);
      }
      if (input.due_date && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
        params.push(input.due_date);
        fields.push(`due_date = $${params.length}`);
      }
      if (input.assignee) {
        const e = await resolveTeamEmail(input.assignee);
        if (!e) return JSON.stringify({ success: false, error: `No team member matches "${input.assignee}"` });
        params.push(e);
        fields.push(`assignee_email = $${params.length}`);
      }
      if (input.priority && ['low', 'normal', 'high', 'urgent'].includes(input.priority)) {
        params.push(input.priority);
        fields.push(`priority = $${params.length}`);
      }
      if (fields.length === 0) return JSON.stringify({ success: false, error: 'Nothing to update' });
      params.push(input.task_id);
      const { rows } = await query(
        `update team_tasks set ${fields.join(', ')} where id = $${params.length} returning *`,
        params,
      );
      return rows.length > 0
        ? JSON.stringify({ success: true, task: rows[0] })
        : JSON.stringify({ success: false, error: 'Task not found' });
    }

    case 'list_clients': {
      let custom: Array<{ id: string; name: string; short_name: string | null }> = [];
      try {
        const { rows } = await query(`select id, name, short_name from custom_clients order by created_at asc`);
        custom = rows;
      } catch { /* table empty — statics still returned */ }
      const all = [
        ...staticClients.map((c) => ({ id: c.id, name: c.name, short_name: c.shortName })),
        ...custom.filter((r) => !staticClients.some((c) => c.id === r.id)),
      ];
      return JSON.stringify({ clients: all, count: all.length });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── Main chat endpoint ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { messages, email } = body;
    const userEmail = email || 'mn@mothernatureagency.com';

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    // Get today's date for context
    const today = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Load recent memories for context
    const { rows: recentMemories } = await query(
      `SELECT content, category, created_at FROM assistant_memory WHERE user_email = $1 ORDER BY created_at DESC LIMIT 15`,
      [userEmail]
    );

    const memoryContext = recentMemories.length > 0
      ? `\n\nThings you've been asked to remember:\n${recentMemories.map(m => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';

    // Live client list (built-in + custom) so new clients are always known.
    let clientLines = staticClients.map((c) => `- ${c.id} = ${c.name}`).join('\n');
    try {
      const { rows: customRows } = await query(`select id, name from custom_clients order by created_at asc`);
      const extra = customRows.filter((r: any) => !staticClients.some((c) => c.id === r.id));
      if (extra.length > 0) clientLines += '\n' + extra.map((r: any) => `- ${r.id} = ${r.name}`).join('\n');
    } catch { /* non-fatal */ }

    const team = await teamDirectory();
    const teamLines = team.map((t) => `- ${t.name} <${t.email}>`).join('\n');

    const systemPrompt = `You are the MNA Personal Assistant — a helpful, concise AI assistant for Mother Nature Agency. You help manage schedules, team assignments, campaigns, and content.

Today is ${dayName}, ${today}. The user's email is ${userEmail}.

You have access to tools to manage their schedule, assign and track team tasks, store memories, and check campaigns/content. When the user asks you to do something, use the appropriate tool. Be conversational but efficient — don't over-explain.

TEAM TASKS (the Asana-style board at /team-tasks):
- create_team_task assigns work to a teammate with a deadline and priority. "Assign Sable a task to shoot Chill House content, due Friday" → one call, done.
- repeat "monthly" makes it auto-create every month on its due day; repeat "per_new_client" makes it auto-create whenever a new client is onboarded — use these when the user describes recurring duties (monthly specials deadlines, onboarding checklists).
- list_team_tasks answers "what's on Sable's plate", "what's overdue", "what is everyone working on" (use overdue_only for overdue checks).
- update_team_task marks tasks done, moves deadlines, or reassigns. Look the task up with list_team_tasks first to get its id.
- Team task assignees must be team members, never clients.

The team:
${teamLines}

Client IDs for reference (call list_clients if one you need is missing):
${clientLines}

When adding events, infer reasonable defaults:
- If no time given, leave start_time null (it becomes an all-day task)
- If they say "tomorrow", calculate the date
- If they say "meeting", set event_type to "meeting"
- If they say "call", set event_type to "call"
- Default priority is "normal" unless they say urgent/important/ASAP
- When adding meetings/calls, ask who to invite if not specified. You can invite by name or email.
- For meetings/calls, default to Google Meet (auto-generates a Meet link). If the user says "in-person" or mentions a location, use in_person mode instead.
- Always set a start_time for meetings/calls so a proper Google Meet link can be created.

Team & Contact Directory (for attendees):
${await getContactsForPrompt()}

When the user says "set up a call with Justin" or "meeting with Sable and Jennifer", pass their names as the attendees parameter. Google Calendar will automatically send them invite emails.
${memoryContext}`;

    // Convert messages format and call Claude
    let claudeMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Tool use loop — keep calling Claude until no more tool calls
    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;
      claudeMessages = [
        ...claudeMessages,
        { role: 'assistant' as const, content: assistantContent },
      ];

      // Execute each tool call
      const toolResults: any[] = [];
      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input, userEmail);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      claudeMessages = [
        ...claudeMessages,
        { role: 'user' as const, content: toolResults },
      ];

      // Call Claude again with tool results
      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });
    }

    // Extract the final text response
    const textBlock = response.content.find((b: any) => b.type === 'text');
    const reply = textBlock ? (textBlock as any).text : 'Done!';

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('Assistant error:', err);
    return NextResponse.json({ error: err.message || 'Assistant error' }, { status: 500 });
  }
}
