'use client';

import { useEffect, useState } from 'react';

type InsightsResponse = {
  adAccountId: string;
  datePreset: string;
  totals: {
    totalSpend: number;
    totalClicks: number;
    totalImpressions: number;
    cpc: number;
    ctr: number;
    campaignCount: number;
  };
  rows: Array<{
    campaignId: string;
    campaignName: string;
    spend: number;
    clicks: number;
    impressions: number;
    cpc: number;
  }>;
  error?: string;
};

type CampaignsResponse = {
  adAccountId: string;
  campaigns: Array<{ id: string; name: string; status: string; objective?: string }>;
  error?: string;
};

const DATE_PRESETS = [
  { value: 'last_7d',  label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
  PAUSED:   'bg-amber-400/20 text-amber-200 border-amber-400/30',
  ARCHIVED: 'bg-neutral-400/15 text-neutral-300 border-neutral-400/30',
  DELETED:  'bg-rose-400/20 text-rose-200 border-rose-400/30',
};

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function formatInt(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
function formatPct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export default function MetaAdsDashboardPage() {
  const [datePreset, setDatePreset] = useState('last_30d');
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [insRes, campRes] = await Promise.all([
          fetch(`/api/meta/insights?datePreset=${datePreset}`).then((r) => r.json()),
          fetch('/api/meta/campaigns').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (insRes.error) throw new Error(insRes.error);
        if (campRes.error) throw new Error(campRes.error);
        setInsights(insRes);
        setCampaigns(campRes);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load Meta Ads data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [datePreset]);

  const kpis = insights ? [
    { label: 'Total Spend',       value: formatUSD(insights.totals.totalSpend),       color: '#f59e0b' },
    { label: 'Total Clicks',      value: formatInt(insights.totals.totalClicks),      color: '#3b82f6' },
    { label: 'Total Impressions', value: formatInt(insights.totals.totalImpressions), color: '#8b5cf6' },
    { label: 'CPC',               value: formatUSD(insights.totals.cpc),              color: '#06b6d4' },
  ] : [];

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>
              ads_click
            </span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Meta Ads Dashboard</h1>
          </div>
          <p className="text-white/60 mt-1 text-sm">
            {insights?.adAccountId || campaigns?.adAccountId || 'Loading ad account…'} ·
            Live Graph API pull
          </p>
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="text-[12px] font-semibold rounded-xl px-3 py-2 bg-white/10 text-white border border-white/20"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value} className="bg-neutral-900">{p.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="glass-card p-5 border border-rose-400/30 bg-rose-400/10">
          <div className="text-rose-200 font-semibold text-sm">Meta API error</div>
          <div className="text-rose-100/80 text-xs mt-1 font-mono">{error}</div>
          <div className="text-white/60 text-xs mt-3">
            Common fixes: ensure META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are set in Vercel env,
            and that the token still has ads_read + ads_management scopes. Long-lived tokens
            expire after ~60 days.
          </div>
        </div>
      )}

      {loading && !insights && (
        <div className="glass-card p-8 text-center text-white/60">Loading Meta Ads data…</div>
      )}

      {/* KPIs */}
      {insights && (
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: k.color }} />
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">{k.label}</div>
              <div className="text-[30px] font-black text-white leading-none my-2">{k.value}</div>
              <div className="text-[11px] text-white/50">
                {insights.datePreset.replace(/_/g, ' ')} · {insights.totals.campaignCount} campaigns
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTR tile (full width secondary row) */}
      {insights && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Overall CTR</div>
              <div className="text-[24px] font-black text-white leading-none mt-1">{formatPct(insights.totals.ctr)}</div>
            </div>
            <div className="text-[11px] text-white/50">
              {formatInt(insights.totals.totalClicks)} clicks / {formatInt(insights.totals.totalImpressions)} impressions
            </div>
          </div>
        </div>
      )}

      {/* Per-campaign insights table */}
      {insights && insights.rows.length > 0 && (
        <div className="glass-card p-5">
          <div className="text-[15px] font-bold text-white mb-4">Per-campaign performance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">
                  <th className="pb-2 font-semibold">Campaign</th>
                  <th className="pb-2 font-semibold text-right">Spend</th>
                  <th className="pb-2 font-semibold text-right">Clicks</th>
                  <th className="pb-2 font-semibold text-right">Impressions</th>
                  <th className="pb-2 font-semibold text-right">CPC</th>
                </tr>
              </thead>
              <tbody>
                {insights.rows
                  .slice()
                  .sort((a, b) => b.spend - a.spend)
                  .map((r) => (
                    <tr key={r.campaignId} className="border-b border-white/5 last:border-none">
                      <td className="py-3 text-white font-medium">{r.campaignName}</td>
                      <td className="py-3 text-right text-white/90 font-mono">{formatUSD(r.spend)}</td>
                      <td className="py-3 text-right text-white/80 font-mono">{formatInt(r.clicks)}</td>
                      <td className="py-3 text-right text-white/80 font-mono">{formatInt(r.impressions)}</td>
                      <td className="py-3 text-right text-white/80 font-mono">{formatUSD(r.cpc)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All campaigns list (even ones with zero spend in range) */}
      {campaigns && campaigns.campaigns.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-bold text-white">All campaigns</div>
            <div className="text-[11px] text-white/50">{campaigns.campaigns.length} total</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaigns.campaigns.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                  {c.objective && (
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">{c.objective.replace(/_/g, ' ')}</div>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${STATUS_COLORS[c.status] || 'bg-white/10 text-white/70 border-white/20'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {campaigns && campaigns.campaigns.length === 0 && !loading && (
        <div className="glass-card p-8 text-center text-white/60">
          No campaigns returned for this ad account.
        </div>
      )}
    </div>
  );
}
