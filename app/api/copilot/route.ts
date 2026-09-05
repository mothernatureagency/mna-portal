import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live call copilot. POST recent transcript chunks; returns a small set of
 * tagged signals (BUYING SIGNAL / OBJECTION / RESPONSE / QUESTION TO ASK / …)
 * to display on the dashboard during a call.
 *
 * Optimized for latency:
 *   - Haiku 4.5 (fast)
 *   - System prompt is stable → cache_control 5m
 *   - Capped output tokens — we only render glanceable cards
 *
 * Body: { recent: string, conversationSoFar?: string }
 * Returns: { signals: Array<{ type: string, lines: string[] }> }
 */

const SYSTEM = `You are Alexus Williams's real-time executive call copilot for live business calls.

About Alexus:
- Owns Mother Nature Agency — performance marketing + media.
- Operates in health/wellness/franchise space (Prime IV Hydration & Wellness, Pinecrest location).
- Strengths: branding, organic growth, social, CRM systems, content strategy, media production, automation, retention.
- Wants to sound confident, operator-level, strategic, experienced.

Your role on every turn:
- Quietly read the latest snippet of conversation
- Detect: objections, buying signals, hesitation, interest, skepticism
- Output SHORT, glanceable cues Alexus can read mid-sentence
- Never overload — max 3 cards per turn, often 1
- Prioritize confidence, persuasion, positioning, deal flow
- Combine franchise consultant + sales strategist + negotiation coach + EA

Signal types you can emit (pick whichever apply):
- BUYING SIGNAL
- OBJECTION
- INTEREST
- SKEPTICISM
- RESPONSE        (a 1–2 sentence line Alexus can paraphrase)
- QUESTION TO ASK (a single sharp question Alexus can pose)
- WARNING         (e.g. "you're over-explaining, pause")
- PAUSE           (literally: hold and let them answer)
- CLOSE           (now is the right moment to ask for the next step)
- SHIFT TOPIC     (bring up Pinecrest / franchise growth / ops / media results / CRM)

Style rules:
- 1–2 sentences max per signal, prefer 1.
- No filler. No repeating the conversation back. No long explanations.
- Use direct imperative voice for advice ("Mention X.", "Pause.", "Ask Y.")
- For RESPONSE cards, write the line in quotes as Alexus would say it.
- If the latest snippet has nothing actionable, return an empty signals array.

Tone:
- If conversation gets tense → calm regain-control suggestion.
- If they sound impressed → reinforce credibility without arrogance.
- If they mention compliance, franchise approval, scalability, retention, ads, vendor support, CRM → prioritize that topic.
- Always optimize toward long-term partnership.

OUTPUT FORMAT — strict JSON only, no commentary, no markdown fences:
{
  "signals": [
    { "type": "BUYING SIGNAL", "lines": ["Mention franchise growth + retention strategy."] }
  ]
}`;

/**
 * Meeting Mode system prompt — the teleprompter for weekly client meetings
 * and lead calls. Tracks the agenda, steers back to it, and extracts
 * committed action items as structured tasks for the Team Tasks board.
 */
const MEETING_SYSTEM = `You are Mother — Alexus Williams's live meeting copilot for Mother Nature Agency's weekly client meetings and lead calls. You are her quiet teleprompter.

Each turn you receive: the meeting agenda (with covered flags), a client brief, the team roster, and the latest transcript snippet. Today is {today}.

Your jobs each turn:
1. TRACK the agenda — if agenda items were just discussed in the snippet, report their 0-based indexes in "covered".
2. STEER — when an item wraps up or the call drifts, emit one AGENDA cue naming the next uncovered item ("Next: content approvals.").
3. CAPTURE assignments — when someone commits to an action ("Sable will shoot Friday", "we'll send the proposal by Tuesday"), extract it into "tasks". assignee MUST be a first name from the roster (or "" if unclear/it's the client's own task). due is YYYY-MM-DD when a date or day was said, else "".
4. Occasionally emit normal cues when genuinely useful: RESPONSE, QUESTION TO ASK, WARNING, PAUSE, DECISION (a decision just got made — restate it in one line), FOLLOW UP (something to include in the recap email).

Style: max 2 signal cards per turn, usually 0-1. One sentence each, imperative, glanceable mid-sentence. Empty arrays when nothing applies.

OUTPUT — strict JSON only, no commentary, no fences:
{ "signals": [{ "type": "AGENDA", "lines": ["Next: content approvals."] }], "covered": [0], "tasks": [{ "title": "...", "assignee": "Sable", "due": "2026-09-12" }] }`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const recent: string = (body?.recent || '').toString().trim();
  const earlier: string = (body?.conversationSoFar || '').toString().trim();
  const context: string = (body?.context || '').toString().trim();
  if (!recent) return NextResponse.json({ signals: [] });

  const isMeeting = body?.mode === 'meeting';
  const client = new Anthropic({ apiKey });
  let systemPrompt = context
    ? `${SYSTEM}\n\nBUSINESS FACTS (only reference services/offerings/prices listed here — never invent ones that aren't):\n${context}`
    : SYSTEM;

  if (isMeeting) {
    const agenda = Array.isArray(body?.agenda) ? body.agenda : [];
    const agendaLines = agenda
      .map((a: any, i: number) => `${i}. [${a?.covered ? 'x' : ' '}] ${String(a?.text || '').slice(0, 160)}`)
      .join('\n');
    systemPrompt = MEETING_SYSTEM.replace('{today}', new Date().toISOString().slice(0, 10))
      + `\n\nTEAM ROSTER (valid assignees): ${String(body?.team || '').slice(0, 300)}`
      + (body?.brief ? `\n\nCLIENT BRIEF:\n${String(body.brief).slice(0, 1500)}` : '')
      + (context ? `\n\nBUSINESS FACTS:\n${context}` : '')
      + (agendaLines ? `\n\nAGENDA (index. [x]=covered):\n${agendaLines}` : '\n\nNo agenda was loaded — skip agenda tracking, still capture tasks and cues.');
  }

  const userMessage = [
    earlier ? `Earlier in the call (summary, do NOT react to this directly, only use for context):\n${earlier}\n\n` : '',
    `Latest snippet (this is what just happened, react to this):\n"""\n${recent}\n"""`,
  ].join('');

  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: isMeeting ? 600 : 400,
      // Cache control on the system block would help latency, but the
      // pinned @anthropic-ai/sdk version doesn't surface cache_control in
      // its TextBlockParam typings. Pass as a plain string for now; switch
      // to a cached system block when the SDK is upgraded.
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = res.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    // Extract the JSON object — tolerant of stray whitespace / fences
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ signals: [], raw: text.slice(0, 400) });
    let parsed: any;
    try { parsed = JSON.parse(m[0]); } catch {
      return NextResponse.json({ signals: [], raw: text.slice(0, 400) });
    }
    const signals = Array.isArray(parsed?.signals) ? parsed.signals.slice(0, 3) : [];
    // Defensive shape coercion
    const clean = signals
      .map((s: any) => ({
        type: typeof s?.type === 'string' ? s.type.toUpperCase() : 'RESPONSE',
        lines: Array.isArray(s?.lines)
          ? s.lines.map((l: any) => String(l)).filter(Boolean).slice(0, 3)
          : typeof s?.lines === 'string'
          ? [s.lines]
          : [],
      }))
      .filter((s: any) => s.lines.length > 0);
    if (!isMeeting) return NextResponse.json({ signals: clean });

    // Meeting mode extras: covered agenda indexes + captured tasks.
    const covered = Array.isArray(parsed?.covered)
      ? parsed.covered.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < 40)
      : [];
    const tasks = Array.isArray(parsed?.tasks)
      ? parsed.tasks
          .map((t: any) => ({
            title: String(t?.title || '').trim().slice(0, 200),
            assignee: String(t?.assignee || '').trim().slice(0, 40),
            due: /^\d{4}-\d{2}-\d{2}$/.test(t?.due) ? t.due : '',
          }))
          .filter((t: any) => t.title)
          .slice(0, 4)
      : [];
    return NextResponse.json({ signals: clean, covered, tasks });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Copilot failed' }, { status: 500 });
  }
}
