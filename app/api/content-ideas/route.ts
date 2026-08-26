import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Content idea generator for the client portal's Content tab.
 *
 * A client types a topic and gets back what to shoot and what to say —
 * a shot list they can hand to whoever is holding the camera, plus short
 * scripts and hook lines.
 *
 * POST { topic, clientName?, industry?, location? }
 * Returns { shotList, scripts, hooks, tips }
 *
 * Note: the pinned SDK (0.32.1) predates structured outputs, so this asks
 * for strict JSON in the prompt and parses it — same approach as
 * /api/tiktok/ideas. Worth revisiting if the SDK is ever bumped.
 */

type Idea = {
  shotList: { shot: string; type: string; why: string }[];
  scripts: { title: string; hook: string; body: string; cta: string; length: string }[];
  hooks: string[];
  tips: string[];
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Content ideas are not configured yet.' }, { status: 500 });

  // Portal-only endpoint — any signed-in user, but not anonymous.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const topic = String(b?.topic || '').trim();
  if (!topic) return NextResponse.json({ error: 'Give us a topic to work from.' }, { status: 400 });
  if (topic.length > 300) return NextResponse.json({ error: 'Topic is too long.' }, { status: 400 });

  const clientName = String(b?.clientName || '').slice(0, 120);
  const industry = String(b?.industry || '').slice(0, 120);
  const location = String(b?.location || '').slice(0, 120);

  const client = new Anthropic({ apiKey });

  const prompt = `You are a content producer at Mother Nature Agency planning a shoot for a client.

CLIENT: ${clientName || 'a local business'}
${industry ? `INDUSTRY: ${industry}\n` : ''}${location ? `LOCATION: ${location}\n` : ''}
TOPIC THE CLIENT WANTS TO COVER: ${topic}

Plan content around that topic. The shot list is handed to a staff member with a phone
or camera at the location — every shot must be something they can physically capture on
site, described concretely (framing, subject, movement). No stock footage suggestions,
no "b-roll of happy people" vagueness.

Scripts are for short-form video (Reels / TikTok / Shorts). Spoken language, not ad copy.

Return STRICT JSON only:
{
  "shotList": [
    { "shot": "specific thing to capture, with framing and movement", "type": "photo | video | drone | interview", "why": "what it's used for" }
  ],
  "scripts": [
    { "title": "short label", "hook": "first line, said out loud in the first 2 seconds", "body": "2-4 spoken sentences", "cta": "closing line", "length": "e.g. 20-30s" }
  ],
  "hooks": ["5 alternate opening lines that would stop a scroll"],
  "tips": ["3 practical production notes — lighting, time of day, what to avoid"]
}

Return 6-8 shotList entries and 3 scripts. No commentary outside the JSON. No markdown inside strings.`;

  try {
    const res = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();

    // Models occasionally wrap JSON in a fence despite the instruction.
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed: Idea;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) {
        return NextResponse.json({ error: 'Could not read the response. Try rephrasing the topic.' }, { status: 502 });
      }
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }

    return NextResponse.json({
      shotList: Array.isArray(parsed.shotList) ? parsed.shotList : [],
      scripts: Array.isArray(parsed.scripts) ? parsed.scripts : [],
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
