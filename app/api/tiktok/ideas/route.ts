import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * TikTok trend + content-idea generator.
 *
 * POST /api/tiktok/ideas
 * body: { handle, bio?, niche?, topVideos: [{ text, plays, likes, hashtags }] }
 *
 * Returns { trends, contentIdeas, hashtagStrategy, postingCadence }.
 * Analyzes the top-performing videos to pull out patterns the creator
 * should lean into.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { handle, bio, niche, topVideos } = b || {};
  if (!handle || !Array.isArray(topVideos)) {
    return NextResponse.json({ error: 'handle + topVideos[] required' }, { status: 400 });
  }

  const compact = topVideos.slice(0, 10).map((v: any, i: number) => {
    const hashtags = Array.isArray(v.hashtags) ? v.hashtags.slice(0, 8).join(', ') : '';
    return `${i + 1}. Views: ${v.plays?.toLocaleString?.() || v.plays || 0} · Likes: ${v.likes?.toLocaleString?.() || v.likes || 0}
   Caption: ${(v.text || '').slice(0, 200)}
   Tags: ${hashtags}`;
  }).join('\n');

  const client = new Anthropic({ apiKey });
  const prompt = `Analyze this TikTok creator's top-performing content and return trend-spotting + content-idea recommendations.

HANDLE: @${handle}
${bio ? `BIO: ${bio}\n` : ''}${niche ? `NICHE: ${niche}\n` : ''}

TOP 10 VIDEOS BY VIEWS:
${compact}

Return STRICT JSON only:
{
  "trends": ["3-5 specific patterns you see in the top videos (hook style, topic, format, pacing)"],
  "contentIdeas": [
    { "title": "concrete video idea", "hook": "first-2-second hook line", "why": "why this fits the existing top-performers", "type": "talking head | b-roll | POV | tutorial | trend audio | etc" }
  ],
  "hashtagStrategy": {
    "alwaysInclude": ["hashtags that keep appearing in the top videos"],
    "testNext": ["3-5 hashtags the creator isn't using that would fit the niche"]
  },
  "postingCadence": "one-line rec based on what's clearly working"
}

Return 5-7 contentIdeas. No commentary outside the JSON. No markdown inside strings.`;

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'No JSON in AI output', raw: text.slice(0, 400) }, { status: 500 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Idea generation failed' }, { status: 500 });
  }
}
