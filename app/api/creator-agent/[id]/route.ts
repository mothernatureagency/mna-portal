import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCreatorAgent } from '@/lib/creators';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = getCreatorAgent(params.id);
  if (!agent) return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ error: 'messages required' }, { status: 400 });

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: agent.systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    });
    const reply = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Agent request failed' }, { status: 500 });
  }
}
