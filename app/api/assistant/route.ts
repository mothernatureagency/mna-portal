import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { createCalendarEvent, isConnected } from '@/lib/google-calendar';
import { resolveAttendees, CONTACTS } from '@/lib/contacts';

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
];

// ── Tool execution ───────────────────────────────────────────────────

async function executeTool(name: string, input: any, userEmail: string): Promise<string> {
  await ensureSchema();

  switch (name) {
    case 'add_event': {
      // Resolve attendees from names/emails
      const resolvedAttendees = input.attendees ? resolveAttendees(input.attendees) : [];
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

    const systemPrompt = `You are the MNA Personal Assistant — a helpful, concise AI assistant for Mother Nature Agency. You help manage schedules, tasks, campaigns, and content.

Today is ${dayName}, ${today}. The user's email is ${userEmail}.

You have access to tools to manage their schedule, store memories, and check campaigns/content. When the user asks you to do something, use the appropriate tool. Be conversational but efficient — don't over-explain.

Client IDs for reference:
- prime-iv = Prime IV Niceville
- prime-iv-pinecrest = Prime IV Pinecrest
- serenity-bayfront = Serenity Bayfront (vacation rental)
- mna-realty = MNA Realty
- mna = Mother Nature Agency (internal)

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
${CONTACTS.map(c => `- ${c.name} (${c.email}) — ${c.role}${c.clientId ? ` [${c.clientId}]` : ''}`).join('\n')}

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
