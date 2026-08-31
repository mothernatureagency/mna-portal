import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Draft public-review replies for staff to copy/paste (e.g. into GHL or the
 * Google Business Profile UI). Read-only — we don't post anything.
 *
 * Body: { businessName, reviews: [{ author, rating, text }] }
 * Returns: { drafts: [{ index, reply }] }
 */

const SYSTEM = `You write short, warm, professional replies to Google reviews on behalf of a health & wellness business (IV hydration, recovery, wellness — think Prime IV Hydration & Wellness).

Rules for every reply:
- Address the reviewer by first name if given.
- 1-3 sentences, genuine and specific to what they said — not generic.
- 5 stars / positive: thank them warmly, reinforce one thing they liked, invite them back.
- 3 stars / mixed or 1-2 stars / negative: lead with empathy and thanks for the feedback, take accountability without being defensive, invite them to reach out directly to make it right (do NOT share private contact info or admit legal fault).
- NEVER give medical advice, make health/treatment claims, or mention specific medical outcomes.
- No hashtags. No emojis unless the review is clearly upbeat (then at most one).
- Sign off naturally as the team (e.g. "— The [Business] team") only if it reads well; otherwise no signature.

OUTPUT: strict JSON only, no markdown:
{ "drafts": [ { "index": 0, "reply": "..." } ] }
Return one entry per review, matching the given index.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const businessName = (body?.businessName || 'our business').toString();
  const reviews: any[] = Array.isArray(body?.reviews) ? body.reviews.slice(0, 25) : [];
  if (reviews.length === 0) return NextResponse.json({ drafts: [] });

  const list = reviews.map((r, i) =>
    `#${i} — ${r.author || 'Anonymous'} · ${r.rating || '?'}★\n"${(r.text || '').toString().slice(0, 600) || '(no text)'}"`,
  ).join('\n\n');

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Business: ${businessName}\n\nReviews:\n${list}` }],
    });
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let drafts: any[] = [];
    if (m) { try { drafts = JSON.parse(m[0]).drafts || []; } catch {} }
    // Coerce shape.
    const clean = drafts
      .map((d: any) => ({ index: Number(d.index), reply: String(d.reply || '').trim() }))
      .filter((d: any) => !Number.isNaN(d.index) && d.reply);
    return NextResponse.json({ drafts: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Draft failed' }, { status: 500 });
  }
}
