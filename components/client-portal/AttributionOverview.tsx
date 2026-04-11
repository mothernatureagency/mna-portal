'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { AttributionData } from '@/lib/data/attribution';
import { deriveMetrics } from '@/lib/data/attribution';

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Custom tooltip for recharts (dark glass) ───────────────────
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
      <div className="font-bold text-white mb-0.5">{label || payload[0]?.name}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-white/70">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
          <span>{p.name}: <span className="text-white font-semibold">{p.value}{typeof p.value === 'number' && p.name === 'Percentage' ? '%' : ''}</span></span>
        </div>
      ))}
    </div>
  );
}

// ── Pie label renderer ─────────────────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.04) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="rgba(255,255,255,0.7)"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {name} {(percent * 100).toFixed(1)}%
    </text>
  );
}

// ── Insight type ───────────────────────────────────────────────
type Insight = {
  icon: string;
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'success';
};

function generateInsights(data: AttributionData, sourcesWithPct: { source: string; count: number; percentage: number }[]): Insight[] {
  const insights: Insight[] = [];
  const sorted = [...sourcesWithPct].sort((a, b) => b.percentage - a.percentage);
  const top = sorted[0];

  if (top) {
    insights.push({
      icon: 'trending_up',
      title: `${top.source} is the dominant lead source`,
      body: `${top.percentage}% of all leads come from ${top.source}. This channel is clearly driving volume — protect the budget and keep optimizing creative.`,
      tone: 'success',
    });
  }

  const other = sourcesWithPct.find((s) => s.source === 'Other');
  if (other && other.percentage > 10) {
    insights.push({
      icon: 'warning',
      title: `"Other" is ${other.percentage}% — too large`,
      body: `${other.percentage}% of leads are categorized as "Other," which means attribution is unclear or untracked. Cleaning up UTM tags and CRM source fields will improve reporting accuracy.`,
      tone: 'warning',
    });
  }

  const manual = sourcesWithPct.find((s) => s.source === 'Manual');
  if (manual && manual.percentage > 3) {
    insights.push({
      icon: 'edit_note',
      title: `"Manual" may need relabeling`,
      body: `${manual.count} leads (${manual.percentage}%) are tagged as "Manual." These are likely walk-ins or front desk entries — consider relabeling for clearer attribution.`,
      tone: 'info',
    });
  }

  const minors = sourcesWithPct.filter(
    (s) => s.percentage < 5 && s.source !== 'Other' && s.source !== 'Manual'
  );
  if (minors.length > 0) {
    const names = minors.map((m) => m.source).join(', ');
    insights.push({
      icon: 'info',
      title: 'Minor channels',
      body: `${names} are currently contributing under 5% each. These are worth monitoring but don't require heavy investment yet.`,
      tone: 'info',
    });
  }

  return insights;
}

const TONE_STYLES = {
  info:    { bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.25)',  icon: '#38bdf8' },
  warning: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  icon: '#fbbf24' },
  success: { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  icon: '#34d399' },
};

// ── Main component ─────────────────────────────────────────────
export default function AttributionOverview({
  data,
  gradientFrom,
  gradientTo,
}: {
  data: AttributionData;
  gradientFrom: string;
  gradientTo: string;
}) {
  const { conversionRate, revenuePerLead, sourcesWithPct } = useMemo(
    () => deriveMetrics(data),
    [data],
  );
  const insights = useMemo(
    () => generateInsights(data, sourcesWithPct),
    [data, sourcesWithPct],
  );

  const kpis = [
    { label: 'Total Leads',     value: data.totalLeads.toLocaleString(),       color: '#3b82f6' },
    { label: 'Revenue Closed',  value: fmtUSD(data.revenueClosed),             color: '#10b981' },
    { label: 'Won Deals',       value: data.wonDeals.toLocaleString(),          color: '#8b5cf6' },
    { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`,         color: '#f59e0b' },
    { label: 'Revenue / Lead',  value: fmtUSD(revenuePerLead),                 color: '#ec4899' },
  ];

  const barData = sourcesWithPct
    .sort((a, b) => b.count - a.count)
    .map((s) => ({ name: s.source, Leads: s.count, color: s.color }));

  const pieData = sourcesWithPct.map((s) => ({
    name: s.source,
    value: s.count,
    color: s.color,
  }));

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
        <h2 className="text-[18px] font-extrabold text-white tracking-tight">Attribution Overview</h2>
        <span className="text-[11px] font-semibold text-white/40 ml-1">{data.period}</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[22px]" style={{ background: k.color }} />
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">{k.label}</div>
            <div className="text-[24px] font-black text-white leading-none mt-1.5">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="glass-card p-6">
          <div className="text-[14px] font-bold text-white mb-4">Lead Source Split</div>
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={45}
                  strokeWidth={0}
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip content={<GlassTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar chart */}
        <div className="glass-card p-6">
          <div className="text-[14px] font-bold text-white mb-4">Leads by Source</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <ReTooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="Leads" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source breakdown table */}
      <div className="glass-card p-6">
        <div className="text-[14px] font-bold text-white mb-4">Source Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-[10px] font-bold uppercase tracking-wider text-white/40 pb-3 pr-4">Source</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-white/40 pb-3 pr-4 text-right">Leads</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-white/40 pb-3 text-right">Percentage</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-white/40 pb-3 pl-6">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {sourcesWithPct
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                <tr key={s.source} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[13px] font-semibold text-white">{s.source}</span>
                      {s.source === 'Other' && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                          Needs cleanup
                        </span>
                      )}
                      {s.source === 'Manual' && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-400/20 text-blue-300">
                          Relabel
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-[13px] font-bold text-white">{s.count}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-[13px] font-semibold text-white/70">{s.percentage}%</span>
                  </td>
                  <td className="py-3 pl-6">
                    <div className="w-full max-w-[200px]">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.percentage}%`, background: s.color }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td className="pt-3 text-[12px] font-bold text-white/50 uppercase tracking-wider">Total</td>
                <td className="pt-3 text-right text-[13px] font-black text-white">{data.totalLeads}</td>
                <td className="pt-3 text-right text-[13px] font-semibold text-white/70">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-white/70" style={{ fontSize: 18 }}>insights</span>
          <div className="text-[14px] font-bold text-white">Insights</div>
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
      </div>
    </div>
  );
}
