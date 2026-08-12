'use client';

/**
 * Niceville-specific dashboard layout.
 *
 * Separate from the default DashboardPage because almost every section is
 * different: content calendar on top, real revenue history, real ad spend
 * split (MNA $20/day + PDM $1290), no fabricated campaigns, no pipeline or
 * follow-up warnings until we have the API.
 *
 * All numbers in this file are either:
 *   (a) Confirmed real (marked REAL in comments), or
 *   (b) Projected from real data with an explicit formula, or
 *   (c) "—" / empty state with "awaiting API" language.
 *
 * No fabricated metrics.
 */

import React, { useState, useEffect } from 'react';
import type { Client } from '@/lib/clients';
import UserBanner from './UserBanner';
import MonthlyContentCalendar from './MonthlyContentCalendar';
import LeadSourceSplitEditor from './LeadSourceSplitEditor';
import CompetitorBenchmark from './CompetitorBenchmark';
import MetaAdsCard from './MetaAdsCard';
import PrimeIVMembershipCard from './PrimeIVMembershipCard';
import SalesBenchmarks from './SalesBenchmarks';
import KPISection from './KPISection';
import ConceptsPanel from './ConceptsPanel';
import TikTokAnalytics from './TikTokAnalytics';
import TikTokContentPlan from './TikTokContentPlan';
import YouTubeAnalytics from './YouTubeAnalytics';

// ─── REAL DATA ────────────────────────────────────────────────────────────
// Source: client provided directly on 2026-04-08
const REVENUE_HISTORY_DEFAULT = [
  { month: 'Jan 2026', value: 49_400, real: true },
  { month: 'Feb 2026', value: 52_500, real: true },
  { month: 'Mar 2026', value: 54_500, real: true },
];

// Q2 projections are computed off the average month-over-month growth rate
// of the 3 real history points above. We do this in-component so the numbers
// update automatically if you change the history array.
function computeProjections(history: { month: string; value: number }[]) {
  if (history.length < 2) return [];
  // Average MoM % growth
  let sum = 0;
  for (let i = 1; i < history.length; i++) {
    sum += (history[i].value - history[i - 1].value) / history[i - 1].value;
  }
  const avg = sum / (history.length - 1);
  const last = history[history.length - 1].value;
  const months = ['Apr 2026', 'May 2026', 'Jun 2026'];
  const out: { month: string; value: number; growth: number }[] = [];
  let running = last;
  for (const m of months) {
    running = running * (1 + avg);
    out.push({ month: m, value: Math.round(running / 100) * 100, growth: avg });
  }
  return out;
}

// Source: client confirmed 2026-04-08
// - MNA ads: $20/day × 30 days = $600/mo, all Meta (Facebook/Instagram)
// - PDM (Prime Digital Marketing): $1,290/mo, all Meta
// - No Google Ads running
const AD_SPEND_DEFAULT = [
  { agency: 'Mother Nature Agency', channel: 'Meta', monthly: 600, note: '$20/day daily budget' },
  { agency: 'PDM', channel: 'Meta', monthly: 1_290, note: 'Managed separately' },
];

// GHL Last 30 Days snapshot (manual pull 2026-04-08)
const GHL_DEFAULT = {
  totalOpportunities: 464,   // REAL
  openOpportunities: 346,    // REAL
  wonOpportunities: 77,      // REAL (booked & closed)
  lostOpportunities: 41,     // REAL
  conversionRate: 16.59,     // REAL
  conversionTarget: 14,      // target %
  pipelineValue: 160_620,    // REAL ($160.62K)
  wonRevenue: 72_990,        // REAL ($72.99K Won from GHL)
};

type RevRow = { month: string; value: number; real?: boolean };
type AdRow = { agency: string; channel: string; monthly: number; note: string };
type OverviewStats = { ghl: typeof GHL_DEFAULT; revenue: RevRow[]; adSpend: AdRow[] };

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

export default function NicevilleDashboard({ client }: { client: Client }) {
  const { gradientFrom, gradientTo } = client.branding;

  // Editable overview stats (persist per client to client_kv 'overview_stats').
  const [ghl, setGhl] = useState(GHL_DEFAULT);
  const [revenue, setRevenue] = useState<RevRow[]>(REVENUE_HISTORY_DEFAULT);
  const [adSpend, setAdSpend] = useState<AdRow[]>(AD_SPEND_DEFAULT);
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=overview_stats`)
      .then((r) => r.json())
      .then((d) => {
        const v = d?.value as Partial<OverviewStats> | null;
        if (v && typeof v === 'object') {
          if (v.ghl) setGhl({ ...GHL_DEFAULT, ...v.ghl });
          if (Array.isArray(v.revenue) && v.revenue.length) setRevenue(v.revenue);
          if (Array.isArray(v.adSpend) && v.adSpend.length) setAdSpend(v.adSpend);
        }
      })
      .catch(() => {});
  }, [client.id]);

  async function saveStats() {
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, key: 'overview_stats', value: { ghl, revenue, adSpend } }),
    }).catch(() => {});
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500);
    setEditing(false);
  }

  const projections = computeProjections(revenue);
  const totalAdSpend = adSpend.reduce((sum, r) => sum + r.monthly, 0);
  const q2Total = projections.reduce((sum, p) => sum + p.value, 0);
  const avgGrowth = projections.length > 0 ? projections[0].growth : 0;
  const maxHistoryValue = Math.max(...revenue.map((h) => h.value), ...projections.map((p) => p.value), 1);
  const lastRev = revenue[revenue.length - 1] || { month: '—', value: 0 };
  const prevRev = revenue[revenue.length - 2] || { month: '—', value: 0 };

  return (
    <div className="space-y-8 max-w-[1400px]">
      <UserBanner />

      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
            <h1 className="text-[22px] font-extrabold text-white tracking-tight">Overview</h1>
            <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {client.name}
            </span>
          </div>
          <p className="text-[12px] text-white/60 pl-3.5">
            Revenue actuals through March 2026 · Ad data verified with PDM split · GHL metrics manual pull
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-[11px] text-emerald-300">Saved ✓</span>}
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{editing ? 'close' : 'edit'}</span>
            {editing ? 'Close editor' : 'Edit stats'}
          </button>
        </div>
      </div>

      {/* Editable stats panel */}
      {editing && (
        <StatsEditor
          ghl={ghl} setGhl={setGhl}
          revenue={revenue} setRevenue={setRevenue}
          adSpend={adSpend} setAdSpend={setAdSpend}
          onSave={saveStats}
          gradientFrom={gradientFrom} gradientTo={gradientTo}
        />
      )}

      {/* Meta Ads Account — editable */}
      <MetaAdsCard client={client} accent={gradientFrom} />

      {/* ── KPIs ── */}
      <div>
        <SectionLabel>Performance KPIs</SectionLabel>
        <KPISection
          clientId={client.id}
          title="Niceville · Performance KPIs"
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          adAccountId={client.metaAds?.adAccountId}
          editable
        />
      </div>

      {/* ── CONTENT CALENDAR (moved to top per client request) ── */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <SectionLabel>Content Calendar</SectionLabel>
          <CorporateSeedButton clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        </div>
        <MonthlyContentCalendar clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        <div className="mt-3">
          <ConceptsPanel clientId={client.id} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        </div>
      </div>

      {/* ── MEMBERSHIP TIERS (pamphlet reference) ── */}
      <div>
        <SectionLabel>Prime IV Memberships · Pamphlet Reference</SectionLabel>
        <PrimeIVMembershipCard gradientFrom={gradientFrom} gradientTo={gradientTo} pricingTier="tier2" />
      </div>

      {/* ── COMPETITOR BENCHMARK (Meta + Google Reviews) ── */}
      <div>
        <SectionLabel>Competitive Position</SectionLabel>
        <CompetitorBenchmark gradientFrom={gradientFrom} gradientTo={gradientTo} clientId={client.id} clientName={client.shortName} editable />
      </div>

      {/* ── TIKTOK ANALYTICS ── */}
      <div>
        <SectionLabel>TikTok · Niceville</SectionLabel>
        <TikTokAnalytics
          ownerKey={client.id}
          kvClientId={client.id}
          label="Prime IV Niceville"
          niche="IV therapy / wellness / local Niceville FL"
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
        <div className="mt-3">
          <TikTokContentPlan
            ownerKey={client.id}
            kvClientId={client.id}
            label="Prime IV Niceville"
            niche="IV therapy / wellness / local Niceville FL"
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />
        </div>
      </div>

      {/* ── YOUTUBE ANALYTICS ── */}
      <div>
        <SectionLabel>YouTube · Niceville</SectionLabel>
        <YouTubeAnalytics
          ownerKey={client.id}
          kvClientId={client.id}
          label="Prime IV Niceville"
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
      </div>

      {/* ── SALES BENCHMARKS (manual entry: Niceville vs Destin vs Corporate) ── */}
      <div>
        <SectionLabel>Sales Benchmarks</SectionLabel>
        <SalesBenchmarks clientId={client.id} gradientFrom={gradientFrom} gradientTo={gradientTo} />
      </div>

      {/* ── KEY METRICS (honest — only values we actually have) ── */}
      <div>
        <SectionLabel>Key Metrics · Last 30 days (GHL)</SectionLabel>
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#0ea5e9' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Total Leads</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{ghl.totalOpportunities}</div>
            <div className="text-[11px] text-white/70">Open {ghl.openOpportunities} · Won {ghl.wonOpportunities} · Lost {ghl.lostOpportunities}</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#8b5cf6' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Conversion Rate</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{ghl.conversionRate}%</div>
            <div className="text-[11px] font-bold" style={{ color: '#7c3aed' }}>Target {ghl.conversionTarget}% · {ghl.conversionRate >= ghl.conversionTarget ? 'Exceeded ✦' : 'Below'}</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#ec4899' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Booked Appts</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{ghl.wonOpportunities}</div>
            <div className="text-[11px] text-white/70">Won opportunities</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#06b6d4' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">{lastRev.month.split(' ')[0]} Revenue</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{fmtUSD(lastRev.value)}</div>
            <div className="text-[11px] font-bold" style={{ color: '#059669' }}>{prevRev.value ? `${(lastRev.value / prevRev.value - 1) >= 0 ? '+' : ''}${Math.round((lastRev.value / prevRev.value - 1) * 100)}% vs ${prevRev.month.split(' ')[0]}` : ''}</div>
          </div>
        </div>

        {/* Note on CPL and pipeline — honest about what we don't have */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="glass-card p-5 relative overflow-hidden opacity-60">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#94a3b8' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Cost Per Lead</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">—</div>
            <div className="text-[11px] text-white/70">Blocked until we know paid vs walk-in split (Revive API)</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden opacity-60">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#94a3b8' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Pipeline Value</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">{fmtUSD(ghl.pipelineValue)}</div>
            <div className="text-[11px] text-white/70">GHL snapshot only · live API pending</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden opacity-60">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#94a3b8' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Today's Appointments</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">—</div>
            <div className="text-[11px] text-white/70">Awaiting scheduling API</div>
          </div>
        </div>
      </div>

      {/* ── REVENUE HISTORY + Q2 PROJECTIONS ── */}
      <div>
        <SectionLabel>Revenue · Actuals and Q2 projections</SectionLabel>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-white">Monthly revenue</div>
              <div className="text-[11px] text-white/70">
                3 real months from client · Q2 projected at {fmtPct(avgGrowth)} MoM (average of actuals)
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Projected Q2 total</div>
              <div className="text-[22px] font-black text-white">{fmtUSD(q2Total)}</div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40 mb-4">
            {[...revenue, ...projections.map((p) => ({ ...p, real: false }))].map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[11px] font-bold text-white/85">{fmtUSD(m.value)}</div>
                <div
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${(m.value / maxHistoryValue) * 100}%`,
                    background: m.real
                      ? `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})`
                      : `repeating-linear-gradient(45deg, ${gradientFrom}33, ${gradientFrom}33 6px, ${gradientFrom}11 6px, ${gradientFrom}11 12px)`,
                    border: m.real ? 'none' : `1px dashed ${gradientFrom}66`,
                  }}
                />
                <div className={`text-[10px] font-semibold ${m.real ? 'text-white/80' : 'text-white/60 italic'}`}>
                  {m.month}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-5 text-[10px] text-white/70 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
              Actual (client confirmed)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: `repeating-linear-gradient(45deg, ${gradientFrom}33, ${gradientFrom}33 3px, ${gradientFrom}11 3px, ${gradientFrom}11 6px)`, border: `1px dashed ${gradientFrom}66` }} />
              Projected · {fmtPct(avgGrowth)} MoM
            </div>
          </div>
        </div>
      </div>

      {/* ── AD SPEND BREAKDOWN (real) ── */}
      <div>
        <SectionLabel>Ad Spend · {fmtUSD(totalAdSpend)}/mo blended</SectionLabel>
        <div className="glass-card p-6">
          <div className="space-y-3">
            {adSpend.map((row) => {
              const pct = (row.monthly / totalAdSpend) * 100;
              return (
                <div key={row.agency}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-[13px] font-bold text-white">{row.agency}</span>
                      <span className="text-[11px] text-white/70 ml-2">· {row.channel}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-white">{fmtUSD(row.monthly)}/mo</div>
                      <div className="text-[10px] text-white/70">{row.note}</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            💡 All Niceville ad spend is currently on <strong>Meta</strong>. No Google Ads running today. When the Revive / HighLevel lead source API lands, this panel will split Meta spend between MNA and PDM automatically by UTM + ad account ID.
          </div>
        </div>
      </div>

      {/* ── LEAD SOURCE SPLIT (manual, editable by staff) ── */}
      <div>
        <SectionLabel>Lead Sources</SectionLabel>
        <LeadSourceSplitEditor
          clientId={client.id}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
      </div>

      {/* ── INTELLIGENCE (Niceville specific, real signals) ── */}
      <div>
        <SectionLabel>AI Intelligence · Niceville</SectionLabel>
        <div className="glass-card p-6 space-y-4">
          <InsightRow
            color="#10b981"
            title="Conversion rate is 18% above target"
            body={`GHL shows 16.59% vs 14% target. Of 464 opportunities in the last 30 days, 77 converted. The playbook that is working: After Hours event + Spring Reset Bundle. Keep doubling down on those rituals.`}
          />
          <InsightRow
            color="#f59e0b"
            title="Revenue pacing is healthy but ad spend is low"
            body={`${lastRev.month.split(' ')[0]} closed at ${fmtUSD(lastRev.value)} on just ${fmtUSD(totalAdSpend)}/mo in total ad spend across MNA and PDM. That is a strong implied return, but it also means we are leaving pipeline on the table. Recommend raising MNA daily from $20 to $35-50/day once the Niceville ad account is fully added to our system user.`}
          />
          <InsightRow
            color="#0ea5e9"
            title="Google Ads is a zero today"
            body={`All paid spend is on Meta. For a wellness clinic in a military town like Niceville, high-intent search ("iv therapy niceville fl", "nad+ niceville") typically converts 2-3× better than social. Recommend scoping a $300-500/mo Google Ads pilot targeting 5 mile radius around the spa.`}
          />
          <InsightRow
            color="#8b5cf6"
            title="Lead source attribution is blocking CPL"
            body={`We cannot compute a real Cost Per Lead because GHL does not break down paid vs walk-in vs referral. The fastest unlock is pulling lead_source from the Revive or HighLevel API and tagging each contact. Once that is live, every KPI on this page gets more precise.`}
          />
        </div>
      </div>
    </div>
  );
}

function StatsEditor({
  ghl, setGhl, revenue, setRevenue, adSpend, setAdSpend, onSave, gradientFrom, gradientTo,
}: {
  ghl: typeof GHL_DEFAULT; setGhl: (v: typeof GHL_DEFAULT) => void;
  revenue: RevRow[]; setRevenue: (v: RevRow[]) => void;
  adSpend: AdRow[]; setAdSpend: (v: AdRow[]) => void;
  onSave: () => void; gradientFrom: string; gradientTo: string;
}) {
  const inp = 'text-[13px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none w-full';
  const num = (v: string) => Number(v.replace(/[^0-9.-]/g, '')) || 0;
  const GHL_FIELDS: { k: keyof typeof GHL_DEFAULT; label: string }[] = [
    { k: 'totalOpportunities', label: 'Total Leads' },
    { k: 'openOpportunities', label: 'Open' },
    { k: 'wonOpportunities', label: 'Won / Booked' },
    { k: 'lostOpportunities', label: 'Lost' },
    { k: 'conversionRate', label: 'Conversion %' },
    { k: 'conversionTarget', label: 'Conversion target %' },
    { k: 'pipelineValue', label: 'Pipeline value ($)' },
    { k: 'wonRevenue', label: 'Won revenue ($)' },
  ];
  return (
    <div className="glass-card p-5 space-y-5" style={{ borderLeft: `3px solid ${gradientFrom}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Edit Overview stats</div>

      {/* Key metrics */}
      <div>
        <div className="text-[10px] font-bold uppercase text-white/45 mb-2">Key metrics (GHL)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GHL_FIELDS.map((f) => (
            <label key={f.k} className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50">{f.label}</span>
              <input className={inp} value={String(ghl[f.k])} onChange={(e) => setGhl({ ...ghl, [f.k]: num(e.target.value) })} />
            </label>
          ))}
        </div>
      </div>

      {/* Revenue history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase text-white/45">Monthly revenue (actuals)</div>
          <button className="text-[11px] text-cyan-300/80 hover:text-cyan-200" onClick={() => setRevenue([...revenue, { month: 'New 2026', value: 0, real: true }])}>+ Add month</button>
        </div>
        <div className="flex flex-col gap-2">
          {revenue.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input className={inp + ' flex-1'} value={r.month} onChange={(e) => setRevenue(revenue.map((x, j) => j === i ? { ...x, month: e.target.value } : x))} placeholder="Month (e.g. Apr 2026)" />
              <input className={inp + ' w-40'} value={String(r.value)} onChange={(e) => setRevenue(revenue.map((x, j) => j === i ? { ...x, value: num(e.target.value) } : x))} placeholder="Revenue $" />
              <button className="text-white/30 hover:text-rose-300 px-1" onClick={() => setRevenue(revenue.filter((_, j) => j !== i))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>
            </div>
          ))}
        </div>
      </div>

      {/* Ad spend */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase text-white/45">Ad spend breakdown</div>
          <button className="text-[11px] text-cyan-300/80 hover:text-cyan-200" onClick={() => setAdSpend([...adSpend, { agency: 'New', channel: 'Meta', monthly: 0, note: '' }])}>+ Add row</button>
        </div>
        <div className="flex flex-col gap-2">
          {adSpend.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input className={inp + ' flex-1'} value={r.agency} onChange={(e) => setAdSpend(adSpend.map((x, j) => j === i ? { ...x, agency: e.target.value } : x))} placeholder="Agency" />
              <input className={inp + ' w-24'} value={r.channel} onChange={(e) => setAdSpend(adSpend.map((x, j) => j === i ? { ...x, channel: e.target.value } : x))} placeholder="Channel" />
              <input className={inp + ' w-28'} value={String(r.monthly)} onChange={(e) => setAdSpend(adSpend.map((x, j) => j === i ? { ...x, monthly: num(e.target.value) } : x))} placeholder="$/mo" />
              <input className={inp + ' flex-1'} value={r.note} onChange={(e) => setAdSpend(adSpend.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="Note" />
              <button className="text-white/30 hover:text-rose-300 px-1" onClick={() => setAdSpend(adSpend.filter((_, j) => j !== i))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onSave} className="text-[13px] font-bold px-5 py-2 rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>Save stats</button>
    </div>
  );
}

function InsightRow({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-1 rounded-full shrink-0" style={{ background: color }} />
      <div>
        <div className="text-[13px] font-bold text-white">{title}</div>
        <div className="text-[12px] text-white/80 leading-relaxed mt-1">{body}</div>
      </div>
    </div>
  );
}

// Quick-seed for PDM's April 2026 content calendar.
// One click populates the content calendar with PDM's actual cascading
// and local posts so MNA can see what PDM is pushing and plan around it.
function CorporateSeedButton({ clientName, gradientFrom, gradientTo }: { clientName: string; gradientFrom: string; gradientTo: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');
  async function seed() {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          playbookId: 'prime-iv-pdm-apr-2026',
          startDate: '2026-04-01',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setMsg(`Loaded ${data.count} PDM posts into April. Reload the calendar.`);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[10px] text-white/70">{msg}</span>}
      <button
        onClick={seed}
        disabled={loading}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        {loading ? 'Loading…' : 'Add PDM Reference Posts'}
      </button>
    </div>
  );
}
