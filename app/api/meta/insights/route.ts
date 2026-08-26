import { NextRequest, NextResponse } from 'next/server';
import {
  aggregateInsights,
  fetchInsights,
  getDefaultAdAccountId,
  type DatePreset,
} from '@/lib/meta';
import { resolveAdAccountAccess } from '@/lib/meta-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PRESETS: DatePreset[] = [
  'today', 'yesterday', 'last_7d', 'last_14d',
  'last_30d', 'last_90d', 'this_month', 'last_month',
];

/**
 * GET /api/meta/insights
 * Query:
 *   ?adAccountId=act_319815037244678
 *   ?datePreset=last_30d  (see ALLOWED_PRESETS)
 *
 * Requires a signed-in user. Client-role users are restricted to the ad
 * accounts configured for the clients they're assigned to.
 *
 * Returns:
 *   {
 *     adAccountId,
 *     datePreset,
 *     totals: { totalSpend, totalClicks, totalImpressions, cpc, ctr, campaignCount },
 *     rows: [{ campaignId, campaignName, spend, clicks, impressions, cpc }, ...]
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    const access = await resolveAdAccountAccess(req.nextUrl.searchParams.get('adAccountId'));
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const adAccountId = access.adAccountId || getDefaultAdAccountId();
    const presetParam = req.nextUrl.searchParams.get('datePreset') as DatePreset | null;
    const datePreset: DatePreset = presetParam && ALLOWED_PRESETS.includes(presetParam)
      ? presetParam
      : 'last_30d';

    const raw = await fetchInsights(adAccountId, datePreset);
    const agg = aggregateInsights(raw);

    const { rows, ...totals } = agg;
    return NextResponse.json({
      adAccountId,
      datePreset,
      totals,
      rows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
