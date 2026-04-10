# Make.com Scenario Setup — Airbnb/VRBO Booking Sync

This guide walks through setting up a Make.com scenario that watches your
MNA inbox for Airbnb and VRBO booking confirmation emails, parses them,
and pushes the data to the portal dashboard.

---

## Prerequisites

- Gmail forwarding rule set up: personal Gmail → mn@mothernatureagency.com
- Filter: from `automated@airbnb.com` OR `noreply@vrbo.com`, subject contains "reservation" or "booking"
- Make.com account (free tier works — 1,000 ops/month)

---

## Step-by-Step Setup in Make.com

### Step 1: Create New Scenario

1. Go to make.com → Scenarios → Create a new scenario
2. Name it: **"Serenity STR — Booking Sync"**

### Step 2: Add Gmail Watch Module

1. Click the **+** button → search for **Google Email** → select **Watch Emails**
2. Connect your **mn@mothernatureagency.com** account (OAuth flow)
3. Configure:
   - **Folder:** INBOX
   - **Criteria filter:** From contains `airbnb.com` OR From contains `vrbo.com`
   - **Mark as read:** Yes (so we don't reprocess)
   - **Max results:** 10
4. Set scheduling: **Every 15 minutes**

### Step 3: Add Router

1. After the Gmail module, click **+** → search for **Router**
2. This splits the flow into two paths: Airbnb and VRBO

### Step 4: Airbnb Path — Text Parser

1. On Route 1, add a **filter**: Email from contains `airbnb.com`
2. Add a **Text Parser → Match Pattern** module
3. Parse the email body text for:

   **Guest Name:**
   ```
   Pattern: Reservation confirmed.*?from\s+([A-Za-z\s]+?)[\n.,]
   ```

   **Check-in Date:**
   ```
   Pattern: Check-in[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})
   ```

   **Check-out Date:**
   ```
   Pattern: Checkout[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})
   ```

   **Total Payout:**
   ```
   Pattern: (?:Total payout|You earn|Your payout)[:\s]*\$([\d,]+\.?\d*)
   ```

   **Confirmation Code:**
   ```
   Pattern: (?:Confirmation code)[:\s]*([A-Z0-9]+)
   ```

> TIP: Run the scenario once with a real Airbnb booking email first,
> then look at the raw email text to fine-tune these patterns.

### Step 5: Airbnb Path — HTTP POST

1. After the text parser, add **HTTP → Make a Request**
2. Configure:
   - **URL:** `https://portal.mothernatureagency.com/api/hospitable-sync`
   - **Method:** POST
   - **Headers:**
     - `Content-Type: application/json`
   - **Body type:** Raw → JSON
   - **Body:**

```json
{
  "type": "reservations",
  "clientId": "serenity-bayfront",
  "data": [{
    "platform": "Airbnb",
    "reservation_id": "{{confirmation_code}}",
    "guest_name": "{{guest_name}}",
    "check_in": "{{check_in_formatted}}",
    "check_out": "{{check_out_formatted}}",
    "total_payout": {{total_payout}},
    "status": "confirmed"
  }]
}
```

### Step 6: VRBO Path (Same Pattern)

1. On Route 2, add a **filter**: Email from contains `vrbo.com` OR `homeaway.com`
2. Add **Text Parser** with VRBO-specific patterns (similar structure, slightly different email template)
3. Add **HTTP POST** to same endpoint but with `"platform": "VRBO"`

### Step 7: Test

1. Click **Run once**
2. Forward a real Airbnb booking email to mn@mothernatureagency.com
3. Watch the scenario execute — check parsed values
4. Verify data appears at: `https://portal.mothernatureagency.com/api/hospitable-sync?clientId=serenity-bayfront&type=summary`

### Step 8: Activate

1. Toggle the scenario **ON**
2. It now runs every 15 minutes, checking for new booking emails

---

## What the Dashboard Shows After Sync

Once data flows in, the Serenity dashboard will display:

- **Occupancy Rate** — computed from booked vs available nights
- **ADR** — average nightly rate from reservation payouts
- **RevPAR** — occupancy x ADR
- **Booking Pace** — bookings this month vs target
- **Revenue by Channel** — Airbnb vs VRBO vs Direct breakdown
- **Upcoming Bookings** — next 90 days with guest names and payouts
- **Review Velocity** — (requires separate email parsing for review notifications)

---

## Adding Reviews Later

To sync reviews, create a second scenario:

1. Watch for emails from Airbnb/VRBO containing "review" in subject
2. Parse: guest name, rating (stars), review text
3. POST to same endpoint with `"type": "reviews"`

---

## API Reference

**Endpoint:** `POST https://portal.mothernatureagency.com/api/hospitable-sync`

**Reservation payload:**
```json
{
  "type": "reservations",
  "clientId": "serenity-bayfront",
  "data": [{
    "platform": "Airbnb",
    "reservation_id": "ABC123",
    "guest_name": "Jane Smith",
    "check_in": "2026-05-15",
    "check_out": "2026-05-18",
    "nightly_rate": 325,
    "total_payout": 975,
    "status": "confirmed"
  }]
}
```

**Check data:** `GET https://portal.mothernatureagency.com/api/hospitable-sync?clientId=serenity-bayfront&type=summary`
