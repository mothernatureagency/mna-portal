import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

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
  const userPrompt = `Write Instagram/TikTok caption copy for this post for ${item.client_name}.\n\nPlatform: ${item.platform}\nFormat: ${item.content_type || 'post'}\nTitle/Context: ${item.title}\n\nGive me THREE caption variants labeled "SHORT:", "MEDIUM:", and "LONG:". Each should include 3-6 relevant hashtags at the end. Keep brand voice warm, wellness-focused, and conversion-oriented.`;

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
