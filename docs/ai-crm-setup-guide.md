# AI CRM (Revive / GoHighLevel) — Setup Guide

The portal is the AI + control layer. All customer communication still flows
through each client's **existing Revive/GHL subaccount** and phone number — no
clients are migrated anywhere.

```
Customer → Revive/GHL location → webhook (or polling) → portal
        → Claude → safety + confidence rules → GHL API → customer
```

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | already set | Claude API |
| `AI_TOKEN_ENCRYPTION_KEY` | **new, required** | Any long random string. Encrypts GHL tokens at rest (AES-256-GCM). Rotating it invalidates saved tokens — re-enter them in the UI after rotating. |
| `AI_CRM_WEBHOOK_SECRET` | optional | Global fallback webhook key; per-location `webhook_secret` (set in the UI) takes precedence. |
| `AI_CRM_MODEL` | optional | Defaults to `claude-sonnet-5`. |
| `AI_CRM_RETAIN_DAYS` | optional | Days resolved conversations keep their message text before it's scrubbed (default 30; `0` = scrub as soon as resolved). Metadata is kept. |
| `SYNC_SECRET` | already set | Also guards `/api/ai-crm/process` and `/api/ai-crm/reviews/sync` for manual triggers (Vercel cron calls pass automatically). |
| `POSTGRES_URL`, Supabase vars, `GOOGLE_CLIENT_ID/SECRET` | already set | Reused as-is. |

Database tables (`ghl_locations`, `ai_messages`, `ai_conversation_state`,
`ai_audit_logs`, `ai_review_queue`) are auto-created by `lib/db.ts` on first
request — no migration step.

## 2. Per-location GHL Private Integration

In each Revive subaccount: **Settings → Private Integrations → New**, with scopes:

- `contacts.readonly` — contact info + DND/opt-out status
- `conversations.readonly` — find conversations
- `conversations/message.readonly` — read history
- `conversations/message.write` — send replies from the client's number
- `calendars.readonly`, `calendars/events.readonly`, `calendars/events.write` —
  read real availability and create appointments (only needed when the
  location uses AI booking)

Copy the `pit-…` token into the portal: **AI Conversations → Locations →
Connect location**. The token is encrypted server-side and never returned to
the browser.

## 3. Inbound message detection

**Preferred — webhook.** In the subaccount build a workflow:
*Trigger: Customer Replied (SMS)* → *Action: Webhook (POST)* to

```
https://portal.mothernatureagency.com/api/ai-crm/webhook?key=<webhook secret>
```

with body fields: `locationId`, `contactId`, `conversationId`, `messageId`,
`body`, `direction` (`inbound`), `messageType` (`SMS`). Native GHL
`InboundMessage` webhook payloads work unchanged.

**Fallback — polling.** If Revive has disabled workflow webhooks on a plan,
toggle **Polling fallback** on the location. The `/api/ai-crm/process` cron
(every 5 min) then scans recent conversations for unseen inbound messages.
Duplicate protection makes running both at once safe.

> Vercel note: the `*/5 * * * *` cron requires a paid Vercel plan (Hobby only
> allows daily crons). On Hobby, either rely on the webhook path (it processes
> inline, cron is just a safety net) or trigger
> `GET /api/ai-crm/process?key=<SYNC_SECRET>` from Make.com on a schedule.

## 4. How a message flows

1. Webhook/polling records the message — idempotent on `(location, message id)`.
2. Waits the location's **response delay** (default 60s) for grouping; if a
   human replies in that window, the AI response is canceled.
3. Checks: location AI paused? contact human-managed/paused? opted out (STOP
   or GHL DND)?
4. Pulls contact + last 25 messages **from that location only**, builds the
   prompt from that location's knowledge base only.
5. Claude returns structured output: `suggested_response`, `confidence_score`,
   `intent`, `category`, `should_auto_send`, `escalation_reason`,
   `detected_service`, `detected_offer`, `needs_human_review`.
6. Hard-coded safety rules (medical, adverse reactions, emergencies,
   pregnancy, medication interactions, legal, HIPAA/privacy, refunds, serious
   complaints, harassment, media, employment + per-location keywords) run
   independently of the model — a match always forces human review.
7. Auto-sends only when: auto-respond on, no escalation, confidence ≥
   location threshold, not opted out, no human active. Otherwise it lands in
   the approval queue (escalations also email `mn@mothernatureagency.com` via
   the existing Make notification queue).
8. Everything is written to `ai_audit_logs`. Tokens never appear in logs or
   the frontend.

## 5. Google Reviews AI module

Independent of GHL review features — uses the **Google Business Profile API**
directly, via the portal's existing Google OAuth (a `business.manage` scope was
added — reconnect Google once in Schedule/Settings so consent re-prompts, using
a Google account that manages the client profiles).

Per location, set **GBP account ID** and **GBP location ID** (from
`https://businessprofile.google.com` URL or the Account Management API) and the
Google account email used to connect. Daily cron `/api/ai-crm/reviews/sync`
pulls new reviews and:

- 4–5★ → auto-posts when "Auto-post 4–5★" is on
- 3★ → auto-posts only if "Also auto-post 3★" is on
- 1–2★ → always waits for approval
- any review touching medical harm, privacy, legal, billing, discrimination,
  or serious complaints → always waits for approval, regardless of rating

Approve/edit/reject from **AI Conversations → Reviews**. The GBP API requires a
verified Business Profile and API access enabled on the Google Cloud project
(request via the [GBP API access form](https://developers.google.com/my-business/content/prereqs)).

## 6. Dashboard

**AI Conversations** (sidebar → CRM):

- **Conversations** — feed with location/status/category/confidence/date/search
  filters, status counts, conversation drawer (full thread, AI decision log,
  edit → approve & send, reject, retry, human takeover / pause / resume per
  contact).
- **Reviews** — approval queue with editable replies, manual sync button.
- **Locations** — per-tenant editor: credentials, business info, services,
  pricing, offers, FAQs, membership, tone, approved/restricted language,
  restricted claims, escalation keywords/instructions, custom prompt,
  auto-respond toggle, confidence threshold, response delay, polling, GBP
  mapping. All editable without code changes.

## 7. HIPAA posture (lean setup)

Decided 2026-09: Revive's HIPAA add-on is active (their agency covers it), and
we run the portal in a data-minimizing mode rather than buying BAAs across the
whole hosting chain.

- **Revive/GHL** stays the system of record for all message content (covered
  by their HIPAA compliance). Patients consent to SMS through Revive opt-in.
- **Anthropic**: request a BAA with zero data retention for the API key used
  here (contact Anthropic sales). Until it's signed, keep auto-respond in
  approval-only mode for any location treating messages as PHI.
- **No PHI leaves the pipeline sideways**: escalation emails (which transit
  Make + Gmail, no BAA) carry only the location name and a category — never
  message text, names, or numbers. Audit logs store decision metadata
  (scores, categories, char counts), never message or reply text.
- **Retention**: `purgeExpiredMessageContent` (runs with the process cron)
  scrubs message text, contact name and phone from resolved conversations
  after `AI_CRM_RETAIN_DAYS` (default 30). Rows awaiting approval keep text
  until a human acts on them.
- Remaining known exposure: message text transits Vercel functions and rests
  in Supabase for up to the retention window. If counsel wants that closed,
  the options are Vercel Enterprise + Supabase HIPAA add-on, or moving the
  app to a host with a free BAA (e.g., AWS). Code is host-agnostic.

## 8. Calendar-aware booking

Set a location's **Booking calendar ID** (Revive → Calendars → the client-facing
calendar's ID) to enable booking. The engine then:

1. Pulls the next 7 days of real free slots before every AI reply. The model
   may only offer times from that list (max two), per the build spec.
2. When the customer explicitly agrees to one exact offered time, the model
   returns it as `proposed_appointment`.
3. **Hard rules run in code, not the prompt** (Booking section of the location
   editor): daily AI-booking cap, latest auto-book time, and a separate
   earlier cutoff for new clients (matched by contact tags). Any rule failure
   escalates to staff instead of booking — the reply is held too, so the AI
   never texts a confirmation for an appointment that wasn't created.
4. Auto mode books first, then sends the confirmation text. Approval mode
   stores the proposed slot; clicking Approve books it and then sends (if the
   slot was taken in the meantime, the approve fails loudly and nothing sends).

Fix the calendars before enabling booking (the Pinecrest spec: real hours are
10–6 seven days, but the calendars read 9:00–5:25 weekdays only — an AI
reading them would refuse weekend bookings).
