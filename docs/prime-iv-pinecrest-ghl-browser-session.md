# Prime IV Pinecrest — GHL browser session prompt

For an agent with browser access, to do the Gate 1 config work in the Pinecrest
sub-account. Companion to `prime-iv-pinecrest-sms-agent.md`.

**Before you use it:** log into HighLevel yourself and hand over the
already-authenticated browser. Never paste credentials into a chat.

**Why a browser session at all:** there is no HighLevel connector in the MCP
registry, so this work cannot be done from a normal Claude session. It is UI
work either way — the only question is who clicks.

---

## The prompt

```
You have browser access to a HighLevel account (white-labeled as Revive Sales
CRM). I need you to inspect the Prime IV Pinecrest sub-account and make one
specific configuration fix.

BUSINESS TRUTH
Prime IV Pinecrest is open 10:00 AM to 6:00 PM, seven days a week.
The booking calendars currently read Mon-Fri 9:00 AM - 5:25 PM with weekends
unavailable. Every part of that is wrong: the day opens an hour too early,
closes 35 minutes too early, and the weekends are missing entirely.

"Intro Offer" is the live voucher calendar. "Intro Offer v1" is an orphan.

The homepage embeds six booking widgets. These are the calendar IDs it loads,
so they are the calendars actually reachable by a client:

  Intro Offer        E4ABdKZvxxZeddla5KGZ
  Member Appointment oRZeRkyavE37L54bgnt4
  IV Therapy         oRZeRkyavE37L54bgnt4   <-- same id as Member Appointment
  Injections         s8IIIyGejdkR1arB4ovd
  Peptide Consult    5gMBFSK3O0ZRPwfStOsf
  NAD+ Consult       pjt0JEGF9TkEHk2rpsPs

The IV Therapy and Member Appointment tabs load the SAME calendar. Report
whether that is deliberate or a copy-paste error on the page, because a
non-member booking IV therapy currently lands on the member calendar.

=== THIS ACCOUNT CONTAINS PROTECTED HEALTH INFORMATION ===
It is a medical spa. Clients text about symptoms, conditions, medications and
reactions, and appointments tie named people to treatments.

- Do NOT open, read, copy, quote or transcribe any client conversation,
  appointment detail, or contact record.
- If a client name or health detail appears on screen while you work, do not
  write it down, summarize it, or include it in your report.
- Report configuration and counts only, never content. "14 contacts carry the
  Peptide field" is fine. Naming any of them is not.
- Do not export or download anything.

HARD RULES
- Never send a message to a contact or reply in any conversation.
- Never enable, activate, unpause or test any AI agent or workflow.
- Never purchase anything, change billing, sign an agreement, or touch
  account or plan settings.
- Never delete a calendar, contact, workflow or integration. If something
  looks like it should go, report it instead.
- Never disconnect an integration. Report it and let me decide.
- If a screen asks for credentials or 2FA, stop and hand back to me.

=== PHASE 1: RECONNAISSANCE — change nothing, then report and wait ===

1. CALENDARS. List every calendar in this sub-account. For each: its name, its
   ID, its availability schedule (days and hours), whether it is client-facing,
   and what booking link points at it. Match them against the six IDs above and
   tell me which of those six each one is. Flag any near-duplicates, and flag
   any calendar NOT in that list that still looks client-facing.

2. VERIFY THE LIVE VOUCHER CALENDAR. I have been told "Intro Offer" is the
   live one. Confirm it by following the public booking links at
   linktr.ee/primeivpinecrest and primeivpinecrest.com and seeing which
   calendar they actually land on. If they land anywhere other than
   "Intro Offer", stop and tell me — that changes the build. Also report
   whether "Intro Offer v1" still has any live link or workflow pointing at
   it, so we know whether it can be retired safely.

3. INTEGRATIONS. Open Settings > Integrations and any connected-apps or
   marketplace-install screen. List every outbound integration attached to
   this sub-account, and for each say whether it appears to receive message
   or contact content. Do not disconnect anything.

4. CONVERSATION AI. Open the Conversation AI settings screen. Report:
   - Is it available on this plan, and is it currently on or off?
   - What modes exist (suggestive / draft-only vs auto-pilot / auto-send)?
   - The EXACT names of every configuration field — prompt, agent goal,
     business information, training, intents, supported channels, whatever
     it actually calls them. Screenshot the empty form.
   I have a prompt and knowledge base written against assumed field names
   and need to know what the real ones are.

5. HIPAA MODULE. Report whether it shows as active on this account. Do not
   purchase or activate it.

6. CALENDAR HOURS. Report what hours each calendar currently holds, before
   changing anything. The real hours are 10-6 seven days; the calendars are
   believed to read Mon-Fri 9:00 AM - 5:25 PM. Confirm before I ask you to
   edit.

7. USERS AND NOTIFICATIONS. Report whether pinecrest@primeivhydration.com
   exists as a user on this sub-account (a workflow needs to @-mention it) and
   whether jkulkusky@primeivhydration.com does too. Also report, for the
   notification settings you can see, whether notification emails include the
   message body or only a link to the conversation. Do not add, remove or
   change any user.

Write up 1-7 and stop. Do not proceed to Phase 2 until I confirm.

=== PHASE 2: THE ONE EDIT — only after I confirm ===

8. On the client-facing booking calendars only, set availability to
   10:00 AM - 6:00 PM, Sunday through Saturday. "Intro Offer" is one of
   them. Leave "Intro Offer v1" alone — it is being retired, not fixed.

   One calendar at a time. Screenshot the schedule before and after each
   change, and tell me the calendar's name as you go. If a calendar's purpose
   is unclear, skip it and ask.

   Change only the availability hours and days. Do not touch slot duration,
   buffers, capacity, notifications, team assignment or anything else.

Report what you changed, with before/after for each calendar.
```

---

## Why it's shaped this way

**Reconnaissance before edits.** Even with the live calendar named, the public
links are the real test — a voucher link pointing somewhere unexpected would
mean editing the wrong calendar and calling it success.

**Item 4 is the real prize.** The build pack's field names are assumed. Once
the actual Conversation AI field names are known, the prompt and knowledge base
paste in without guesswork.

**The PHI rule sits above the task rules** and forbids *transcribing*, not just
*accessing*. An agent working in the calendar UI will unavoidably have client
names cross its screen; what matters is that none of it reaches the chat log.

**Integrations are report-only.** Which ones get disconnected or fenced is a
BAA decision, not an agent's, and pulling a live integration mid-audit could
break posting or reporting.
