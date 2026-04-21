import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * Reference-style analyzer. User drops URLs (TikTok, YouTube Shorts, IG
 * Reels, creator websites like viralvacations.com). AI can't fetch most
 * of those directly due to bot blocks, but it CAN reason from the URL
 * + any notes the user pastes. Returns a structured breakdown of the
 * style pattern.
 *
 * POST /api/video-projects/references/analyze
 * body: { url, notes? }
 * Returns: { summary, hookPattern, paceNotes, recommendedCadence }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { url, notes } = b || {};
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const prompt = `Analyze this short-form video reference URL and describe its style so a video team can replicate the pattern.

URL: ${url}
${notes ? `Notes the team left: ${notes}` : ''}

Return strict JSON:
{
  "summary": "one-line description of what this channel/video is",
  "hookPattern": "how they hook viewers in the first 2 seconds",
  "paceNotes": "typical shot length + cuts per 15 seconds",
  "audioStyle": "music + voiceover style",
  "visualStyle": "color grade, aspect, camera work",
  "replicateSteps": ["specific, actionable steps to replicate the style with beach footage", "..."]
}

If you don't recognize the URL, INFER from the domain (e.g. viralvacations.com = destination travel short-form with voiceover storytelling). Don't refuse — give a best-effort breakdown.
No markdown, no extra text outside the JSON.`;
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'No JSON in output', raw: text.slice(0, 300) }, { status: 500 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Reference analysis failed' }, { status: 500 });
  }
}
