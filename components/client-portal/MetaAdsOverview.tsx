'use client';

/**
 * Meta Ads dashboard for the client portal.
 *
 * The client-facing counterpart to the staff /meta-ads page: the same live
 * Graph numbers, minus the account picker, raw account IDs and debug panel.
 * Campaign spend is real money the client is paying for, so this shows the
 * per-campaign breakdown rather than a single blended total.
 *
 * Which ad account is read is decided server-side from the signed-in user —
 * the adAccountId sent here is a hint, and /api/meta/* rejects anything the
 * caller isn't entitled to.
 */

import { useEffect, useMemo, useState } from 'react';

type Totals = {
  totalSpend: number;
  totalClicks: number;
  totalImpressions: number;
  cpc: number;
  ctr: number;
  campaignCount: number;
};

type InsightsResponse = {
  datePreset: string;
  totals: Totals;
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

const DATE_PRESETS = [
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
];

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtInt(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export default function MetaAdsOverview({
  clientId,
  adAccountId,
  gradientFrom,
  gradientTo,
}: {
  clientId: string;
  adAccountId?: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [datePreset, setDatePreset] = useState('last_30d');
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // The account saved for this client takes priority over the static config.
  const [kvAccount, setKvAccount] = useState<string | null>(null);
  const [kvLoaded, setKvLoaded] = useState(false);

  useEffect(() => {
    setKvLoaded(false);
    fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=meta_ads`)
      .then((r) => r.json())
      .then((d) => setKvAccount(d?.value?.adAccountId || null))
      .catch(() => setKvAccount(null))
      .finally(() => setKvLoaded(true));
  }, [clientId]);

  const account = useMemo(() => {
    const raw = kvAccount || adAccountId;
    if (!raw) return undefined;
    return raw.startsWith('act_') ? raw : `act_${raw}`;
  }, [kvAccount, adAccountId]);

  useEffect(() => {
    if (!kvLoaded) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const q = account ? `&adAccountId=${encodeURIComponent(account)}` : '';
    fetch(`/api/meta/insights?datePreset=${datePreset}${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        if (d?.error) { setFailed(true); return; }
        setInsights(d);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account, datePreset, kvLoaded]);

  // Nothing to show and nothing pending — stay out of the client's way.
  if (!loading && (failed || !insights)) return null;

  const t = insights?.totals;
  const kpis = t
    ? [
        { label: 'Ad Spend', value: fmtUSD(t.totalSpend), color: '#06b6d4' },
        { label: 'Impressions', value: fmtInt(t.totalImpressions), color: '#8b5cf6' },
        { label: 'Clicks', value: fmtInt(t.totalClicks), color: '#0ea5e9' },
        { label: 'Cost / Click', value: fmtUSD(t.cpc), color: '#ec4899' },
      ]
    : [];

  const rows = (insights?.rows || []).slice().sort((a, b) => b.spend - a.spend);

  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black text-white"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              f
            </span>
            Meta Ads Performance
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            How your Facebook &amp; Instagram campaigns are performing.
          </p>
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border text-white focus:outline-none self-start"
          style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-[12px] text-white/55 py-8 text-center">Loading your ad performance…</div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl p-3 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: k.color }} />
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/45 mt-1">{k.label}</div>
                <div className="text-[22px] md:text-[26px] font-black text-white leading-none my-1.5 tabular-nums">{k.value}</div>
                <div className="text-[10px] text-white/45">
                  {t!.campaignCount} campaign{t!.campaignCount === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>

          {/* Click-through rate */}
          {t && (
            <div
              className="rounded-xl p-3.5 mt-3 flex flex-wrap items-center justify-between gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">Click-through rate</div>
                <div className="text-[20px] font-black text-white leading-none mt-1 tabular-nums">{fmtPct(t.ctr)}</div>
              </div>
              <div className="text-[11px] text-white/50">
                {fmtInt(t.totalClicks)} clicks from {fmtInt(t.totalImpressions)} impressions
              </div>
            </div>
          )}

          {/* Per-campaign breakdown */}
          {rows.length > 0 && (
            <div className="mt-5">
              <div className="text-[12px] font-bold text-white mb-2.5">Campaign breakdown</div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-white/45 border-b border-white/10">
                      <th className="pb-2 font-semibold">Campaign</th>
                      <th className="pb-2 font-semibold text-right">Spend</th>
                      <th className="pb-2 font-semibold text-right">Clicks</th>
                      <th className="pb-2 font-semibold text-right">Impressions</th>
                      <th className="pb-2 font-semibold text-right">Cost / Click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.campaignId} className="border-b border-white/5 last:border-none">
                        <td className="py-2.5 text-[12.5px] text-white font-medium">{r.campaignName}</td>
                        <td className="py-2.5 text-right text-[12.5px] text-white/90 tabular-nums">{fmtUSD(r.spend)}</td>
                        <td className="py-2.5 text-right text-[12.5px] text-white/75 tabular-nums">{fmtInt(r.clicks)}</td>
                        <td className="py-2.5 text-right text-[12.5px] text-white/75 tabular-nums">{fmtInt(r.impressions)}</td>
                        <td className="py-2.5 text-right text-[12.5px] text-white/75 tabular-nums">{fmtUSD(r.cpc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.campaignId}
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="text-[12.5px] font-semibold text-white mb-1.5">{r.campaignName}</div>
                    <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                      <span className="text-white/45">Spend</span>
                      <span className="text-white text-right tabular-nums">{fmtUSD(r.spend)}</span>
                      <span className="text-white/45">Clicks</span>
                      <span className="text-white/80 text-right tabular-nums">{fmtInt(r.clicks)}</span>
                      <span className="text-white/45">Impressions</span>
                      <span className="text-white/80 text-right tabular-nums">{fmtInt(r.impressions)}</span>
                      <span className="text-white/45">Cost / click</span>
                      <span className="text-white/80 text-right tabular-nums">{fmtUSD(r.cpc)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div className="text-[12px] text-white/40 italic mt-4">
              No campaign activity in this period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
