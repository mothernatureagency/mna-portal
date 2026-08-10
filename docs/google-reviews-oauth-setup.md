# Google Reviews via OAuth (no Places API key)

The Review Responses page (`/review-responses`) can now pull a client's
Google reviews and post owner replies through the **Google Business
Profile API**, using the same OAuth client that powers the Google
Calendar connection — no Places API key required.

## How it works

1. A staff member clicks **Connect Google** (Review Responses page or
   Schedule page — it's the same connection) and grants the
   `business.manage` scope. Tokens land in the existing `google_tokens`
   table.
2. On the Review Responses page, pick which Business Profile location
   belongs to the active client. The mapping is stored in `client_kv`
   under key `gbp_location` along with the connector's email, so any
   staff member can sync afterwards.
3. **Sync reviews** pulls *all* reviews (not just the 5 the Places API
   returns) and upserts them into `google_reviews` — the same table the
   Make.com webhook uses, so `GoogleReviewsCard` and the dashboards keep
   working unchanged.
4. Reviews without a reply appear under **Awaiting reply**. "Draft all"
   generates suggested replies (Claude), and **Post reply to Google**
   publishes the reply live on the profile via the API.

## One-time Google Cloud setup

On the Cloud project that owns the OAuth client
(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`):

1. **Enable these APIs** (APIs & Services → Library):
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API (v4 — used for reviews and replies)
2. **Request GBP API access.** Google grants new projects **0 quota** on
   the Business Profile APIs until you submit the access request form:
   https://developers.google.com/my-business/content/prereqs#request-access
   Fill it out with the project number; approval usually takes a few
   days. Until it's approved, syncs will fail with a quota/403 error
   (the UI surfaces Google's message verbatim).
3. **OAuth consent screen**: add the scope
   `https://www.googleapis.com/auth/business.manage`. While the app is
   in "Testing" mode, the connecting Google account must be listed as a
   test user.
4. The redirect URI is unchanged:
   `https://portal.mothernatureagency.com/api/google/callback`.

## Notes

- The connecting Google account must be an **owner or manager** of the
  Business Profile locations you want to sync.
- Anyone who connected Google before this feature must **disconnect and
  reconnect** so the new scope is consented (same as when Drive access
  was added).
- The Make.com webhook sync (`/api/google-reviews-sync`) still works and
  can run alongside — both upsert by `(client_id, google_review_id)`.
