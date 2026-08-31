import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live interpreter for the Call Copilot.
 *
 * Takes a chunk of speech (Spanish or English, often messy from the browser
 * speech recognizer) and returns a fast translation plus a suggested reply,
 * so Alexus can either read "what to say" or let Mother Nature speak it aloud
 * for a back-and-forth conversation.
 *
 * Body: { recent: string, myLanguage?: 'en' | 'es' }
 * Returns: {
 *   detected: 'es' | 'en' | 'other',
 *   original: string,       // cleaned-up version of what was said
 *   translation: string,    // `recent` translated into the OTHER language
 *   targetLang: 'es' | 'en',// language `translation` is written in (to speak)
 *   sayNext: string,        // a natural reply, in the other party's language
 *   sayNextGloss: string,   // English gloss of sayNext
 * }
 */

const SYSTEM = `You are a real-time Spanish<->English interpreter and conversation coach for Alexus Williams, who runs Mother Nature Agency (marketing for health/wellness businesses like Prime IV Hydration). She is on a live call and may be speaking with a Spanish-speaking client.

Alexus's own language is English. On each turn you receive a short, possibly messy snippet of live speech-to-text. Do:
1. Detect whether the snippet is Spanish ("es"), English ("en"), or something else ("other").
2. Clean it up into a coherent sentence ("original").
3. Translate it into the OTHER language ("translation") — Spanish->English or English->Spanish. This is what gets shown/spoken so the two parties understand each other.
4. Suggest a natural, confident thing Alexus could say next to move the conversation forward, written in the OTHER PARTY'S language (i.e. Spanish when the client is Spanish-speaking) as "sayNext", with a short English gloss "sayNextGloss".

Keep translations faithful and natural, not literal. Keep sayNext warm, professional, and useful for a sales/relationship call. If the snippet has nothing meaningful, return empty strings.

OUTPUT — strict JSON only, no markdown, no commentary:
{
  "detected": "es",
  "original": "...",
  "translation": "...",
  "targetLang": "en",
  "sayNext": "...",
  "sayNextGloss": "..."
}
Rules: targetLang is the language "translation" is written in. If detected is "es", targetLang is "en"; if detected is "en", targetLang is "es".`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const recent: string = (body?.recent || '').toString().trim();
  const context: string = (body?.context || '').toString().trim();
  if (!recent) return NextResponse.json({ detected: 'other', original: '', translation: '', targetLang: 'en', sayNext: '', sayNextGloss: '' });

  const systemWithContext = context
    ? `${SYSTEM}\n\nBUSINESS FACTS (the ONLY services/details you may reference in sayNext — never invent services, prices, or offerings not listed here):\n${context}`
    : SYSTEM;

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: systemWithContext,
      messages: [{ role: 'user', content: `Live snippet:\n"""\n${recent}\n"""` }],
    });
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ detected: 'other', original: recent, translation: '', targetLang: 'en', sayNext: '', sayNextGloss: '' });
    let parsed: any;
    try { parsed = JSON.parse(m[0]); } catch {
      return NextResponse.json({ detected: 'other', original: recent, translation: '', targetLang: 'en', sayNext: '', sayNextGloss: '' });
    }
    const detected = ['es', 'en', 'other'].includes(parsed?.detected) ? parsed.detected : 'other';
    const targetLang = parsed?.targetLang === 'es' || parsed?.targetLang === 'en'
      ? parsed.targetLang
      : detected === 'es' ? 'en' : 'es';
    return NextResponse.json({
      detected,
      original: String(parsed?.original || recent),
      translation: String(parsed?.translation || ''),
      targetLang,
      sayNext: String(parsed?.sayNext || ''),
      sayNextGloss: String(parsed?.sayNextGloss || ''),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Translate failed' }, { status: 500 });
  }
}
