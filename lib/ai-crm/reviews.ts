import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { getAccessToken } from '@/lib/google-calendar';
import { queueEmailNotification, STAFF_NOTIFY_EMAIL } from '@/lib/notifications';
import { GhlLocation } from './locations';
import { checkReviewEscalation } from './safety';
import { audit } from './engine';

/**
 * Google Reviews AI module — independent of GoHighLevel/Revive review AI.
 * Talks to the Google Business Profile API directly using the portal's
 * existing Google OAuth tokens (google_tokens table, business.manage scope).
 *
 * Each GBP (gbp_account_id + gbp_location_id) maps to exactly one
 * ghl_locations row, which supplies the knowledge base and approval rules.
 *
 * Rating rules:
 *   5★/4★ → auto-post when review_auto_enabled
 *   3★    → auto-post only when review_auto_3_star is also on
 *   1★/2★ → always human approval
 * Any review matching checkReviewEscalation (medical harm, privacy, legal,
 * billing, discrimination, serious complaints) always requires approval.
 */

const GBP_BASE = 'https://mybusiness.googleapis.com/v4';
const MODEL = process.env.AI_CRM_MODEL || 'claude-sonnet-5';

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

async function gbpToken(loc: GhlLocation): Promise<string | null> {
  const email = loc.gbp_auth_email || STAFF_NOTIFY_EMAIL;
  return getAccessToken(email);
}

/** Pull new reviews for a location's GBP into the queue. */
export async function syncLocationReviews(loc: GhlLocation): Promise<{ inserted: number }> {
  if (!loc.gbp_account_id || !loc.gbp_location_id) return { inserted: 0 };
  const token = await gbpToken(loc);
  if (!token) {
    await audit({ ghlLocationId: loc.ghl_location_id, event: 'review_sync_error', detail: { error: 'No Google token (connect Google with business.manage scope)' } });
    return { inserted: 0 };
  }
  const url = `${GBP_BASE}/accounts/${loc.gbp_account_id}/locations/${loc.gbp_location_id}/reviews?pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    await audit({ ghlLocationId: loc.ghl_location_id, event: 'review_sync_error', detail: { status: res.status, error: text.slice(0, 300) } });
    return { inserted: 0 };
  }
  const data = await res.json();
  const reviews: any[] = data.reviews || [];
  let inserted = 0;
  for (const r of reviews) {
    if (!r.name) continue;
    // Reviews Google already shows a reply for enter as 'posted' so we never
    // double-reply; new ones enter as 'pending' for processing.
    const status = r.reviewReply?.comment ? 'posted' : 'pending';
    const { rows } = await query<{ id: string }>(
      `insert into ai_review_queue (ghl_location_id, google_review_name, author_name, rating, review_text, review_date, status, final_response, posted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (ghl_location_id, google_review_name) do nothing
       returning id`,
      [
        loc.ghl_location_id,
        r.name,
        r.reviewer?.displayName || null,
        STAR_MAP[r.starRating] || null,
        r.comment || null,
        r.createTime || null,
        status,
        r.reviewReply?.comment || null,
        r.reviewReply?.updateTime || null,
      ],
    );
    if (rows[0] && status === 'pending') inserted++;
  }
  return { inserted };
}

async function generateReviewReply(loc: GhlLocation, review: { author_name: string | null; rating: number | null; review_text: string | null }): Promise<{ reply: string; confidence: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey });
  const system = `You write replies to Google reviews on behalf of ${loc.name}, posted publicly from the business's own profile.

Business facts you may reference (nothing else):
${[loc.business_hours && `Hours: ${loc.business_hours}`, loc.booking_url && `Booking: ${loc.booking_url}`, loc.offers && `Offers: ${loc.offers}`].filter(Boolean).join('\n') || '(none provided)'}

Rules:
- Address the reviewer by first name if given. 1-3 sentences, specific to what they wrote — never generic.
- Positive: thank them warmly, reinforce one thing they mentioned, invite them back.
- Negative/mixed: lead with empathy, take accountability without admitting legal fault, invite them to contact the business directly${loc.business_phone ? ` at ${loc.business_phone}` : ''}. Never argue.
- NEVER give medical advice, make treatment claims, mention specific medical outcomes, or reveal that the reviewer is a patient/customer beyond what they said publicly.
- Never mention AI, automation, or Mother Nature Agency.
${loc.restricted_claims ? `- Never state or imply: ${loc.restricted_claims}` : ''}
${loc.tone_instructions ? `- Tone: ${loc.tone_instructions}` : ''}

Call the review_reply tool with your reply and a 0-1 confidence that it is safe and appropriate to post publicly with no human check.`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    tools: [{
      name: 'review_reply',
      description: 'Return the public reply for this review.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reply: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['reply', 'confidence'],
      },
    }],
    tool_choice: { type: 'tool', name: 'review_reply' },
    messages: [{
      role: 'user',
      content: `Review by ${review.author_name || 'Anonymous'} — ${review.rating ?? '?'} stars:\n"${(review.review_text || '(no text, rating only)').slice(0, 1500)}"`,
    }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const input = (toolUse?.input || {}) as any;
  return {
    reply: String(input.reply || '').trim(),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
  };
}

export async function postReviewReply(loc: GhlLocation, reviewName: string, comment: string): Promise<void> {
  const token = await gbpToken(loc);
  if (!token) throw new Error('No Google token for review posting');
  const res = await fetch(`${GBP_BASE}/${reviewName}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GBP reply failed ${res.status}: ${text.slice(0, 300)}`);
  }
}

/** Generate replies for pending reviews and auto-post or queue for approval. */
export async function processPendingReviews(loc: GhlLocation, limit = 10): Promise<Record<string, number>> {
  const { rows } = await query<any>(
    `select * from ai_review_queue where ghl_location_id = $1 and status = 'pending' order by review_date desc nulls last limit $2`,
    [loc.ghl_location_id, limit],
  );
  const results: Record<string, number> = {};
  for (const r of rows) {
    try {
      const hit = checkReviewEscalation(r.review_text || '');
      const rating = Number(r.rating || 0);
      const ratingAllowsAuto =
        rating >= 4 ? true :
        rating === 3 ? loc.review_auto_3_star :
        false;
      const needsHuman = !!hit || !ratingAllowsAuto || !loc.review_auto_enabled;

      const { reply, confidence } = await generateReviewReply(loc, r);
      const escalationReason = hit?.reason || (!ratingAllowsAuto && rating > 0 && rating <= 2 ? 'Low-star review requires approval' : null);

      if (!needsHuman && reply && confidence >= Number(loc.confidence_threshold || 0.75)) {
        await postReviewReply(loc, r.google_review_name, reply);
        await query(
          `update ai_review_queue set status = 'auto_posted', suggested_response = $2, final_response = $2,
                  confidence = $3, needs_human_review = false, posted_at = now(), updated_at = now() where id = $1`,
          [r.id, reply, confidence],
        );
        await audit({ ghlLocationId: loc.ghl_location_id, reviewId: r.id, event: 'review_auto_posted', detail: { rating, confidence } });
        results.auto_posted = (results.auto_posted || 0) + 1;
      } else {
        await query(
          `update ai_review_queue set status = 'awaiting_approval', suggested_response = $2,
                  confidence = $3, needs_human_review = true, escalation_reason = $4, updated_at = now() where id = $1`,
          [r.id, reply, confidence, escalationReason],
        );
        await audit({ ghlLocationId: loc.ghl_location_id, reviewId: r.id, event: 'review_queued_for_approval', detail: { rating, confidence, reason: escalationReason } });
        if (hit || rating <= 2) {
          await queueEmailNotification({
            to: STAFF_NOTIFY_EMAIL,
            subject: `⭐ Review needs approval — ${loc.name} (${rating}★)`,
            body: `${r.author_name || 'Anonymous'} left a ${rating}★ review:\n\n"${(r.review_text || '').slice(0, 500)}"\n\n${escalationReason ? `Flag: ${escalationReason}\n\n` : ''}Suggested reply is waiting in the portal → AI Conversations → Reviews.`,
            eventType: 'ai_review_approval',
            clientId: loc.client_id || undefined,
            relatedId: r.id,
          });
        }
        results.awaiting_approval = (results.awaiting_approval || 0) + 1;
      }
    } catch (e: any) {
      await query(`update ai_review_queue set status = 'failed', error = $2, updated_at = now() where id = $1`, [r.id, String(e?.message || e).slice(0, 400)]);
      results.failed = (results.failed || 0) + 1;
    }
  }
  return results;
}
