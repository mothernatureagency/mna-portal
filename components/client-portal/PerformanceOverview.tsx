'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip, Cell,
} from 'recharts';
import type { PerformanceData, PeriodMetrics } from '@/lib/data/performance';
import { pctChange } from '@/lib/data/performance';

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCompact(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return fmtUSD(n);
}

// ── Change badge ──────────────────────────────────────────────
function ChangeBadge({ value, suffix = '%', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const isPositive = invert ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.5;
  const color = isNeutral
    ? 'text-white/50 bg-white/10'
    : isPositive
    ? 'text-emerald-400 bg-emerald-500/15'
    : 'text-rose-400 bg-rose-500/15';
  const arrow = value > 0 ? 'arrow_upward' : value < 0 ? 'arrow_downward' : 'remove';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{arrow}</span>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ── Glass tooltip ─────────────────────────────────────────────
function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px] shadow-xl"
      style={{
        background: 'rgba(15,31,46,0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="font-bold text-white mb-0.5">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-white/70">
          {p.name}: <span className="text-white font-semibold">
            {p.name === 'Revenue' ? fmtCompact(p.value) : p.value}{p.name === 'Conversion' ? '%' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Insight generator ─────────────────────────────────────────
type Insight = {
  icon: string;
  title: string;
  body: string;
  tone: 'warning' | 'info' | 'success';
};

function generatePerformanceInsights(baseline: PeriodMetrics, current: PeriodMetrics): Insight[] {
  const insights: Insight[] = [];

  const convDelta = pctChange(current.conversionRate, baseline.conversionRate);
  if (convDelta < -20) {
    insights.push({
      icon: 'trending_down',
      title: `Conversion rate dropped ${Math.abs(convDelta).toFixed(0)}%`,
      body: `${current.shortLabel} conversion is ${current.conversionRate}% vs ${baseline.shortLabel}'s ${baseline.conversionRate}%. This could indicate colder traffic, lower lead quality, or follow-up / front desk conversion issues.`,
      tone: 'warning',
    });
  }

  const rplDelta = pctChange(current.revenuePerLead, baseline.revenuePerLead);
  if (rplDelta < -15) {
    insights.push({
      icon: 'attach_money',
      title: `Revenue per lead is down ${Math.abs(rplDelta).toFixed(0)}%`,
      body: `${current.shortLabel} yields ${fmtUSD(current.revenuePerLead)} per lead vs ${fmtUSD(baseline.revenuePerLead)} in ${baseline.shortLabel}. Lower-value conversions or smaller initial purchases may be contributing.`,
      tone: 'warning',
    });
  }

  const leadDelta = pctChange(current.totalLeads, baseline.totalLeads / 3); // normalize Q1 to monthly
  if (leadDelta < -30) {
    insights.push({
      icon: 'person_off',
      title: 'Lead volume decreased significantly',
      body: `${current.totalLeads} leads in ${current.shortLabel} vs ~${Math.round(baseline.totalLeads / 3)}/mo avg in ${baseline.shortLabel}. Seasonal factors, ad spend changes, or platform algorithm shifts could be at play.`,
      tone: 'warning',
    });
  }

  if (insights.length > 0) {
    insights.push({
      icon: 'lightbulb',
      title: 'Recommended actions',
      body: 'Review ad creative for fatigue, audit lead source quality, check front desk follow-up workflows, and compare appointment booking rates. Consider running a re-engagement campaign for lost leads.',
      tone: 'info',
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: 'check_circle',
      title: 'Performance is tracking well',
      body: `${current.shortLabel} metrics are in line with ${baseline.shortLabel}. Keep monitoring as more data comes in.`,
      tone: 'success',
    });
  }

  return insights;
}

const TONE_STYLES = {
  info:    { bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.25)',  icon: '#38bdf8' },
  warning: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  icon: '#fbbf24' },
  success: { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  icon: '#34d399' },
};

const PERIOD_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899'];

// ── KPI card for a single period ──────────────────────────────
function PeriodCard({
  period,
  baseline,
  accentColor,
}: {
  period: PeriodMetrics;
  baseline?: PeriodMetrics;
  accentColor: string;
}) {
  const metrics = [
    { label: 'Total Leads',     value: period.totalLeads.toLocaleString(),       raw: period.totalLeads,     baseRaw: baseline?.totalLeads },
    { label: 'Revenue Closed',  value: fmtUSD(period.revenueClosed),             raw: period.revenueClosed,  baseRaw: baseline?.revenueClosed },
    { label: 'Won Deals',       value: period.wonDeals.toLocaleString(),          raw: period.wonDeals,       baseRaw: baseline?.wonDeals },
    { label: 'Conversion Rate', value: `${period.conversionRate}%`,              raw: period.conversionRate, baseRaw: baseline?.conversionRate },
    { label: 'Revenue / Lead',  value: fmtUSD(period.revenuePerLead),            raw: period.revenuePerLead, baseRaw: baseline?.revenuePerLead },
  ];

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[22px]" style={{ background: accentColor }} />
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[14px] font-bold text-white">{period.label}</div>
        {baseline && period.conversionRate < baseline.conversionRate * 0.7 && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
            Performance Drop
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const delta = baseline && m.baseRaw !== undefined
            ? pctChange(m.raw, m.baseRaw)
            : null;
          return (
            <div key={m.label}>
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">{m.label}</div>
              <div className="text-[20px] font-black text-white leading-none mt-1">{m.value}</div>
              {delta !== null && (
                <div className="mt-1">
                  <ChangeBadge value={delta} suffix="%" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function PerformanceOverview({
  data,
  gradientFrom,
  gradientTo,
}: {
  data: PerformanceData;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [activeTab, setActiveTab] = useState<'compare' | string>('compare');
  const periods = data.periods;
  const baseline = periods[0];
  const current = periods.length > 1 ? periods[periods.length - 1] : null;

  const insights = useMemo(
    () => current ? generatePerformanceInsights(baseline, current) : [],
    [baseline, current],
  );

  // Comparison bar chart data
  const comparisonMetrics = useMemo(() => {
    const metricDefs = [
      { key: 'Leads',      getter: (p: PeriodMetrics) => p.totalLeads },
      { key: 'Revenue',    getter: (p: PeriodMetrics) => p.revenueClosed },
      { key: 'Won Deals',  getter: (p: PeriodMetrics) => p.wonDeals },
      { key: 'Conversion', getter: (p: PeriodMetrics) => p.conversionRate },
    ];
    return metricDefs.map((def) => {
      const row: Record<string, any> = { name: def.key };
      periods.forEach((p, i) => {
        row[p.shortLabel] = def.getter(p);
      });
      return row;
    });
  }, [periods]);

  const tabs = [
    { id: 'compare', label: 'Compare' },
    ...periods.map((p) => ({ id: p.shortLabel, label: p.shortLabel })),
  ];

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h2 className="text-[18px] font-extrabold text-white tracking-tight">Performance Overview</h2>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                activeTab === t.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compare view */}
      {activeTab === 'compare' && (
        <>
          {/* Side-by-side period cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeriodCard period={baseline} accentColor={PERIOD_COLORS[0]} />
            {current && (
              <PeriodCard period={current} baseline={baseline} accentColor={PERIOD_COLORS[1]} />
            )}
          </div>

          {/* Comparison charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Leads & Won Deals */}
            <div className="glass-card p-6">
              <div className="text-[14px] font-bold text-white mb-4">Leads & Won Deals</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Leads', [baseline.shortLabel]: baseline.totalLeads, [current?.shortLabel || '']: current?.totalLeads || 0 },
                    { name: 'Won', [baseline.shortLabel]: baseline.wonDeals, [current?.shortLabel || '']: current?.wonDeals || 0 },
                  ]}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <ReTooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={baseline.shortLabel} fill={PERIOD_COLORS[0]} radius={[6, 6, 0, 0]} />
                  {current && <Bar dataKey={current.shortLabel} fill={PERIOD_COLORS[1]} radius={[6, 6, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue & Rates */}
            <div className="glass-card p-6">
              <div className="text-[14px] font-bold text-white mb-4">Conversion & Revenue / Lead</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Conv %', [baseline.shortLabel]: baseline.conversionRate, [current?.shortLabel || '']: current?.conversionRate || 0 },
                    { name: 'Rev/Lead', [baseline.shortLabel]: baseline.revenuePerLead, [current?.shortLabel || '']: current?.revenuePerLead || 0 },
                  ]}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <ReTooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={baseline.shortLabel} fill={PERIOD_COLORS[0]} radius={[6, 6, 0, 0]} />
                  {current && <Bar dataKey={current.shortLabel} fill={PERIOD_COLORS[1]} radius={[6, 6, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-white/70" style={{ fontSize: 18 }}>insights</span>
                <div className="text-[14px] font-bold text-white">Performance Insights</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((ins, i) => {
                  const tone = TONE_STYLES[ins.tone];
                  return (
                    <div
                      key={i}
                      className="rounded-xl p-4"
                      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: tone.icon }}>
                          {ins.icon}
                        </span>
                        <div className="text-[12px] font-bold text-white">{ins.title}</div>
                      </div>
                      <div className="text-[11px] text-white/60 leading-relaxed">{ins.body}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-white/30 mt-4 italic">
                April data is calculated from Year-to-Date minus Q1 totals.
              </div>
            </div>
          )}
        </>
      )}

      {/* Single period view */}
      {activeTab !== 'compare' && (() => {
        const period = periods.find((p) => p.shortLabel === activeTab);
        if (!period) return null;
        const prev = periods.indexOf(period) > 0 ? periods[periods.indexOf(period) - 1] : undefined;
        const colorIdx = periods.indexOf(period);
        return (
          <PeriodCard
            period={period}
            baseline={prev}
            accentColor={PERIOD_COLORS[colorIdx % PERIOD_COLORS.length]}
          />
        );
      })()}
    </div>
  );
}
