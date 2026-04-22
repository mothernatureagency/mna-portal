import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TikTok content-plan agent.
 *
 * POST /api/tiktok/plan
 * body: { handle, bio, niche?, followers, totalLikes, videosCount,
 *         videos: [{ text, plays, likes, comments, shares, hashtags, duration }] }
 *
 * Returns a structured, opinionated 30-day plan based on what's actually
 * working on the account (patterns in top performers, weak spots, gaps).
 *
 * Shape:
 *   {
 *     summary: one-paragraph read of the account,
 *     voice: { tone, doThis, avoidThis },
 *     pillars: [{ name, description, shareOfPosts, exampleHooks }],
 *     thirtyDayPlan: [{ day, pillar, title, hook, format, cta, hashtags, audio }],
 *     seriesIdeas: [{ name, premise, cadence, episodes: [title] }],
 *     stopDoing: [string],
 *     kpiTargets: { followers30d, avgViews, engagementRate }
 *   }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { handle, bio, niche, followers, totalLikes, videosCount, videos } = b || {};
  if (!handle || !Array.isArray(videos) || videos.length === 0) {
    return NextResponse.json({ error: 'handle + videos[] required' }, { status: 400 });
  }

  const sorted = videos.slice().sort((a: any, b: any) => (b.plays || 0) - (a.plays || 0));
  const top = sorted.slice(0, 15);
  const bottom = sorted.slice(-5).reverse();

  const fmtVid = (v: any, i: number) => {
    const tags = Array.isArray(v.hashtags) ? v.hashtags.slice(0, 10).join(', ') : '';
    const er = v.plays ? (((v.likes + v.comments + v.shares) / v.plays) * 100).toFixed(1) : '0';
    return `${i + 1}. ${v.plays?.toLocaleString?.() || 0} views · ${v.likes?.toLocaleString?.() || 0} likes · ${v.comments || 0} comments · ER ${er}%
   Caption: ${(v.text || '').slice(0, 240)}
   Tags: ${tags}${v.duration ? `   Duration: ${v.duration}s` : ''}`;
  };

  const topBlock = top.map(fmtVid).join('\n');
  const bottomBlock = bottom.map(fmtVid).join('\n');

  const client = new Anthropic({ apiKey });
  const prompt = `You are a TikTok content strategist. Read this creator's real performance data and produce a deep, opinionated 30-day content plan grounded in what's already working.

ACCOUNT: @${handle}
${bio ? `BIO: ${bio}\n` : ''}${niche ? `NICHE: ${niche}\n` : ''}FOLLOWERS: ${followers?.toLocaleString?.() || followers || 'unknown'}
TOTAL LIKES: ${totalLikes?.toLocaleString?.() || totalLikes || 'unknown'}
POSTS: ${videosCount || videos.length}

TOP PERFORMERS (use these as the blueprint):
${topBlock}

BOTTOM PERFORMERS (do NOT repeat these patterns):
${bottomBlock}

First mentally analyze:
- Which hooks, formats, topics repeat in the top performers?
- Which patterns the bottom performers share that are dragging engagement?
- Gaps the account hasn't tried yet that fit the niche?

Then return STRICT JSON only (no commentary, no markdown fences):
{
  "summary": "2-3 sentence honest read of the account's identity + what's clearly working",
  "voice": {
    "tone": "short phrase, e.g. 'playful-authoritative, first-person'",
    "doThis": ["3-5 specific voice moves the top videos use"],
    "avoidThis": ["2-3 tonal mistakes from the bottom videos"]
  },
  "pillars": [
    { "name": "Pillar name", "description": "what it is + why it works for THIS account", "shareOfPosts": "e.g. 40%", "exampleHooks": ["3 concrete hook lines for this pillar"] }
  ],
  "thirtyDayPlan": [
    { "day": 1, "pillar": "matches one of the pillar names", "title": "concrete video concept", "hook": "literal first 2-second line", "format": "talking head | b-roll | POV | duet | trend audio | tutorial | split-screen | etc", "cta": "one-line CTA", "hashtags": ["5-7 tags"], "audio": "trending audio direction or 'original VO'" }
  ],
  "seriesIdeas": [
    { "name": "Franchise name", "premise": "1-sentence premise", "cadence": "e.g. weekly", "episodes": ["3-4 episode titles"] }
  ],
  "stopDoing": ["3-4 specific things this account should stop based on bottom performers"],
  "kpiTargets": { "followers30d": "realistic +X target based on current velocity", "avgViews": "target avg views/post", "engagementRate": "e.g. >4%" }
}

Rules:
- Return 3-4 pillars, with shareOfPosts summing to ~100%.
- Return 30 entries in thirtyDayPlan, one per day.
- Return 2-3 seriesIdeas.
- Every title, hook, and CTA must reference specific themes from the top performers — no generic filler.
- Hashtags should mix ones that appear in the top performers with 1-2 niche tests.`;

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'No JSON in AI output', raw: text.slice(0, 400) }, { status: 500 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Plan generation failed' }, { status: 500 });
  }
}
