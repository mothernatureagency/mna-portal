'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from 'recharts';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

type Totals = {
  spend: number; impressions: number; clicks: number; cpc: number; ctr: number;
  reach: number; frequency: number; leads: number; cpl: number;
  dateStart: string | null; dateStop: string | null;
};
type DailyRow = { date: string; spend: number; impressions: number; clicks: number; leads: number };
type CampaignRow = {
  campaignId: string; campaignName: string; spend: number; impressions: number;
  clicks: number; cpc: number; ctr: number; leads: number; cpl: number;
};
type StatsResponse = {
  configured: boolean;
  datePreset: string;
  totals?: Totals;
  daily?: DailyRow[];
  campaigns?: CampaignRow[];
  error?: string;
};

const PRESETS: Array<{ id: string; label: string }> = [
  { id: 'last_7d', label: 'Last 7 days' },
  { id: 'last_14d', label: 'Last 14 days' },
  { id: 'last_30d', label: 'Last 30 days' },
  { id: 'last_90d', label: 'Last 90 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
];

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const fmtUSDWhole = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function GlassTooltip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px] shadow-xl"
      style={{ background: 'rgba(15,31,46,0.95)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(16px)' }}
    >
      <div className="font-bold text-white mb-0.5">{fmtDay(label)}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-white/70">
          {p.name}: <span className="text-white font-semibold">{money ? fmtUSD(p.value) : fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="material-symbols-outlined text-white/40" style={{ fontSize: 15 }}>{icon}</span>
        <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">{label}</div>
      </div>
      <div className="text-[22px] font-black text-white leading-none">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-1.5">{sub}</div>}
    </div>
  );
}

const AXIS_TICK = { fill: 'rgba(255,255,255,0.5)', fontSize: 10 };
const AXIS_LINE = { stroke: 'rgba(255,255,255,0.1)' };

export default function ClientStatsPage() {
  const { client } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;
  const [preset, setPreset] = useState('last_30d');
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/client/meta-stats?clientId=${encodeURIComponent(client.id)}&datePreset=${preset}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ configured: true, datePreset: preset, error: 'Could not load stats' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client.id, preset]);

  const totals = data?.totals;
  const daily = useMemo(() => data?.daily || [], [data]);
  const campaigns = data?.campaigns || [];
  const hasLeads = (totals?.leads || 0) > 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Ad Performance</h1>
          <span
            className="text-[15px] font-medium ml-1"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {client.name}
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Live results from your Meta ad campaigns — spend, reach, clicks, and leads, straight from the ad account.
        </p>
      </div>

      {/* Date range pills */}
      <div className="flex gap-1 p-1 rounded-xl flex-wrap w-fit" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
              preset === p.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-2.5 w-16 bg-white/10 rounded mb-3" />
              <div className="h-6 w-20 bg-white/15 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Not connected yet */}
      {!loading && data && !data.configured && (
        <div className="glass-card p-8 text-center">
          <span className="material-symbols-outlined text-white/30 mb-2" style={{ fontSize: 40 }}>cable</span>
          <div className="text-[15px] font-bold text-white mb-1">Ad account not connected yet</div>
          <div className="text-[12px] text-white/60 max-w-md mx-auto">
            Your MNA team is setting up the connection to your Meta ad account. Once it&apos;s linked, live
            performance stats will appear here automatically.
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && data?.configured && data.error && (
        <div className="glass-card p-8 text-center">
          <span className="material-symbols-outlined text-amber-300/70 mb-2" style={{ fontSize: 40 }}>hourglass_top</span>
          <div className="text-[15px] font-bold text-white mb-1">Stats are momentarily unavailable</div>
          <div className="text-[12px] text-white/60">Meta&apos;s reporting API didn&apos;t respond — try again in a minute.</div>
        </div>
      )}

      {!loading && totals && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon="payments" label="Ad Spend" value={fmtUSDWhole(totals.spend)} />
            {hasLeads && <StatTile icon="person_add" label="Leads" value={totals.leads.toLocaleString()} />}
            {hasLeads && <StatTile icon="request_quote" label="Cost per Lead" value={fmtUSD(totals.cpl)} />}
            <StatTile icon="visibility" label="Impressions" value={fmtCompact(totals.impressions)} />
            <StatTile icon="groups" label="Reach" value={fmtCompact(totals.reach)} sub={totals.frequency ? `Seen ~${totals.frequency.toFixed(1)}× per person` : undefined} />
            <StatTile icon="ads_click" label="Clicks" value={fmtCompact(totals.clicks)} />
            <StatTile icon="percent" label="Click-Through Rate" value={`${totals.ctr.toFixed(2)}%`} />
            <StatTile icon="attach_money" label="Cost per Click" value={fmtUSD(totals.cpc)} />
          </div>

          {/* Daily trend charts */}
          {daily.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <div className="text-[14px] font-bold text-white mb-4">Daily Spend</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={daily} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={(v: number) => `$${fmtCompact(v)}`} />
                    <ReTooltip content={<GlassTooltip money />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="spend" name="Spend" fill={gradientTo} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-6">
                <div className="text-[14px] font-bold text-white mb-4">{hasLeads ? 'Daily Leads' : 'Daily Clicks'}</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={daily} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="statsAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={gradientTo} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={gradientTo} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} tickFormatter={(v: number) => fmtCompact(v)} />
                    <ReTooltip content={<GlassTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                    <Area
                      type="monotone"
                      dataKey={hasLeads ? 'leads' : 'clicks'}
                      name={hasLeads ? 'Leads' : 'Clicks'}
                      stroke={gradientTo}
                      strokeWidth={2}
                      fill="url(#statsAreaFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Campaign breakdown */}
          {campaigns.length > 0 && (
            <div className="glass-card p-6">
              <div className="text-[14px] font-bold text-white mb-4">Campaign Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ minWidth: 640 }}>
                  <thead>
                    <tr className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      <th className="pb-2 pr-4">Campaign</th>
                      <th className="pb-2 pr-4 text-right">Spend</th>
                      <th className="pb-2 pr-4 text-right">Impressions</th>
                      <th className="pb-2 pr-4 text-right">Clicks</th>
                      <th className="pb-2 pr-4 text-right">CTR</th>
                      <th className="pb-2 pr-4 text-right">CPC</th>
                      {hasLeads && <th className="pb-2 pr-4 text-right">Leads</th>}
                      {hasLeads && <th className="pb-2 text-right">Cost / Lead</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.campaignId} className="text-[12px] text-white/80 border-t border-white/[0.06]">
                        <td className="py-2.5 pr-4 font-semibold text-white">{c.campaignName}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtUSD(c.spend)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtCompact(c.impressions)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtCompact(c.clicks)}</td>
                        <td className="py-2.5 pr-4 text-right">{c.ctr.toFixed(2)}%</td>
                        <td className="py-2.5 pr-4 text-right">{fmtUSD(c.cpc)}</td>
                        {hasLeads && <td className="py-2.5 pr-4 text-right">{c.leads.toLocaleString()}</td>}
                        {hasLeads && <td className="py-2.5 text-right">{c.leads > 0 ? fmtUSD(c.cpl) : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-white/30 mt-3 italic">
                Data reported directly by Meta for the selected period. Leads count Meta&apos;s canonical lead events.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
