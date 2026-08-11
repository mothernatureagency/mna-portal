import Anthropic from '@anthropic-ai/sdk';

/**
 * AI drafting for Google-review replies. Shared by the manual drafter route and
 * the scheduled auto-responder so both use the exact same voice/rules.
 */

export const REVIEW_REPLY_SYSTEM = `You write short, warm, professional replies to Google reviews on behalf of a health & wellness business (IV hydration, recovery, wellness — think Prime IV Hydration & Wellness).

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

export type ReviewForDraft = { author?: string | null; rating?: number | null; text?: string | null };

export async function draftReplies(businessName: string, reviews: ReviewForDraft[]): Promise<{ index: number; reply: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const batch = reviews.slice(0, 25);
  if (batch.length === 0) return [];

  const list = batch.map((r, i) =>
    `#${i} — ${r.author || 'Anonymous'} · ${r.rating || '?'}★\n"${(r.text || '').toString().slice(0, 600) || '(no text)'}"`,
  ).join('\n\n');

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1600,
    system: REVIEW_REPLY_SYSTEM,
    messages: [{ role: 'user', content: `Business: ${businessName || 'our business'}\n\nReviews:\n${list}` }],
  });
  const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  let drafts: any[] = [];
  if (m) { try { drafts = JSON.parse(m[0]).drafts || []; } catch { /* ignore */ } }
  return drafts
    .map((d: any) => ({ index: Number(d.index), reply: String(d.reply || '').trim() }))
    .filter((d: any) => !Number.isNaN(d.index) && d.reply);
}
