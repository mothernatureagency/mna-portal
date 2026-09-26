import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getContactsForPrompt } from '@/lib/contacts';
import { STAFF } from '@/lib/staff';
import { clients as staticClients } from '@/lib/clients';
import { identityForSession, anthropicToolsFor, runLocalTool } from '@/lib/mcp/local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MOTHER / the MNA assistant — the chat brain behind /jarvis and /assistant.
 *
 * The tools it can call are NOT defined here. They live in the shared registry
 * at lib/mcp/tools.ts, the same one app/api/mcp/route.ts serves over MCP, and
 * are executed in-process through lib/mcp/local.ts. So a tool added once shows
 * up in the voice HUD, in Claude Code and in any future agent together, instead
 * of being re-implemented per surface.
 *
 * What stays here is what's specific to this assistant: its voice, the context
 * it pre-loads (memories, roster, client ids, contacts), and the tool loop.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
/** Hard stop on the tool loop so a confused turn can't bill forever. */
const MAX_TOOL_ROUNDS = 8;

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();

    // Identity comes from the session, never the request body. These tools
    // read and write the caller's own schedule and memories, so a caller who
    // could name themselves could read anyone's.
    const identity = await identityForSession();
    if (!identity) {
      return NextResponse.json({ error: 'Staff sign-in required' }, { status: 403 });
    }
    const userEmail = identity.email;

    const body = await req.json();
    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const { rows: recentMemories } = await query<{ content: string; category: string }>(
      `select content, category from assistant_memory where user_email = $1 order by created_at desc limit 15`,
      [userEmail],
    );
    const memoryContext = recentMemories.length > 0
      ? `\n\nThings you've been asked to remember:\n${recentMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';

    // Live client list (built-in + custom) so new clients are always known.
    let clientLines = staticClients.map((c) => `- ${c.id} = ${c.name}`).join('\n');
    try {
      const { rows: customRows } = await query<{ id: string; name: string }>(
        `select id, name from custom_clients order by created_at asc`,
      );
      const extra = customRows.filter((r) => !staticClients.some((c) => c.id === r.id));
      if (extra.length > 0) clientLines += '\n' + extra.map((r) => `- ${r.id} = ${r.name}`).join('\n');
    } catch { /* non-fatal */ }

    const seen = new Map<string, string>();
    for (const s of STAFF) seen.set(s.email.toLowerCase(), s.name);
    try {
      const { rows } = await query<{ email: string; name: string }>(`select email, name from staff_members`);
      for (const r of rows) if (r.email) seen.set(r.email.toLowerCase(), r.name || r.email);
    } catch { /* statics still work */ }
    const teamLines = Array.from(seen, ([email, name]) => `- ${name} <${email}>`).join('\n');

    const systemPrompt = `You are the MNA Personal Assistant — a helpful, concise AI assistant for Mother Nature Agency. You help manage schedules, team assignments, campaigns, and content.

Today is ${dayName}, ${today}. The user's email is ${userEmail}.

You have access to tools to manage their schedule, assign and track team tasks, store memories, and check campaigns/content. When the user asks you to do something, use the appropriate tool. Be conversational but efficient — don't over-explain.

TEAM TASKS (the Asana-style board at /team-tasks):
- create_task assigns work to a teammate with a deadline and priority. "Assign Sable a task to shoot Chill House content, due Friday" → one call, done.
- repeat "monthly" makes it auto-create every month on its due day; repeat "per_new_client" makes it auto-create whenever a new client is onboarded — use these when the user describes recurring duties (monthly specials deadlines, onboarding checklists).
- list_tasks answers "what's on Sable's plate", "what's overdue", "what is the team working on" (pass overdue: true for overdue checks).
- For "who is overloaded" or "who has capacity", use team_workload — one call beats several list_tasks.
- For "what needs attention", "what's slipping" or a standup summary, use whats_blocked — it returns overdue tasks, unowned tasks and stale client requests together.
- update_task marks tasks done, moves deadlines, or reassigns. Look the task up with list_tasks first to get its id.
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

When the user says "set up a call with Justin" or "meeting with Sable and Jennifer", pass their names as the attendees parameter. Google Calendar will automatically send them invite emails.${memoryContext}`;

    const tools = anthropicToolsFor(identity);

    let claudeMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    // Tool loop — keep going until Claude stops asking for tools.
    let rounds = 0;
    while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      claudeMessages = [...claudeMessages, { role: 'assistant', content: response.content }];

      // Every tool_use block must come back in ONE user message, or Claude
      // learns to stop making parallel calls.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: await runLocalTool(block.name, block.input, identity),
          });
        }
      }

      claudeMessages = [...claudeMessages, { role: 'user', content: toolResults }];
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const reply = textBlock && textBlock.type === 'text' ? textBlock.text : 'Done!';

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('Assistant error:', err);
    return NextResponse.json({ error: err.message || 'Assistant error' }, { status: 500 });
  }
}
