/**
 * Meta (Facebook) Marketing API helper.
 *
 * All calls go through `metaFetch` which:
 *  - reads META_ACCESS_TOKEN from the server env (never shipped to the browser)
 *  - targets a pinned Graph API version so behaviour is stable across Meta releases
 *  - surfaces Graph API error objects as thrown Errors we can catch in route handlers
 *
 * Designed to be multi-account from day one: every function takes an explicit
 * `adAccountId` so we can swap between act_319... (MNA house account) and
 * act_1975481426317109 (Prime IV Niceville) — just pass the one you want.
 */

const GRAPH_VERSION = 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error('META_ACCESS_TOKEN is not set in server environment.');
  }
  return token;
}

export function getDefaultAdAccountId(): string {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error('META_AD_ACCOUNT_ID is not set in server environment.');
  // Meta expects ids prefixed with "act_". Accept either form in env for safety.
  return id.startsWith('act_') ? id : `act_${id}`;
}

type MetaGraphError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

async function metaFetch<T>(
  path: string,
  searchParams: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('access_token', getAccessToken());

  const res = await fetch(url.toString(), {
    // Cache on the server for 60s to avoid hammering Graph during dashboard refreshes.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as MetaGraphError | null;
    const msg = body?.error?.message || `Graph API ${res.status}`;
    throw new Error(`[Meta] ${msg}`);
  }
  return (await res.json()) as T;
}

// ───────────────────────────────────────────────────────────────
// Campaigns
// ───────────────────────────────────────────────────────────────
export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export async function fetchCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
  const data = await metaFetch<{ data: MetaCampaign[] }>(`/${adAccountId}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget',
    limit: '50',
  });
  return data.data;
}

// ───────────────────────────────────────────────────────────────
// Insights
// ───────────────────────────────────────────────────────────────
export type MetaInsightRow = {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc?: string;
  ctr?: string;
  date_start: string;
  date_stop: string;
};

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'this_month'
  | 'last_month';

export async function fetchInsights(
  adAccountId: string,
  datePreset: DatePreset = 'last_30d'
): Promise<MetaInsightRow[]> {
  const data = await metaFetch<{ data: MetaInsightRow[] }>(`/${adAccountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,impressions,clicks,spend,cpc,ctr',
    date_preset: datePreset,
    limit: '100',
  });
  return data.data;
}

// ───────────────────────────────────────────────────────────────
// Aggregation — turns the raw row array into the card metrics the
// dashboard wants. All numeric fields in Graph come back as strings,
// so we parse carefully and default to 0.
// ───────────────────────────────────────────────────────────────
export type AggregatedInsights = {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  cpc: number;           // overall cost per click
  ctr: number;           // overall click-through rate (0..1)
  campaignCount: number;
  rows: Array<{
    campaignId: string;
    campaignName: string;
    spend: number;
    clicks: number;
    impressions: number;
    cpc: number;
  }>;
};

export function aggregateInsights(rows: MetaInsightRow[]): AggregatedInsights {
  let totalSpend = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  const rowsOut = rows.map((r) => {
    const spend = Number(r.spend || 0);
    const clicks = Number(r.clicks || 0);
    const impressions = Number(r.impressions || 0);
    totalSpend += spend;
    totalClicks += clicks;
    totalImpressions += impressions;
    return {
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      spend,
      clicks,
      impressions,
      cpc: clicks > 0 ? spend / clicks : 0,
    };
  });

  return {
    totalSpend,
    totalClicks,
    totalImpressions,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    campaignCount: rowsOut.length,
    rows: rowsOut,
  };
}

// ───────────────────────────────────────────────────────────────
// Leads (scaffold for future leads_retrieval integration)
// A Lead Ad in Meta lives under a Page Form. The flow is:
//   ad account → lead_gen_forms → each form → leads
// We expose a stub here so the /api/meta/leads route has something
// stable to call once you add the pages_manage_ads scope.
// ───────────────────────────────────────────────────────────────
export type MetaLeadFormStub = {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
};

export async function fetchLeadForms(adAccountId: string): Promise<MetaLeadFormStub[]> {
  try {
    const data = await metaFetch<{ data: MetaLeadFormStub[] }>(
      `/${adAccountId}/leadgen_forms`,
      { fields: 'id,name,status,leads_count', limit: '50' }
    );
    return data.data;
  } catch (e) {
    // leadgen_forms is only available on the Page, not the ad account, in some
    // permission configurations. Return empty rather than surface a 500 so the
    // dashboard UI can degrade gracefully.
    return [];
  }
}
