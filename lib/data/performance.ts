/**
 * Performance period data for Prime IV Hydration & Wellness — Niceville.
 *
 * ---------------------------------------------------------------
 * SWAP POINT: Replace the exports below with live data from:
 *   - Supabase query
 *   - API route (e.g. `fetch('/api/performance?clientId=prime-iv')`)
 *   - CRM sync / webhook
 *
 * The consuming component (`PerformanceOverview`) depends only on
 * the `PeriodMetrics` and `PerformanceData` types. Keep the shape
 * and everything works.
 * ---------------------------------------------------------------
 */

export type PeriodMetrics = {
  label: string;            // e.g. "Q1 2026", "April 2026"
  shortLabel: string;       // e.g. "Q1", "Apr"
  totalLeads: number;
  revenueClosed: number;
  wonDeals: number;
  conversionRate: number;   // pre-calculated %
  revenuePerLead: number;   // pre-calculated $
  /** Optional: set when the period is still in progress (mid-month, mid-quarter).
   *  Triggers projection-based framing instead of a raw vs-baseline comparison
   *  so we don't tell a client they're "down" before the period has finished. */
  inProgress?: boolean;
  /** Days elapsed in the period — required when inProgress is true. */
  daysElapsed?: number;
  /** Total days in the period — required when inProgress is true. */
  daysInPeriod?: number;
};

export type PerformanceData = {
  clientId: string;
  periods: PeriodMetrics[];
};

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ── Mock data ─────────────────────────────────────────────────
export const PRIME_IV_PERFORMANCE: PerformanceData = {
  clientId: 'prime-iv',
  periods: [
    {
      label: 'Q1 2026 (Jan–Mar)',
      shortLabel: 'Q1',
      totalLeads: 735,
      revenueClosed: 136330.12,
      wonDeals: 148,
      conversionRate: 20.1,
      revenuePerLead: 185.48,
    },
    {
      label: 'April 2026 (in progress)',
      shortLabel: 'Apr',
      totalLeads: 83,
      revenueClosed: 8857.75,
      wonDeals: 6,
      conversionRate: 7.2,
      revenuePerLead: 106.72,
      inProgress: true,
      daysElapsed: 16,   // Apr 1 – Apr 16, 2026
      daysInPeriod: 30,
    },
  ],
};

export function getPerformanceForClient(clientId: string): PerformanceData | null {
  const map: Record<string, PerformanceData> = {
    'prime-iv': PRIME_IV_PERFORMANCE,
  };
  return map[clientId] ?? null;
}
