import { query } from './db';
import { getAccessToken } from './google-calendar';

/**
 * Read-only Google reporting for the client portal's Google Performance card.
 *
 * Both APIs ride on the Google OAuth connection staff already use for
 * Calendar and Drive (lib/google-calendar.ts), with the analytics.readonly
 * and webmasters.readonly scopes added. Staff must reconnect Google once for
 * consent to re-prompt with the new scopes.
 *
 * Google Ads is deliberately absent: it needs a developer token issued by
 * Google through an application process, which is separate from this OAuth
 * client. Those metrics stay staff-entered until that token exists.
 */

export type Ga4Metrics = {
  sessions: number;
  users: number;
  engaged: number;
  conversions: number;
  avgEngagement: number;
};

export type GscMetrics = {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

/** First and last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}` };
}

/**
 * The Google account used for reporting: the signed-in staff member when they
 * have connected Google, otherwise any connected account (the agency's).
 */
export async function reportingAccount(preferredEmail?: string): Promise<string | null> {
  if (preferredEmail) {
    const { rows } = await query('select 1 from google_tokens where user_email = $1', [preferredEmail]);
    if (rows.length > 0) return preferredEmail;
  }
  const { rows } = await query<{ user_email: string }>(
    'select user_email from google_tokens order by user_email limit 1',
  );
  return rows[0]?.user_email || null;
}

export async function fetchGa4Monthly(
  userEmail: string,
  propertyId: string,
  ym: string,
): Promise<Ga4Metrics | null> {
  const token = await getAccessToken(userEmail);
  if (!token) return null;
  const { start, end } = monthRange(ym);
  const id = propertyId.replace(/^properties\//, '');

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: start, endDate: end }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagedSessions' },
        { name: 'conversions' },
        { name: 'averageSessionDuration' },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const row = data?.rows?.[0]?.metricValues;
  if (!row) return { sessions: 0, users: 0, engaged: 0, conversions: 0, avgEngagement: 0 };
  const n = (i: number) => Number(row[i]?.value || 0);
  return {
    sessions: n(0),
    users: n(1),
    engaged: n(2),
    conversions: n(3),
    avgEngagement: n(4),
  };
}

export async function fetchGscMonthly(
  userEmail: string,
  siteUrl: string,
  ym: string,
): Promise<GscMetrics | null> {
  const token = await getAccessToken(userEmail);
  if (!token) return null;
  const { start, end } = monthRange(ym);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: [], rowLimit: 1 }),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const row = data?.rows?.[0];
  if (!row) return { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  return {
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    ctr: Number(row.ctr || 0) * 100, // API returns a 0–1 ratio
    position: Number(row.position || 0),
  };
}
