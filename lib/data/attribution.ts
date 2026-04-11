/**
 * Attribution mock data for Prime IV Hydration & Wellness — Niceville.
 *
 * ---------------------------------------------------------------
 * SWAP POINT: Replace this file's exports with live data from:
 *   - Supabase query (e.g. `supabase.from('attribution').select(...)`)
 *   - API route (e.g. `fetch('/api/attribution?clientId=prime-iv')`)
 *   - Webhook sync from GHL / CRM
 *   - CSV / manual import
 *
 * The component that consumes this data (`AttributionOverview`)
 * only depends on the types exported below — keep the shape
 * the same and everything will work.
 * ---------------------------------------------------------------
 */

export type LeadSource = {
  source: string;
  count: number;
  color: string;
};

export type AttributionData = {
  clientId: string;
  clientName: string;
  period: string;
  totalLeads: number;
  revenueClosed: number;
  wonDeals: number;
  sources: LeadSource[];
};

// Derived metrics — computed at render time so they stay in sync
export function deriveMetrics(data: AttributionData) {
  const conversionRate = data.totalLeads > 0
    ? (data.wonDeals / data.totalLeads) * 100
    : 0;
  const revenuePerLead = data.totalLeads > 0
    ? data.revenueClosed / data.totalLeads
    : 0;
  const sourcesWithPct = data.sources.map((s) => ({
    ...s,
    percentage: data.totalLeads > 0
      ? +((s.count / data.totalLeads) * 100).toFixed(1)
      : 0,
  }));
  return { conversionRate, revenuePerLead, sourcesWithPct };
}

// ── Mock data ─────────────────────────────────────────────────
// Replace this constant with a fetch / query when ready.
export const PRIME_IV_ATTRIBUTION: AttributionData = {
  clientId: 'prime-iv',
  clientName: 'Prime IV Hydration & Wellness Niceville',
  period: 'All Time',
  totalLeads: 278,
  revenueClosed: 30528.70,
  wonDeals: 30,
  sources: [
    { source: 'Facebook',     count: 168, color: '#3b82f6' },
    { source: 'Other',        count: 46,  color: '#a855f7' },
    { source: 'Manual',       count: 16,  color: '#f59e0b' },
    { source: 'Instagram',    count: 8,   color: '#ec4899' },
    { source: 'Website Form', count: 8,   color: '#10b981' },
    { source: 'Conversation', count: 8,   color: '#06b6d4' },
    { source: 'Chat Widget',  count: 2,   color: '#6366f1' },
  ],
};

// Map client IDs to their attribution data.
// When multiple clients have attribution, add entries here.
export function getAttributionForClient(clientId: string): AttributionData | null {
  const map: Record<string, AttributionData> = {
    'prime-iv': PRIME_IV_ATTRIBUTION,
  };
  return map[clientId] ?? null;
}
