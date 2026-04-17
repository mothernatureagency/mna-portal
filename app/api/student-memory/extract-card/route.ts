import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * POST /api/student-memory/extract-card
 * body: { text, subject? }
 *
 * Takes a chunk of tutor text and pulls out the most useful Q/A flashcard.
 * Used by the "Save as Flashcard" button in the tutor chat.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = String(body?.text || '').trim();
  const subject = String(body?.subject || 'General').trim();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system:
        'Extract one concise study flashcard from the given lesson text. Output strict JSON only:\n' +
        '{"question":"...","answer":"..."}\n' +
        'The question should be specific (something a student could be asked on a test). The answer should be 1-2 short sentences. No markdown, no extra commentary.',
      messages: [{ role: 'user', content: `Subject: ${subject}\n\nLesson text:\n${text}` }],
    });
    const reply = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    // Try to parse the JSON response
    const match = reply.match(/\{[\s\S]*?\}/);
    if (!match) return NextResponse.json({ error: 'No JSON returned', raw: reply }, { status: 500 });
    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ question: parsed.question, answer: parsed.answer, subject });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Extract failed' }, { status: 500 });
  }
}
