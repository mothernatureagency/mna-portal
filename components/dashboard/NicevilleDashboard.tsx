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
import SectionBoundary from '@/components/ui/SectionBoundary';
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

type GhlStats = {
  totalOpportunities: number | null; openOpportunities: number | null; wonOpportunities: number | null;
  lostOpportunities: number | null; conversionRate: number | null; conversionTarget: number | null;
  pipelineValue: number | null; wonRevenue: number | null;
};

// Niceville's REAL GHL snapshot (manual pull 2026-04-08). Only used for the
// Niceville client; every other location starts blank until real data is entered.
const GHL_NICEVILLE: GhlStats = {
  totalOpportunities: 464, openOpportunities: 346, wonOpportunities: 77, lostOpportunities: 41,
  conversionRate: 16.59, conversionTarget: 14, pipelineValue: 160_620, wonRevenue: 72_990,
};
const GHL_BLANK: GhlStats = {
  totalOpportunities: null, openOpportunities: null, wonOpportunities: null, lostOpportunities: null,
  conversionRate: null, conversionTarget: null, pipelineValue: null, wonRevenue: null,
};

type RevRow = { month: string; value: number; real?: boolean };
type AdRow = { agency: string; channel: string; monthly: number; note: string };
type OverviewStats = { ghl: GhlStats; revenue: RevRow[]; adSpend: AdRow[]; revenueGoal?: number | null };

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
// Null-safe display: show a dash when a stat hasn't been entered (never fake it).
const DASH = '—';
const nInt = (v: number | null) => (v == null ? DASH : new Intl.NumberFormat('en-US').format(v));
const nUsd = (v: number | null) => (v == null ? DASH : fmtUSD(v));
const nPct = (v: number | null) => (v == null ? DASH : `${v}%`);

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

export default function NicevilleDashboard({ client }: { client: Client }) {
  // Destructuring a missing `branding` throws before any boundary inside this
  // component can catch it, so fall back to the Prime IV palette.
  const { gradientFrom, gradientTo } = client.branding || { gradientFrom: '#1c3d6e', gradientTo: '#3a7ab5' };

  // Editable overview stats (persist per client to client_kv 'overview_stats').
  // Start BLANK — never show fabricated numbers. Real data comes from either the
  // client's saved stats or, for Niceville only, its confirmed defaults.
  const [ghl, setGhl] = useState<GhlStats>(GHL_BLANK);
  const [revenue, setRevenue] = useState<RevRow[]>([]);
  const [adSpend, setAdSpend] = useState<AdRow[]>([]);
  const [hasStats, setHasStats] = useState(false);
  const [revenueGoal, setRevenueGoal] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancel = false;
    function seedNiceville() {
      if (client.id === 'prime-iv') { setGhl(GHL_NICEVILLE); setRevenue(REVENUE_HISTORY_DEFAULT); setAdSpend(AD_SPEND_DEFAULT); setHasStats(true); }
      else { setGhl(GHL_BLANK); setRevenue([]); setAdSpend([]); setHasStats(false); }
    }
    fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=overview_stats`)
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        const v = d?.value as Partial<OverviewStats> | null;
        const real = v && typeof v === 'object' && (v.ghl || (v.revenue && v.revenue.length) || (v.adSpend && v.adSpend.length));
        if (real) {
          setGhl({ ...GHL_BLANK, ...(v!.ghl || {}) });
          setRevenue(Array.isArray(v!.revenue) ? v!.revenue : []);
          setAdSpend(Array.isArray(v!.adSpend) ? v!.adSpend : []);
          setHasStats(true);
        } else { seedNiceville(); }
        if (v && typeof v.revenueGoal === 'number') setRevenueGoal(v.revenueGoal);
      })
      .catch(() => { if (!cancel) seedNiceville(); });
    return () => { cancel = true; };
  }, [client.id]);

  async function saveStats() {
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, key: 'overview_stats', value: { ghl, revenue, adSpend, revenueGoal } }),
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
            Live metrics · click <span className="text-white/80 font-semibold">Edit stats</span> to update any box as it changes
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
          revenueGoal={revenueGoal} setRevenueGoal={setRevenueGoal}
          onSave={saveStats}
          gradientFrom={gradientFrom} gradientTo={gradientTo}
        />
      )}

      {/* Meta Ads Account — editable */}
      <SectionBoundary name="Meta Ads account"><MetaAdsCard client={client} accent={gradientFrom} /></SectionBoundary>

      {/* ── KPIs ── */}
      <div>
        <SectionLabel>Performance KPIs</SectionLabel>
        <SectionBoundary name="Performance KPIs">
          <KPISection
            clientId={client.id}
            title={`${client.shortName} · Performance KPIs`}
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
            adAccountId={client.metaAds?.adAccountId}
            editable
          />
        </SectionBoundary>
      </div>

      {/* ── CONTENT CALENDAR (moved to top per client request) ── */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <SectionLabel>Content Calendar</SectionLabel>
          <CorporateSeedButton clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        </div>
        <SectionBoundary name="Content calendar"><MonthlyContentCalendar clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} /></SectionBoundary>
        <div className="mt-3">
          <SectionBoundary name="Concepts"><ConceptsPanel clientId={client.id} gradientFrom={gradientFrom} gradientTo={gradientTo} /></SectionBoundary>
        </div>
      </div>

      {/* ── MEMBERSHIP TIERS (pamphlet reference) ── */}
      <div>
        <SectionLabel>Prime IV Memberships · Pamphlet Reference</SectionLabel>
        <SectionBoundary name="Membership tiers"><PrimeIVMembershipCard gradientFrom={gradientFrom} gradientTo={gradientTo} pricingTier="tier2" /></SectionBoundary>
      </div>

      {/* ── COMPETITOR BENCHMARK (Meta + Google Reviews) ── */}
      <div>
        <SectionLabel>Competitive Position</SectionLabel>
        <SectionBoundary name="Competitive position"><CompetitorBenchmark gradientFrom={gradientFrom} gradientTo={gradientTo} clientId={client.id} clientName={client.shortName} editable /></SectionBoundary>
      </div>

      {/* ── TIKTOK ANALYTICS ── */}
      <div>
        <SectionLabel>TikTok · {client.shortName}</SectionLabel>
        <SectionBoundary name="TikTok analytics">
          <TikTokAnalytics
            ownerKey={client.id}
            kvClientId={client.id}
            label={client.name}
            niche={`IV therapy / wellness / ${client.shortName}`}
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />
        </SectionBoundary>
        <div className="mt-3">
          <SectionBoundary name="TikTok content plan">
            <TikTokContentPlan
              ownerKey={client.id}
              kvClientId={client.id}
              label={client.name}
              niche={`IV therapy / wellness / ${client.shortName}`}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
          </SectionBoundary>
        </div>
      </div>

      {/* ── YOUTUBE ANALYTICS ── */}
      <div>
        <SectionLabel>YouTube · {client.shortName}</SectionLabel>
        <SectionBoundary name="YouTube analytics">
          <YouTubeAnalytics
            ownerKey={client.id}
            kvClientId={client.id}
            label={client.name}
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />
        </SectionBoundary>
      </div>

      {/* ── SALES BENCHMARKS (manual entry: Niceville vs Destin vs Corporate) ── */}
      <div>
        <SectionLabel>Sales Benchmarks</SectionLabel>
        <SectionBoundary name="Sales benchmarks"><SalesBenchmarks clientId={client.id} gradientFrom={gradientFrom} gradientTo={gradientTo} /></SectionBoundary>
      </div>

      {/* ── KEY METRICS (honest — only values we actually have) ── */}
      <div>
        <SectionLabel>Key Metrics · Last 30 days (GHL)</SectionLabel>
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#0ea5e9' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Total Leads</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{nInt(ghl.totalOpportunities)}</div>
            <div className="text-[11px] text-white/70">Open {nInt(ghl.openOpportunities)} · Won {nInt(ghl.wonOpportunities)} · Lost {nInt(ghl.lostOpportunities)}</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#8b5cf6' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Conversion Rate</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{nPct(ghl.conversionRate)}</div>
            <div className="text-[11px] font-bold" style={{ color: '#7c3aed' }}>{ghl.conversionTarget == null ? 'No target set' : ghl.conversionRate == null ? `Target ${ghl.conversionTarget}%` : `Target ${ghl.conversionTarget}% · ${ghl.conversionRate >= ghl.conversionTarget ? 'Exceeded ✦' : 'Below'}`}</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#ec4899' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Booked Appts</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{nInt(ghl.wonOpportunities)}</div>
            <div className="text-[11px] text-white/70">Won opportunities</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#06b6d4' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">{revenue.length ? lastRev.month.split(' ')[0] : 'Latest'} Revenue</span>
            <div className="text-[30px] font-black text-white leading-none my-2">{revenue.length ? fmtUSD(lastRev.value) : DASH}</div>
            <div className="text-[11px] font-bold" style={{ color: '#059669' }}>{revenue.length && prevRev.value ? `${(lastRev.value / prevRev.value - 1) >= 0 ? '+' : ''}${Math.round((lastRev.value / prevRev.value - 1) * 100)}% vs ${prevRev.month.split(' ')[0]}` : ''}</div>
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
            <div className="text-[28px] font-black text-white/70 leading-none my-2">{nUsd(ghl.pipelineValue)}</div>
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <div className="text-[15px] font-bold text-white">Monthly revenue</div>
              <div className="text-[11px] text-white/70">
                {revenue.length >= 2 ? `Actuals + projection at ${fmtPct(avgGrowth)} MoM` : 'Add monthly revenue in Edit stats'}
              </div>
            </div>
            <div className="flex items-center gap-6">
              {revenueGoal != null && revenueGoal > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Monthly goal</div>
                  <div className="text-[22px] font-black" style={{ color: gradientFrom }}>{fmtUSD(revenueGoal)}</div>
                  {revenue.length > 0 && <div className="text-[10px] text-white/70">{Math.round((lastRev.value / revenueGoal) * 100)}% of goal · {lastRev.month.split(' ')[0]}</div>}
                </div>
              )}
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Projected next-quarter total</div>
                <div className="text-[22px] font-black text-white">{revenue.length >= 2 ? fmtUSD(q2Total) : DASH}</div>
              </div>
            </div>
          </div>
          {revenueGoal != null && revenueGoal > 0 && revenue.length > 0 && (
            <div className="h-2 rounded-full overflow-hidden bg-white/10 mb-4">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((lastRev.value / revenueGoal) * 100))}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
            </div>
          )}
          {revenue.length === 0 ? (
            <div className="h-40 mb-4 grid place-items-center text-[12px] text-white/40 border border-dashed border-white/10 rounded-xl">
              No revenue entered yet — click <span className="text-white/70 font-semibold mx-1">Edit stats</span> to add monthly figures.
            </div>
          ) : (
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
          )}
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
        <SectionLabel>Ad Spend{adSpend.length ? ` · ${fmtUSD(totalAdSpend)}/mo blended` : ''}</SectionLabel>
        <div className="glass-card p-6">
          {adSpend.length === 0 && (
            <div className="text-[12px] text-white/40">No ad spend entered yet — click <span className="text-white/70 font-semibold">Edit stats</span> to add agencies/budgets.</div>
          )}
          <div className="space-y-3">
            {adSpend.map((row) => {
              const pct = totalAdSpend > 0 ? (row.monthly / totalAdSpend) * 100 : 0;
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
            💡 Edit any row above with the pencil/Edit stats to keep the split current. When the Revive / HighLevel lead-source API lands, this panel can split spend automatically by UTM + ad account ID.
          </div>
        </div>
      </div>

      {/* ── LEAD SOURCE SPLIT (manual, editable by staff) ── */}
      <div>
        <SectionLabel>Lead Sources</SectionLabel>
        <SectionBoundary name="Lead sources">
          <LeadSourceSplitEditor
            clientId={client.id}
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />
        </SectionBoundary>
      </div>

      {/* ── INTELLIGENCE (derived from the editable stats above) ── */}
      <div>
        <SectionLabel>AI Intelligence · {client.shortName}</SectionLabel>
        <div className="glass-card p-6 space-y-4">
          {!hasStats ? (
            <div className="text-[12px] text-white/45">Add this location&apos;s metrics with <span className="text-white/70 font-semibold">Edit stats</span> to unlock intelligence here.</div>
          ) : (
            <>
              {ghl.conversionRate != null && ghl.conversionTarget != null && (
                <InsightRow
                  color={ghl.conversionRate >= ghl.conversionTarget ? '#10b981' : '#f59e0b'}
                  title={ghl.conversionRate >= ghl.conversionTarget
                    ? `Conversion is beating target — ${ghl.conversionRate}% vs ${ghl.conversionTarget}%`
                    : `Conversion is below target — ${ghl.conversionRate}% vs ${ghl.conversionTarget}%`}
                  body={`Of ${nInt(ghl.totalOpportunities)} leads in the last 30 days, ${nInt(ghl.wonOpportunities)} converted (${nInt(ghl.openOpportunities)} still open, ${nInt(ghl.lostOpportunities)} lost). ${ghl.conversionRate >= ghl.conversionTarget ? 'Keep doubling down on what is working.' : 'Tighten follow-up speed and offer clarity to close the gap.'}`}
                />
              )}
              {revenue.length > 0 && (
                <InsightRow
                  color="#0ea5e9"
                  title="Revenue vs ad spend"
                  body={`${lastRev.month.split(' ')[0]} revenue was ${fmtUSD(lastRev.value)} on ${fmtUSD(totalAdSpend)}/mo in ad spend${prevRev.value ? `, ${lastRev.value >= prevRev.value ? 'up' : 'down'} ${Math.abs(Math.round((lastRev.value / prevRev.value - 1) * 100))}% vs ${prevRev.month.split(' ')[0]}` : ''}. Update any figure with “Edit stats” as the month changes.`}
                />
              )}
              {(ghl.pipelineValue != null || ghl.wonRevenue != null) && (
                <InsightRow
                  color="#8b5cf6"
                  title="Pipeline snapshot"
                  body={`${nUsd(ghl.pipelineValue)} in open pipeline · ${nUsd(ghl.wonRevenue)} won (GHL). Pull lead_source from Revive / HighLevel to compute a true cost-per-lead.`}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsEditor({
  ghl, setGhl, revenue, setRevenue, adSpend, setAdSpend, revenueGoal, setRevenueGoal, onSave, gradientFrom, gradientTo,
}: {
  ghl: GhlStats; setGhl: (v: GhlStats) => void;
  revenue: RevRow[]; setRevenue: (v: RevRow[]) => void;
  adSpend: AdRow[]; setAdSpend: (v: AdRow[]) => void;
  revenueGoal: number | null; setRevenueGoal: (v: number | null) => void;
  onSave: () => void; gradientFrom: string; gradientTo: string;
}) {
  const inp = 'text-[13px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none w-full';
  const num = (v: string): number | null => { const s = v.replace(/[^0-9.-]/g, ''); return s === '' ? null : (Number(s) || 0); };
  const GHL_FIELDS: { k: keyof GhlStats; label: string }[] = [
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

      {/* Monthly revenue goal */}
      <label className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-white/45">Monthly revenue goal ($)</span>
        <input className={inp + ' w-40'} value={revenueGoal == null ? '' : String(revenueGoal)} placeholder="e.g. 150000"
          onChange={(e) => { const s = e.target.value.replace(/[^0-9.]/g, ''); setRevenueGoal(s === '' ? null : (Number(s) || 0)); }} />
        <span className="text-[10px] text-white/40">shows a progress bar + % to goal on the revenue chart</span>
      </label>

      {/* Key metrics */}
      <div>
        <div className="text-[10px] font-bold uppercase text-white/45 mb-2">Key metrics (GHL)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GHL_FIELDS.map((f) => (
            <label key={f.k} className="flex flex-col gap-1">
              <span className="text-[10px] text-white/50">{f.label}</span>
              <input className={inp} value={ghl[f.k] == null ? '' : String(ghl[f.k])} placeholder="—" onChange={(e) => setGhl({ ...ghl, [f.k]: num(e.target.value) })} />
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
              <input className={inp + ' w-40'} value={String(r.value)} onChange={(e) => setRevenue(revenue.map((x, j) => j === i ? { ...x, value: num(e.target.value) ?? 0 } : x))} placeholder="Revenue $" />
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
              <input className={inp + ' w-28'} value={String(r.monthly)} onChange={(e) => setAdSpend(adSpend.map((x, j) => j === i ? { ...x, monthly: num(e.target.value) ?? 0 } : x))} placeholder="$/mo" />
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
