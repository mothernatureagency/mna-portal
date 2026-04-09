import { NextRequest, NextResponse } from 'next/server';
import {
  aggregateInsights,
  fetchInsights,
  getDefaultAdAccountId,
  type DatePreset,
} from '@/lib/meta';

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
    const adAccountId = req.nextUrl.searchParams.get('adAccountId') || getDefaultAdAccountId();
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
