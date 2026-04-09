import { NextRequest, NextResponse } from 'next/server';
import { fetchCampaigns, getDefaultAdAccountId } from '@/lib/meta';

export const runtime = 'nodejs';
// Don't cache the route response — lib/meta.ts already caches upstream Graph
// calls for 60s, which is the right place for it.
export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/campaigns
 * Optional query: ?adAccountId=act_319815037244678
 * Defaults to META_AD_ACCOUNT_ID from env.
 *
 * Returns: { campaigns: [{id, name, status, objective?, ...}] }
 */
export async function GET(req: NextRequest) {
  try {
    const adAccountId = req.nextUrl.searchParams.get('adAccountId') || getDefaultAdAccountId();
    const campaigns = await fetchCampaigns(adAccountId);
    return NextResponse.json({ adAccountId, campaigns });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
