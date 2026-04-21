import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * AI script + shot list generator for a video project.
 *
 * POST /api/video-projects/script
 * body: { topic, platform, durationSec, references?: string[], style?: string }
 *
 * Returns: { script, shotList: [{ t, shot, voCopy, brollIdea }], hashtags, caption }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { topic, platform, durationSec, references, style } = b || {};
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

  const dur = Number(durationSec) || 30;
  const plat = String(platform || 'tiktok').toLowerCase();
  const refs = Array.isArray(references) ? references.filter(Boolean).slice(0, 6) : [];

  const client = new Anthropic({ apiKey });
  const prompt = `You are a senior short-form video writer producing a ${plat} video.

TOPIC: ${topic}
DURATION: ${dur} seconds (pace the script accordingly — ~2.5 spoken words per second max)
STYLE: ${style || 'warm coastal lifestyle, relatable narrator voice, high energy open'}
${refs.length ? `REFERENCE CHANNELS / VIBES: ${refs.join(', ')}` : ''}

Return STRICT JSON only, no commentary:
{
  "script": "voiceover script — continuous prose, written exactly as it should be spoken",
  "shotList": [
    { "t": 0, "shot": "opening shot description", "voCopy": "what's being said during this shot", "brollIdea": "b-roll or text overlay note" }
  ],
  "caption": "posting caption with emoji sparingly",
  "hashtags": ["hashtag", ...]
}

Rules:
- The script MUST be the exact spoken voiceover, no stage directions inside it, no "[pause]" or asterisks.
- Break the shotList into 4-8 shots spanning the full duration (t = start second of each shot).
- brollIdea is specific — "slow zoom on sunset beach with woman walking" not "pretty beach".
- No markdown inside any string.
- Written like a real creator, not AI.`;

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'No JSON in output', raw: text.slice(0, 400) }, { status: 500 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Script generation failed' }, { status: 500 });
  }
}
