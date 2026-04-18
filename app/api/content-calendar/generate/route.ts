import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Draft N posts — one per selected day — from a single topic/angle.
 * POST { clientName, days: ["2026-04-22", ...], topic, platform }
 * Returns { posts: ContentCalendarRow[] }
 *
 * Each post is seeded into content_calendar as a "Draft" in pending_review
 * so the user can fine-tune. AI writes a short title, hook, caption, and
 * CTA per day, varying the angle so the posts don't all feel identical.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientName, days, topic, platform } = body || {};
  if (!clientName || !Array.isArray(days) || days.length === 0 || !topic) {
    return NextResponse.json({ error: 'clientName, days[], and topic required' }, { status: 400 });
  }

  // Look up or create a project for this client
  const { rows: existing } = await query<{ id: string }>(
    'select id from projects where client_name = $1 limit 1',
    [clientName],
  );
  let projectId = existing[0]?.id;
  if (!projectId) {
    const { rows } = await query<{ id: string }>(
      'insert into projects (name, client_name) values ($1, $2) returning id',
      [`${clientName} Content`, clientName],
    );
    projectId = rows[0].id;
  }

  const client = new Anthropic({ apiKey });

  // Single prompt producing JSON with one post per requested date
  const prompt = `You are a social media content writer for ${clientName}.
Draft ${days.length} post${days.length === 1 ? '' : 's'} for ${platform || 'Instagram'}, one per date below.
Topic / angle: ${topic}

Dates:
${days.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}

Return STRICT JSON only, no commentary:
[
  {
    "post_date": "YYYY-MM-DD",
    "title": "short post title",
    "hook": "first-line scroll-stopper",
    "cta": "one short call to action",
    "caption": "full caption ready to post (3-6 short paragraphs, kept on-brand, natural voice, avoid generic AI filler, include 3-5 targeted hashtags at the end)"
  },
  ...
]

Rules:
- Each post MUST have a DIFFERENT angle / hook so the posts don't feel templated when read back to back
- No asterisks, no markdown, no emojis read-aloud as text
- Written in the client's voice, like a real social manager wrote it
- Captions should be tight — no fluff`;

  let parsed: any[] = [];
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    // Extract the JSON array
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return NextResponse.json({ error: 'No JSON array in model output', raw: text.slice(0, 400) }, { status: 500 });
    parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 });
  }

  // Insert each post
  const inserted: any[] = [];
  for (const p of parsed) {
    if (!p || !p.post_date) continue;
    const title = `[Generated] ${p.title || topic} — Hook: ${p.hook || ''} | CTA: ${p.cta || ''}`;
    const { rows } = await query(
      `insert into content_calendar
         (project_id, post_date, platform, content_type, title, status, assigned_role, caption, client_approval_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        projectId,
        p.post_date,
        platform || 'Instagram',
        'Post',
        title,
        'Draft',
        'Social Media Manager',
        p.caption || null,
        'pending_review',
      ],
    );
    inserted.push(rows[0]);
  }

  return NextResponse.json({ posts: inserted, count: inserted.length });
}
