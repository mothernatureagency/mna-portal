# Shared agent operations pilot

Open **AI Agents → Agent Operations**. Select **Prime IV Pinecrest** for the pilot.

The existing portal MCP stays at `https://portal.mothernatureagency.com/api/mcp`. Claude and a compatible ChatGPT MCP connection can use the same endpoint and their own authenticated identities. This change adds two shared tools:

- `get_agent_operations` (`marketing:read`): scoped monthly plan, run, drafts, manager monitor and handoffs.
- `add_agent_handoff` (`tasks:write`): an attributed internal handoff to a named role. It neither invokes a model nor approves or sends a campaign. The sender label is not a provider identity; the authenticated actor is recorded separately.

Connecting one app does not connect the other, copy its history, or transfer its custom instructions/skills. The automated OpenAI step uses the explicit copywriting rules in this repository. Each app must connect independently. No credentials are included in this repository.

## Roles and execution

Claude co-CEO writes one operations brief. OpenAI co-CEO reads that handoff and writes one monthly content pack. Social, CRM/SMS, ads and operations managers receive role-based assignments in the shared record. These are bounded workflow roles, not six constantly running model processes.

The pack includes an escaped, mobile-friendly newsletter HTML design; two independent SMS campaigns for member and prospect audiences; up to 31 social drafts from the imported plan; ads recommendations based on the month's saved metrics; and missing-information requests. All campaigns start `pending_review`. Social posts start `Draft`, pending review, with automatic posting disabled. Newsletter HTML can be copied into Revive after review. The placeholder `{{unsubscribe_link}}` must be mapped to Revive's actual unsubscribe merge field before a live send.

One generation uses at most two provider calls (Claude 1,200 output tokens; OpenAI 4,000 output tokens), without automatic retries. An unchanged client/month/plan/approved-offer combination returns its existing run, including a failed or interrupted run, rather than billing again. A global PostgreSQL advisory lock caps new runs at six per UTC database day. This is a call/token bound, not a guaranteed dollar budget. Configure an inexpensive model and provider-level spending controls. Claude usage flows into the existing Anthropic ledger; both providers' reported token counts are retained on the run. OpenAI charges are not included in the Anthropic credit balance.

Failed runs stay visible. Correct the input before creating a different run; there is no silent regeneration loop. A run that was interrupted after dispatch may still have incurred provider charges. Runs stuck for over three minutes appear in monitoring. The campaign/content writes are atomic; secondary handoff failure does not erase an already committed pack.

## Deployment settings

Existing `ANTHROPIC_API_KEY`, database and Supabase settings are reused. Add server-only settings in Vercel:

- `OPENAI_API_KEY`: OpenAI project API credential.
- `OPENAI_COPY_MODEL`: an available text model supporting Responses API Structured Outputs. Deliberately no expensive implicit default.
- `OPERATIONS_CLAUDE_MODEL`: optional; defaults to `claude-haiku-4-5`.
- `CRON_SECRET`: a strong random secret. Vercel's daily `/api/operations/monitor` worker requires an exact bearer match and rejects requests when unconfigured. It never trusts a bare cron header.

`maxDuration=180` on the generation route must be supported by the Vercel plan. The daily monitor runs at 14:00 UTC for at most 100 current-month plans, without any model calls. It updates the last-check record and creates deduplicated internal requests for detected issues. It does not email people, text customers, optimize ads or change spend. Current monitors cover CRM review/escalation/failure counts, missing Revive credentials, absent saved ad metrics, overdue campaigns and failed/stalled monthly runs. A periodic ads API sync or operator update is still needed to keep saved metrics fresh.

The operations tables are created on first use, following this repository's schema-on-demand convention. No API keys, CRM tokens or customer conversation bodies are copied into the monthly context. Context uses only the selected client's plan, approved offers, aggregate metrics and queue counts.

## Pinecrest pilot checklist

1. Keep Pinecrest auto-response off and AI paused while testing. The existing draft-only test does not contact Revive and therefore does **not** validate a saved token's scopes.
2. Verify the Revive Private Integration token belongs to Pinecrest and has the scopes required by `docs/ai-crm-setup-guide.md`. Store it in AI Conversations → Locations, never in a plan or handoff.
3. Import the real Diamond plan by pasting its text and recording the source. Confirm booking URL, mailing address, franchise-partner approval email and proposed send date. A source URL alone is not a document import.
4. Review the location's knowledge base. The live pilot currently contains conflicting pricing instructions, and its booking calendar ID is empty. Resolve these before testing pricing or booking behavior.
5. Generate once, review the pack, then publish selected drafts to the franchise partner using the existing campaign/content visibility controls. Requests appear in Task Manager; they do not send external notifications.
6. Configure and test inbound Revive webhooks separately. The repository's current AI CRM fallback worker is scheduled daily, so it is not a low-latency polling replacement.
7. Verify the existing Make/Revive sender integration separately. `/api/campaigns/poll` is session authenticated, lists approved copy, and does not itself send. Its response includes planned dates; the sender must honor timezone, consent, audience mapping, unsubscribe merge fields and idempotency. This patch does not activate that integration or send a test SMS.
8. Use one consented internal test recipient before any customer campaign. Approvals are human decisions. Model handoffs have no approval or delivery capability.

## Campaign corrections

- Edits to approved copy, client, audience or timing clear approval and return to review in the same locked update. Editing and approving in the same request is rejected. Sent copy cannot be rewritten.
- Approval checks required links, opt-out text, incomplete placeholders, em/en dashes and one-segment SMS. These checks do not prove a link is live, validate consent or replace the operator's review.
- Counts distinguish GSM-7, GSM extension characters, Unicode/surrogate pairs, and toll-free concatenation. The UI uses the operator's Revive rate instead of assuming a fixed rate; estimates exclude carrier fees and personalization/tracking changes.
- Campaign reads are scoped for franchise clients; only staff can edit or approve sending. Franchise clients may comment or request changes on their visible campaigns.
- Legacy campaign generation uses an exact client-name match for social context and no longer falls back to another client's content.

## Verification

Run `node --test tests/operations.test.cjs` and `npx tsc --noEmit --incremental false`.
Tests cover encoding boundaries, approval invalidation, cross-client denial, newsletter escaping, two-call orchestration, deduplication, missing-plan blocking and incomplete-output handling. Provider and database calls are mocked in these tests; production PostgreSQL/provider/Revive end-to-end verification is still required in staging.

References: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Twilio SMS segment limits](https://www.twilio.com/docs/glossary/what-sms-character-limit).
