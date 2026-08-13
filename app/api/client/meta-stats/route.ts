import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import {
  fetchAccountSummary,
  fetchDailyInsights,
  fetchCampaignInsights,
  type DatePreset,
} from '@/lib/meta';
import { getPortalAuth, canAccessClient } from '@/lib/portal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/client/meta-stats?clientId=prime-iv&datePreset=last_30d
 *
 * Client-safe Meta Ads stats. Unlike /api/meta/insights (which takes a raw
 * adAccountId and has no scoping), this route resolves the ad account
 * server-side from the clientId and enforces that client-role users can only
 * read their own account. Never falls back to the house META_AD_ACCOUNT_ID —
 * an unconfigured client sees { configured: false }, not someone else's spend.
 */

const PRESETS: DatePreset[] = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'this_month', 'last_month'];

async function adAccountFor(clientId: string): Promise<string | null> {
  const kv = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = 'meta_ads'`,
    [clientId],
  );
  const fromKv = kv.rows[0]?.value?.adAccountId as string | undefined;
  const fromStatic = staticClients.find((c) => c.id === clientId)?.metaAds?.adAccountId;
  const raw = fromKv || fromStatic || null;
  if (!raw) return null;
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  if (!canAccessClient(auth, clientId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const presetParam = req.nextUrl.searchParams.get('datePreset') || 'last_30d';
  const datePreset: DatePreset = (PRESETS as string[]).includes(presetParam)
    ? (presetParam as DatePreset)
    : 'last_30d';

  const adAccountId = await adAccountFor(clientId);
  if (!adAccountId) {
    return NextResponse.json({ configured: false, datePreset });
  }

  try {
    const [totals, daily, campaigns] = await Promise.all([
      fetchAccountSummary(adAccountId, datePreset),
      fetchDailyInsights(adAccountId, datePreset),
      fetchCampaignInsights(adAccountId, datePreset),
    ]);
    return NextResponse.json({
      configured: true,
      datePreset,
      totals,
      daily,
      // Biggest spenders first so the table leads with what matters.
      campaigns: campaigns.sort((a, b) => b.spend - a.spend),
    });
  } catch (e: any) {
    return NextResponse.json(
      { configured: true, datePreset, error: e?.message || 'Meta API error' },
      { status: 502 },
    );
  }
}
