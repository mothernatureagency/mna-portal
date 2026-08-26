import { NextRequest, NextResponse } from 'next/server';
import { fetchCampaigns, getDefaultAdAccountId } from '@/lib/meta';
import { resolveAdAccountAccess } from '@/lib/meta-access';

export const runtime = 'nodejs';
// Don't cache the route response — lib/meta.ts already caches upstream Graph
// calls for 60s, which is the right place for it.
export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/campaigns
 * Optional query: ?adAccountId=act_319815037244678
 * Defaults to META_AD_ACCOUNT_ID from env.
 *
 * Requires a signed-in user. Client-role users are restricted to the ad
 * accounts configured for the clients they're assigned to.
 *
 * Returns: { campaigns: [{id, name, status, objective?, ...}] }
 */
export async function GET(req: NextRequest) {
  try {
    const access = await resolveAdAccountAccess(req.nextUrl.searchParams.get('adAccountId'));
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const adAccountId = access.adAccountId || getDefaultAdAccountId();
    const campaigns = await fetchCampaigns(adAccountId);
    return NextResponse.json({ adAccountId, campaigns });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
