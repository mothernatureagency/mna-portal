import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // Parse optional guidance from request body (used when redoing copy)
  let guidance = '';
  try {
    const body = await req.json();
    if (body?.guidance) guidance = body.guidance;
  } catch {
    // No body or invalid JSON — that's fine, guidance stays empty
  }

  const { rows } = await query<any>(
    `select cc.*, p.client_name from content_calendar cc
       join projects p on p.id = cc.project_id
      where cc.id = $1`,
    [params.id]
  );
  const item = rows[0];
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const agent = getAgent('social-media');
  if (!agent) return NextResponse.json({ error: 'Agent missing' }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const guidanceBlock = guidance
    ? `\n\nIMPORTANT — the team is redoing this copy. Here are their notes on what to change:\n"${guidance}"\nPlease follow these notes closely while still keeping the caption polished and ready to post.`
    : '';

  const userPrompt = `Write social media caption copy for this post for ${item.client_name}.

Platform: ${item.platform}
Format: ${item.content_type || 'post'}
Title/Context: ${item.title}

Give me TWO caption options:

OPTION A: (primary — your best version)
OPTION B: (backup — different angle or tone)

Rules:
- Write like a real person, not AI. Sound natural, conversational, and human.
- Do NOT overuse hyphens or em dashes. Use them sparingly (max once per caption if at all).
- No generic filler phrases like "Ready to transform your wellness journey?" or "Here's the thing —"
- Keep brand voice warm, genuine, and relatable. Write the way the business owner would actually talk.
- Include 3-5 relevant hashtags at the end of each option.
- Each option should be a complete, ready-to-post caption.${guidanceBlock}`;

  try {
    const res = await client.messages.create({
      model: agent.model,
      max_tokens: 800,
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const caption = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    const upd = await query<any>(
      `update content_calendar set caption = $1 where id = $2 returning *`,
      [caption, params.id]
    );
    return NextResponse.json({ item: upd.rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Claude API error' }, { status: 500 });
  }
}
