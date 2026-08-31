import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { blockFromRequest } from '@/lib/specials-read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Read a monthly specials sheet/flyer and return it as plain text.
 *
 * Feeds the month planner's specials box. For the structured version — one row
 * per special, for the Specials section — see /api/specials/import.
 *
 * POST multipart/form-data { file }   — image / PDF / CSV / text file
 *   OR POST application/json { driveUrl }  — a Drive share link or bare file ID
 *
 * Returns { specials, source }.
 */

const PROMPT = `This is a business's monthly specials — the promotions, offers and packages they're running this month.

Transcribe it into plain text a marketer can plan posts from. One special per line, in the order shown. For each, keep the name, the price or discount, any dates or duration, and any conditions (member-only, first-time guests, while supplies last).

Also keep any theme, holiday or awareness-month framing that appears — those drive the content plan.

Rules:
- Transcribe only what is actually there. Do not invent specials, prices or dates.
- If a price or date is unreadable, write "(unclear)" rather than guessing.
- No preamble, no commentary, no markdown fences. Return the plain text list only.
- If the file contains no specials or offers at all, reply with exactly: NO_SPECIALS_FOUND`;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can read specials' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let block: Anthropic.ContentBlockParam;
  let source: string;
  try {
    ({ block, source } = await blockFromRequest(req, user.email || null));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read that file' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
    });

    if (res.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'That file could not be read. Try a different export of it.' }, { status: 422 });
    }

    const specials = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();

    if (!specials || specials === 'NO_SPECIALS_FOUND') {
      return NextResponse.json({
        error: `No specials found in "${source}". Check it's the right file, or type them in instead.`,
      }, { status: 422 });
    }

    return NextResponse.json({ specials, source });
  } catch (e: any) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Rate limited — try again in a moment.' }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Could not read the file (${e.status}): ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: e?.message || 'Reading the specials failed' }, { status: 500 });
  }
}
