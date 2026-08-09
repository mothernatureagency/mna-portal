import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/db';
import { queueEmailNotification, STAFF_NOTIFY_EMAIL } from '@/lib/notifications';
import {
  GhlLocation,
  getLocationByGhlId,
  locationToken,
} from './locations';
import {
  contactOptedOut,
  getContact,
  getConversationMessages,
  searchConversations,
  sendMessage,
  GhlMessage,
} from './ghl';
import { checkEscalation, isOptOutMessage } from './safety';

/**
 * Core AI CRM pipeline:
 *   ingest (dedupe + delay) → process (context → Claude → safety → route)
 *   → auto-send through the location's own GHL subaccount, or hold for
 *   human approval. Every step is written to ai_audit_logs.
 */

const MODEL = process.env.AI_CRM_MODEL || 'claude-sonnet-5';

export type AiDecision = {
  suggested_response: string;
  confidence_score: number;
  intent: string;
  category: string;
  should_auto_send: boolean;
  escalation_reason: string | null;
  detected_service: string | null;
  detected_offer: string | null;
  needs_human_review: boolean;
};

export async function audit(params: {
  ghlLocationId?: string | null;
  messageId?: string | null;
  reviewId?: string | null;
  event: string;
  detail?: unknown;
  actor?: string;
}) {
  try {
    await query(
      `insert into ai_audit_logs (ghl_location_id, message_id, review_id, event, detail, actor)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        params.ghlLocationId || null,
        params.messageId || null,
        params.reviewId || null,
        params.event,
        params.detail === undefined ? null : JSON.stringify(scrub(params.detail)),
        params.actor || 'system',
      ],
    );
  } catch (e) {
    console.error('audit log failed', e);
  }
}

/** Strip anything token-shaped from audit detail before storing. */
function scrub(detail: unknown): unknown {
  try {
    const json = JSON.stringify(detail);
    return JSON.parse(
      json
        .replace(/Bearer [A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
        .replace(/pit-[A-Za-z0-9\-]+/g, '[redacted-token]'),
    );
  } catch {
    return null;
  }
}

// ── Conversation state (human takeover / pause / opt-out) ─────────────────

export async function getConversationState(ghlLocationId: string, contactId: string) {
  const { rows } = await query<any>(
    `select * from ai_conversation_state where ghl_location_id = $1 and contact_id = $2`,
    [ghlLocationId, contactId],
  );
  return rows[0] || null;
}

export async function setConversationState(
  ghlLocationId: string,
  contactId: string,
  patch: Partial<{ human_takeover: boolean; takeover_until: string | null; ai_paused: boolean; opted_out: boolean; conversation_id: string; last_human_reply_at: string }>,
) {
  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  await query(
    `insert into ai_conversation_state (ghl_location_id, contact_id, ${keys.join(', ')})
     values ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(', ')})
     on conflict (ghl_location_id, contact_id)
     do update set ${sets}, updated_at = now()`,
    [ghlLocationId, contactId, ...keys.map((k) => (patch as any)[k])],
  );
}

function takeoverActive(state: any): boolean {
  if (!state) return false;
  if (state.ai_paused || state.opted_out) return true;
  if (!state.human_takeover) return false;
  // Cooldown: takeover_until in the past releases the takeover automatically.
  if (state.takeover_until && new Date(state.takeover_until).getTime() < Date.now()) return false;
  return true;
}

// ── Ingest ────────────────────────────────────────────────────────────────

/**
 * Record an inbound message for processing. Idempotent on
 * (location, external message id) — duplicates are dropped, which makes
 * webhook retries and webhook+polling overlap safe.
 */
export async function ingestInboundMessage(params: {
  ghlLocationId: string;
  externalMessageId: string;
  conversationId?: string | null;
  contactId?: string | null;
  body?: string | null;
  channel?: string;
  source?: string;
}): Promise<{ id: string | null; duplicate: boolean }> {
  const loc = await getLocationByGhlId(params.ghlLocationId);
  const delay = loc ? Number(loc.response_delay_seconds || 0) : 60;
  const { rows } = await query<{ id: string }>(
    `insert into ai_messages (ghl_location_id, external_message_id, conversation_id, contact_id, inbound_body, channel, status, process_after)
     values ($1, $2, $3, $4, $5, $6, 'pending', now() + ($7 || ' seconds')::interval)
     on conflict (ghl_location_id, external_message_id) do nothing
     returning id`,
    [
      params.ghlLocationId,
      params.externalMessageId,
      params.conversationId || null,
      params.contactId || null,
      params.body || null,
      params.channel || 'SMS',
      String(Math.max(0, delay)),
    ],
  );
  const id = rows[0]?.id || null;
  if (id) {
    await audit({
      ghlLocationId: params.ghlLocationId,
      messageId: id,
      event: 'inbound_received',
      detail: { source: params.source || 'webhook', channel: params.channel || 'SMS', delay_seconds: delay },
    });
  }
  return { id, duplicate: !id };
}

// ── Prompt construction ───────────────────────────────────────────────────

function buildSystemPrompt(loc: GhlLocation): string {
  const services = (loc.services || [])
    .map((s) => `- ${s.name}${s.price ? ` — ${s.price}` : ''}${s.description ? `: ${s.description}` : ''}`)
    .join('\n');
  const kb = [
    `Business name: ${loc.name}`,
    loc.address ? `Address: ${loc.address}` : null,
    loc.business_phone ? `Phone: ${loc.business_phone}` : null,
    loc.business_hours ? `Hours: ${loc.business_hours}` : null,
    loc.website ? `Website: ${loc.website}` : null,
    loc.booking_url ? `Booking link: ${loc.booking_url}` : null,
    services ? `Services:\n${services}` : null,
    loc.pricing ? `Pricing notes: ${loc.pricing}` : null,
    loc.offers ? `Current offers/promotions: ${loc.offers}` : null,
    loc.membership_info ? `Membership info: ${loc.membership_info}` : null,
    loc.faqs ? `FAQs:\n${loc.faqs}` : null,
  ].filter(Boolean).join('\n');

  return `You are a friendly front-desk team member replying to customer text messages for the business below. You are texting from the business's own phone number.

=== BUSINESS KNOWLEDGE BASE (the ONLY facts you may state) ===
${kb}
=== END KNOWLEDGE BASE ===

HARD RULES:
- Only state services, prices, hours, availability, policies, and promotions that appear in the knowledge base above. If asked about something not listed, say you'll have a team member confirm, or point them to the booking link/phone.
- NEVER invent pricing, services, availability, policies, or promotions. NEVER make medical claims or give medical advice.
- Never mention AI, automation, chatbots, Claude, GoHighLevel, Revive, or Mother Nature Agency. You are simply "the team".
- Sound natural, warm, and human. Text like a real person: casual-professional, no corporate filler.
- Keep SMS replies short (1-3 sentences) unless the question clearly needs more.
- If the customer should book, include the booking link when it exists.
- If the message is sensitive (medical questions, reactions, emergencies, pregnancy, medication interactions, legal, privacy, refunds, serious complaints, harassment, media, jobs) or you are at all unsure, set needs_human_review=true and should_auto_send=false, and write the best suggested reply for a human to review.
${loc.approved_language ? `\nAPPROVED LANGUAGE / PHRASES TO PREFER:\n${loc.approved_language}` : ''}
${loc.restricted_language ? `\nRESTRICTED LANGUAGE — never use these words/claims:\n${loc.restricted_language}` : ''}
${loc.restricted_claims ? `\nRESTRICTED CLAIMS — never state or imply:\n${loc.restricted_claims}` : ''}
${loc.tone_instructions ? `\nTONE:\n${loc.tone_instructions}` : ''}
${loc.escalation_instructions ? `\nESCALATION GUIDANCE FOR THIS LOCATION:\n${loc.escalation_instructions}` : ''}
${loc.custom_prompt ? `\nADDITIONAL INSTRUCTIONS:\n${loc.custom_prompt}` : ''}

Reply by calling the reply_decision tool with your structured decision. confidence_score reflects how certain you are that the suggested reply is accurate, on-policy, and safe to send with no human check.`;
}

const REPLY_TOOL: Anthropic.Tool = {
  name: 'reply_decision',
  description: 'Return the reply decision for the latest inbound customer message.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggested_response: { type: 'string', description: 'The reply text to send to the customer.' },
      confidence_score: { type: 'number', description: '0-1 confidence that this reply is accurate, on-policy, and safe to auto-send.' },
      intent: { type: 'string', description: 'Customer intent, e.g. booking_request, pricing_question, hours_question, reschedule, complaint, general.' },
      category: { type: 'string', description: 'One of: booking, pricing, hours, services, offers, membership, support, complaint, medical, other.' },
      should_auto_send: { type: 'boolean' },
      escalation_reason: { type: ['string', 'null'], description: 'Why a human should review, if applicable.' },
      detected_service: { type: ['string', 'null'] },
      detected_offer: { type: ['string', 'null'] },
      needs_human_review: { type: 'boolean' },
    },
    required: ['suggested_response', 'confidence_score', 'intent', 'category', 'should_auto_send', 'needs_human_review'],
  },
};

async function callClaude(loc: GhlLocation, transcript: string, contactSummary: string): Promise<AiDecision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(loc),
    tools: [REPLY_TOOL],
    tool_choice: { type: 'tool', name: 'reply_decision' },
    messages: [
      {
        role: 'user',
        content: `CONTACT:\n${contactSummary}\n\nCONVERSATION (oldest first, last line is the new inbound message to answer):\n${transcript}`,
      },
    ],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model returned no structured decision');
  const d = toolUse.input as any;
  return {
    suggested_response: String(d.suggested_response || '').trim(),
    confidence_score: Math.max(0, Math.min(1, Number(d.confidence_score) || 0)),
    intent: String(d.intent || 'general'),
    category: String(d.category || 'other'),
    should_auto_send: !!d.should_auto_send,
    escalation_reason: d.escalation_reason ? String(d.escalation_reason) : null,
    detected_service: d.detected_service ? String(d.detected_service) : null,
    detected_offer: d.detected_offer ? String(d.detected_offer) : null,
    needs_human_review: !!d.needs_human_review,
  };
}

// ── Processing ────────────────────────────────────────────────────────────

async function finalize(id: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`update ai_messages set ${sets}, updated_at = now() where id = $1`, [
    id,
    ...keys.map((k) => patch[k]),
  ]);
}

/**
 * Process one pending inbound message end-to-end. Safe to call twice — the
 * status flip to 'processing' is atomic, so only one worker wins.
 */
export async function processMessage(messageId: string): Promise<string> {
  const { rows } = await query<any>(
    `update ai_messages set status = 'processing', updated_at = now()
      where id = $1 and status = 'pending' returning *`,
    [messageId],
  );
  const msg = rows[0];
  if (!msg) return 'skipped_not_pending';
  const locId: string = msg.ghl_location_id;

  try {
    const loc = await getLocationByGhlId(locId);
    if (!loc) {
      await finalize(messageId, { status: 'failed', error: 'Unknown location' });
      return 'failed';
    }
    const token = locationToken(loc);
    if (!token) {
      await finalize(messageId, { status: 'failed', error: 'No API token configured for location' });
      return 'failed';
    }

    // Location-level pause.
    if (loc.ai_paused) {
      await finalize(messageId, { status: 'skipped', error: 'AI paused for location' });
      await audit({ ghlLocationId: locId, messageId, event: 'skipped_location_paused' });
      return 'skipped';
    }

    // Contact + conversation discovery.
    let contactId: string | null = msg.contact_id;
    let conversationId: string | null = msg.conversation_id;
    if (!conversationId && contactId) {
      const convos = await searchConversations(token, locId, { contactId, limit: 1 });
      conversationId = convos[0]?.id || null;
    }
    if (!contactId || !conversationId) {
      await finalize(messageId, { status: 'failed', error: 'Missing contactId/conversationId' });
      return 'failed';
    }

    const contact = await getContact(token, contactId);
    const contactName = contact?.name || [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || null;

    // Per-contact state: human takeover / manual pause / opt-out.
    const state = await getConversationState(locId, contactId);
    if (takeoverActive(state)) {
      await finalize(messageId, {
        status: 'human_takeover', contact_name: contactName, contact_phone: contact?.phone || null,
        conversation_id: conversationId,
      });
      await audit({ ghlLocationId: locId, messageId, event: 'skipped_human_takeover' });
      return 'human_takeover';
    }

    // Opt-out: STOP-style message or DND on the contact.
    if (isOptOutMessage(msg.inbound_body || '') || contactOptedOut(contact)) {
      await setConversationState(locId, contactId, { opted_out: true, conversation_id: conversationId });
      await finalize(messageId, {
        status: 'skipped', error: 'Contact opted out', contact_name: contactName,
        contact_phone: contact?.phone || null, conversation_id: conversationId,
      });
      await audit({ ghlLocationId: locId, messageId, event: 'skipped_opt_out' });
      return 'skipped';
    }

    // Pull recent history from the location's own subaccount only.
    const history = await getConversationMessages(token, conversationId, 25);

    // Grouping-delay check: if a human (outbound) replied after this inbound
    // message arrived, cancel — a person is actively handling it.
    const createdAt = new Date(msg.created_at).getTime();
    const humanReplied = history.some(
      (m) => m.direction === 'outbound' && m.dateAdded && new Date(m.dateAdded).getTime() >= createdAt,
    );
    if (humanReplied) {
      await setConversationState(locId, contactId, { last_human_reply_at: new Date().toISOString(), conversation_id: conversationId });
      await finalize(messageId, {
        status: 'canceled', error: 'Human replied during delay window', contact_name: contactName,
        contact_phone: contact?.phone || null, conversation_id: conversationId,
      });
      await audit({ ghlLocationId: locId, messageId, event: 'canceled_human_replied' });
      return 'canceled';
    }

    // If several inbound texts arrived close together, answer only the
    // newest one (the others were grouped into its context).
    const newestInbound = [...history].reverse().find((m) => m.direction === 'inbound');
    if (newestInbound && msg.external_message_id !== newestInbound.id) {
      const { rows: newer } = await query(
        `select 1 from ai_messages where ghl_location_id = $1 and external_message_id = $2 and id <> $3`,
        [locId, newestInbound.id, messageId],
      );
      if (newer.length > 0) {
        await finalize(messageId, {
          status: 'skipped', error: 'Grouped into a newer inbound message', contact_name: contactName,
          contact_phone: contact?.phone || null, conversation_id: conversationId,
        });
        await audit({ ghlLocationId: locId, messageId, event: 'skipped_grouped' });
        return 'skipped';
      }
    }

    const inboundBody = msg.inbound_body || newestInbound?.body || '';
    const transcript = history
      .filter((m) => m.body)
      .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.body}`)
      .join('\n') || `Customer: ${inboundBody}`;
    const contactSummary = [
      contactName ? `Name: ${contactName}` : 'Name: unknown',
      contact?.phone ? `Phone: ${contact.phone}` : null,
      contact?.tags?.length ? `Tags: ${contact.tags.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const contextUsed = {
      transcript_lines: history.filter((m) => m.body).length,
      contact_summary: contactSummary,
      knowledge_base_fields: ['hours', 'services', 'pricing', 'offers', 'faqs', 'booking_url'].filter((f) => (loc as any)[f === 'hours' ? 'business_hours' : f]),
    };

    // Pre-model hard safety screen on the inbound text.
    const preHit = checkEscalation(inboundBody, loc.escalation_keywords);

    // Generate.
    const decision = await callClaude(loc, transcript, contactSummary);
    await audit({ ghlLocationId: locId, messageId, event: 'ai_decision', detail: { ...decision, pre_screen: preHit } });

    const needsReview = decision.needs_human_review || !!preHit;
    const escalationReason = preHit?.reason || decision.escalation_reason;
    const category = preHit?.category || decision.category;
    const threshold = Number(loc.confidence_threshold || 0.75);

    const autoSend =
      loc.auto_respond_enabled &&
      !needsReview &&
      decision.should_auto_send &&
      decision.confidence_score >= threshold &&
      !!decision.suggested_response;

    const base = {
      contact_name: contactName,
      contact_phone: contact?.phone || null,
      conversation_id: conversationId,
      inbound_body: inboundBody || msg.inbound_body,
      context_used: JSON.stringify(contextUsed),
      suggested_response: decision.suggested_response,
      confidence: decision.confidence_score,
      intent: decision.intent,
      category,
      should_auto_send: autoSend,
      needs_human_review: needsReview,
      escalation_reason: escalationReason,
      detected_service: decision.detected_service,
      detected_offer: decision.detected_offer,
    };

    if (!autoSend) {
      const status = needsReview ? 'escalated' : 'awaiting_approval';
      await finalize(messageId, { ...base, status });
      await audit({ ghlLocationId: locId, messageId, event: status, detail: { reason: escalationReason || 'below threshold or auto-respond disabled' } });
      if (needsReview) {
        await queueEmailNotification({
          to: STAFF_NOTIFY_EMAIL,
          subject: `⚠️ AI escalation — ${loc.name}`,
          body: `A message from ${contactName || contact?.phone || 'a customer'} needs human review.\n\nMessage: "${inboundBody}"\n\nReason: ${escalationReason || 'Model flagged for review'}\n\nSuggested reply (not sent): "${decision.suggested_response}"\n\nReview it in the portal → AI Conversations.`,
          eventType: 'ai_crm_escalation',
          clientId: loc.client_id || undefined,
          relatedId: messageId,
        });
      }
      return status;
    }

    // Final pre-send re-check: did a human jump in while we were generating?
    const recheck = await getConversationMessages(token, conversationId, 5);
    const humanJumpedIn = recheck.some(
      (m) => m.direction === 'outbound' && m.dateAdded && new Date(m.dateAdded).getTime() >= createdAt,
    );
    if (humanJumpedIn) {
      await finalize(messageId, { ...base, status: 'canceled', error: 'Human replied before send' });
      await audit({ ghlLocationId: locId, messageId, event: 'canceled_human_replied' });
      return 'canceled';
    }

    const sent = await sendMessage(token, { contactId, message: decision.suggested_response, type: 'SMS' });
    await finalize(messageId, {
      ...base,
      status: 'auto_sent',
      final_response: decision.suggested_response,
      sent_at: new Date().toISOString(),
      ghl_message_id: sent.messageId || null,
    });
    await audit({ ghlLocationId: locId, messageId, event: 'auto_sent', detail: { ghl_message_id: sent.messageId } });
    return 'auto_sent';
  } catch (e: any) {
    await finalize(messageId, { status: 'failed', error: String(e?.message || e).slice(0, 500) });
    await audit({ ghlLocationId: locId, messageId, event: 'error', detail: { error: String(e?.message || e).slice(0, 500) } });
    return 'failed';
  }
}

/** Process every pending message whose delay window has passed. */
export async function processDueMessages(limit = 10): Promise<Record<string, number>> {
  const { rows } = await query<{ id: string }>(
    `select id from ai_messages
      where status = 'pending' and (process_after is null or process_after <= now())
      order by created_at asc limit $1`,
    [limit],
  );
  const results: Record<string, number> = {};
  for (const r of rows) {
    const outcome = await processMessage(r.id);
    results[outcome] = (results[outcome] || 0) + 1;
  }
  return results;
}

// ── Polling fallback ──────────────────────────────────────────────────────

/**
 * For locations whose Revive plan can't register webhooks: scan recent
 * conversations for inbound messages we haven't seen and ingest them.
 * Dedupe makes this safe to run alongside webhooks.
 */
export async function pollLocationsForInbound(lookbackMinutes = 30): Promise<{ ingested: number }> {
  const { rows: locs } = await query<GhlLocation>(
    `select * from ghl_locations where polling_enabled = true and token_encrypted is not null and ai_paused = false`,
  );
  let ingested = 0;
  for (const loc of locs) {
    const token = locationToken(loc);
    if (!token) continue;
    try {
      const convos = await searchConversations(token, loc.ghl_location_id, { limit: 20 });
      const cutoff = Date.now() - lookbackMinutes * 60_000;
      for (const c of convos) {
        if (c.lastMessageDirection !== 'inbound') continue;
        if (c.lastMessageDate && Number(c.lastMessageDate) < cutoff) continue;
        const messages = await getConversationMessages(token, c.id, 5);
        for (const m of messages) {
          if (m.direction !== 'inbound' || !m.id) continue;
          if (m.dateAdded && new Date(m.dateAdded).getTime() < cutoff) continue;
          const res = await ingestInboundMessage({
            ghlLocationId: loc.ghl_location_id,
            externalMessageId: m.id,
            conversationId: c.id,
            contactId: m.contactId || c.contactId,
            body: m.body,
            source: 'polling',
          });
          if (!res.duplicate) ingested++;
        }
      }
    } catch (e) {
      await audit({ ghlLocationId: loc.ghl_location_id, event: 'polling_error', detail: { error: String((e as any)?.message || e).slice(0, 300) } });
    }
  }
  return { ingested };
}
