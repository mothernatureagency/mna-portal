import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/content-calendar/:id/graphic-brief
// body: { note?: string }
//
// Drafts a design spec for a post using the Graphic Designer agent. This writes
// nothing — it hands the text back so it can be reviewed and edited before it
// goes onto the request. Text only: the brief describes the artwork, it does
// not produce it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let note = '';
  try {
    const body = await req.json();
    if (typeof body?.note === 'string') note = body.note.trim();
  } catch { /* optional */ }

  const { rows } = await query<any>(
    `select cc.*, p.client_name from content_calendar cc
       join projects p on p.id = cc.project_id
      where cc.id = $1`,
    [params.id],
  );
  const item = rows[0];
  if (!item) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const agent = getAgent('graphic-designer');
  if (!agent) return NextResponse.json({ error: 'Graphic Designer agent missing' }, { status: 500 });

  const userPrompt = `Write a design brief for this social post for ${item.client_name}.

Platform: ${item.platform}
Format: ${item.content_type || 'Post'}
Posts on: ${item.post_date}
Title/Context: ${item.title || '(untitled)'}
${item.caption ? `\nApproved caption the artwork has to sit with:\n${item.caption}\n` : ''}${note ? `\nWhat the team asked for:\n${note}\n` : ''}
Give the brief in your standard format. Keep it to what a designer needs to start
work — no preamble, no restating this request back to me.`;

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: agent.model,
      max_tokens: 1200,
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const brief = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    return NextResponse.json({ brief });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Claude API error' }, { status: 500 });
  }
}
