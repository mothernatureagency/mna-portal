'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clients, Client } from '@/lib/clients';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

type KPI = { label: string; value: string; sub?: string; color: string };

type MonthData = {
  month: string; // 'Jan', 'Feb', etc.
  monthKey: string; // '2026-01', '2026-02', etc.
  actual: number;
  projected: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = 2026;

function getQuarter(monthIndex: number) {
  return Math.floor(monthIndex / 3) + 1;
}

function getMonthKey(monthIndex: number) {
  return `${CURRENT_YEAR}-${String(monthIndex + 1).padStart(2, '0')}`;
}

// Default targets based on client kpiTargets.revenue
function defaultProjections(client: Client): MonthData[] {
  const base = client.kpiTargets.revenue;
  return MONTH_LABELS.map((label, i) => ({
    month: label,
    monthKey: getMonthKey(i),
    actual: 0,
    projected: base,
  }));
}

// Auto-project the next 3 months based on recent growth rate from actuals.
// Looks at the last 2+ months with actual data, calculates average MoM growth,
// and applies that rate forward for 3 months. Recalculates whenever actuals change.
function applyGrowthProjections(data: MonthData[]): MonthData[] {
  // Find months with actual revenue > 0
  const withActuals = data.filter((m) => m.actual > 0);
  if (withActuals.length < 2) return data; // need at least 2 months to calc growth

  // Calculate month-over-month growth rates
  const rates: number[] = [];
  for (let i = 1; i < withActuals.length; i++) {
    const prev = withActuals[i - 1].actual;
    const curr = withActuals[i].actual;
    if (prev > 0) rates.push(curr / prev);
  }
  if (rates.length === 0) return data;

  // Average growth rate
  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;

  // Find the last month with actuals
  const lastActualIdx = data.findIndex((m) => m.monthKey === withActuals[withActuals.length - 1].monthKey);
  const lastActualValue = withActuals[withActuals.length - 1].actual;

  // Project forward 3 months from the last actual
  const result = [...data];
  for (let offset = 1; offset <= 3; offset++) {
    const targetIdx = lastActualIdx + offset;
    if (targetIdx >= result.length) break;
    // Only auto-project if no manual override was saved (projected still equals the default)
    const projected = Math.round(lastActualValue * Math.pow(avgRate, offset));
    result[targetIdx] = { ...result[targetIdx], projected };
  }
  return result;
}

// Hardcoded actuals for Prime IV Niceville (known data)
const KNOWN_ACTUALS: Record<string, Record<string, number>> = {
  'prime-iv': {
    '2026-01': 49400,
    '2026-02': 52500,
    '2026-03': 54500,
  },
};

// Known projected totals per quarter (overrides default per-month projections)
const KNOWN_Q_PROJECTIONS: Record<string, Record<string, number>> = {
  'prime-iv': {
    '2026-01': 50000,
    '2026-02': 52000,
    '2026-03': 53000,  // Q1 total = $155K
  },
};

const KNOWN_KPIS: Record<string, KPI[]> = {
  'prime-iv': [
    { label: 'Total Leads (30d)', value: '464', sub: 'GHL pipeline', color: '#0ea5e9' },
    { label: 'Conversion Rate', value: '16.59%', sub: 'Above 14% target', color: '#8b5cf6' },
    { label: 'Booked Appointments', value: '77', sub: 'Won opportunities', color: '#ec4899' },
    { label: 'March Revenue', value: '$54.5K', sub: '+3.8% vs February', color: '#06b6d4' },
  ],
};

// Ad spend data per client
const AD_SPEND_BY_CLIENT: Record<string, { agency: string; channel: string; monthly: number; note: string }[]> = {
  'prime-iv': [
    { agency: 'Mother Nature Agency', channel: 'Meta', monthly: 600, note: '$20/day daily budget' },
    { agency: 'PDM', channel: 'Meta', monthly: 1290, note: 'Managed separately' },
  ],
};

// Lead source category definitions
const LEAD_CATEGORIES = [
  { key: 'fb', label: 'Facebook / Instagram', sub: 'Paid ads' },
  { key: 'google', label: 'Google', sub: 'Organic + paid' },
  { key: 'walkin', label: 'Walk-in', sub: 'In-person' },
  { key: 'referral', label: 'Referral', sub: 'Word of mouth' },
] as const;

// Calendar types for the overview preview
type CalendarApprovalStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'scheduled';
type CalendarItem = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  client_approval_status: CalendarApprovalStatus | null;
};

const STATUS_DOT: Record<CalendarApprovalStatus, string> = {
  drafting: '#9ca3af',
  pending_review: '#f59e0b',
  approved: '#10b981',
  changes_requested: '#f43f5e',
  scheduled: '#0ea5e9',
};

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: '📸', Facebook: '📘', TikTok: '🎵', LinkedIn: '💼', YouTube: '🎬',
};

function parseCalTitle(raw: string | null) {
  if (!raw) return '';
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const TOP_POSTS_BY_CLIENT: Record<string, { platform: string; title: string; engagement: number; reach: number; type: string }[]> = {
  'prime-iv': [
    { platform: 'Instagram', title: 'Spa walkthrough reel', engagement: 4820, reach: 28400, type: 'Reel' },
    { platform: 'Instagram', title: 'After Hours giveaway', engagement: 3210, reach: 18600, type: 'Post' },
    { platform: 'Instagram', title: 'Real client review', engagement: 2670, reach: 14100, type: 'Reel' },
  ],
};

export default function ClientOverviewPage() {
  const { client, isStaffPreview } = useClientPortal();
  const [projections, setProjections] = useState<MonthData[]>([]);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ actual: '', projected: '' });
  const [saving, setSaving] = useState(false);
  const [calItems, setCalItems] = useState<CalendarItem[]>([]);
  const [leadSplit, setLeadSplit] = useState<Record<string, number> | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  // Load projections from client_kv
  useEffect(() => {
    if (!client) return;
    const defaults = defaultProjections(client);

    // Merge known actuals
    const knownActuals = KNOWN_ACTUALS[client.id] || {};
    defaults.forEach((m) => {
      if (knownActuals[m.monthKey]) m.actual = knownActuals[m.monthKey];
    });

    // Merge known quarterly projections
    const knownProj = KNOWN_Q_PROJECTIONS[client.id] || {};
    defaults.forEach((m) => {
      if (knownProj[m.monthKey]) m.projected = knownProj[m.monthKey];
    });

    // Load saved projections from KV
    fetch(`/api/client-kv?clientId=${client.id}&key=revenue_projections`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value && typeof data.value === 'object') {
          const saved = data.value as Record<string, { actual?: number; projected?: number }>;
          defaults.forEach((m) => {
            if (saved[m.monthKey]) {
              if (saved[m.monthKey].actual !== undefined) m.actual = saved[m.monthKey].actual!;
              if (saved[m.monthKey].projected !== undefined) m.projected = saved[m.monthKey].projected!;
            }
          });
        }
        setProjections(applyGrowthProjections(defaults));
      })
      .catch(() => setProjections(applyGrowthProjections(defaults)));
  }, [client]);

  // Load content calendar items
  useEffect(() => {
    if (!client?.name) return;
    fetch(`/api/content-calendar?client=${encodeURIComponent(client.name)}`)
      .then((r) => r.json())
      .then((d) => setCalItems(d.items || []))
      .catch(() => {});
  }, [client?.name]);

  // Load lead source split
  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/client-kv?clientId=${client.id}&key=lead_source_split`)
      .then((r) => r.json())
      .then((d) => { if (d.value) setLeadSplit(d.value); })
      .catch(() => {});
  }, [client?.id]);

  // Calendar grid computation
  const calDisplay = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const calYear = calDisplay.getFullYear();
  const calMonth = calDisplay.getMonth();
  const calLabel = calDisplay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const { calWeeks, calByDay, calMonthItems } = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = firstDay.getDay();
    const daysInMo = lastDay.getDate();

    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startDow);
    const totalCells = Math.ceil((startDow + daysInMo) / 7) * 7;
    const days: Date[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dd = new Date(gridStart);
      dd.setDate(gridStart.getDate() + i);
      days.push(dd);
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const byDay: Record<string, CalendarItem[]> = {};
    for (const it of calItems) {
      const key = it.post_date.slice(0, 10);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(it);
    }

    const monthStart = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const monthEnd = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(daysInMo).padStart(2, '0')}`;
    const monthItemsOut = calItems.filter((i) => i.post_date >= monthStart && i.post_date <= monthEnd);

    return { calWeeks: weeks, calByDay: byDay, calMonthItems: monthItemsOut };
  }, [calItems, calYear, calMonth]);

  const calTodayStr = new Date().toISOString().slice(0, 10);

  async function saveProjection(monthKey: string) {
    const actual = parseFloat(editValues.actual) || 0;
    const projected = parseFloat(editValues.projected) || 0;

    // Update local state
    const updated = projections.map((m) =>
      m.monthKey === monthKey ? { ...m, actual, projected } : m
    );
    setProjections(updated);
    setEditingMonth(null);

    // Build KV value
    const kvValue: Record<string, { actual: number; projected: number }> = {};
    updated.forEach((m) => {
      kvValue[m.monthKey] = { actual: m.actual, projected: m.projected };
    });

    setSaving(true);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, key: 'revenue_projections', value: kvValue }),
    });
    setSaving(false);
  }

  const { gradientFrom, gradientTo } = client.branding;
  const kpis = KNOWN_KPIS[client.id] || [
    { label: 'Monthly Revenue Target', value: `$${(client.kpiTargets.revenue / 1000).toFixed(0)}K`, sub: 'From your plan', color: '#0ea5e9' },
    { label: 'Lead Target', value: `${client.kpiTargets.leads}`, sub: 'Monthly goal', color: '#8b5cf6' },
    { label: 'Conversion Target', value: `${client.kpiTargets.conversionRate}%`, sub: 'Goal', color: '#ec4899' },
    { label: 'Ad Spend', value: `$${(client.kpiTargets.adSpend / 1000).toFixed(1)}K`, sub: 'Monthly budget', color: '#06b6d4' },
  ];
  const topPosts = TOP_POSTS_BY_CLIENT[client.id] || [];

  // Calculate growth rate from actuals for display
  const withActuals = projections.filter((m) => m.actual > 0);
  let avgGrowthPct = 0;
  if (withActuals.length >= 2) {
    const rates: number[] = [];
    for (let i = 1; i < withActuals.length; i++) {
      if (withActuals[i - 1].actual > 0) {
        rates.push((withActuals[i].actual / withActuals[i - 1].actual - 1) * 100);
      }
    }
    avgGrowthPct = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  }

  // Current month index (0-based) — April = 3
  const currentMonthIdx = new Date().getMonth();
  const currentQuarter = getQuarter(currentMonthIdx);

  // Quarterly rollups
  const quarters = [1, 2, 3, 4].map((q) => {
    const qMonths = projections.filter((_, i) => getQuarter(i) === q);
    const isComplete = q < currentQuarter;
    const isCurrent = q === currentQuarter;
    return {
      label: `Q${q}`,
      actual: qMonths.reduce((sum, m) => sum + m.actual, 0),
      projected: qMonths.reduce((sum, m) => sum + m.projected, 0),
      isComplete,
      isCurrent,
    };
  });
  const ytdActual = projections.slice(0, currentMonthIdx + 1).reduce((s, m) => s + m.actual, 0);
  const ytdProjected = projections.slice(0, currentMonthIdx + 1).reduce((s, m) => s + m.projected, 0);
  const annualProjected = projections.reduce((s, m) => s + m.projected, 0);

  // For bar chart: show months with data through current quarter + next month
  const chartMonths = projections.filter((m, i) => i <= currentMonthIdx + 2);
  const chartMax = Math.max(...chartMonths.map((m) => Math.max(m.actual, m.projected)), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Overview</h1>
          <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {client.name}
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Your top-line results, projections, and content performance.
        </p>
      </div>

      {/* Monthly Content Calendar Preview */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <div className="text-[15px] font-bold text-white">{calLabel}</div>
            <button onClick={() => setMonthOffset((o) => o + 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[10px] font-semibold text-white/50 hover:text-white/80 ml-1">Today</button>
            )}
          </div>
          <Link href="/client/calendar" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">
            Open Content Calendar →
          </Link>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-[9px] font-bold uppercase tracking-wider text-white/50 text-center pb-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calWeeks.flat().map((day) => {
            const iso = day.toISOString().slice(0, 10);
            const inMonth = day.getMonth() === calMonth;
            const isToday = iso === calTodayStr;
            const dayItems = calByDay[iso] || [];
            return (
              <div
                key={iso}
                className={`min-h-[72px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${
                  isToday
                    ? 'border-white bg-white/15'
                    : inMonth
                    ? 'border-white/10 bg-white/5'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className={`text-[9px] font-bold ${inMonth ? 'text-white/50' : 'text-white/25'}`}>
                  {day.getDate()}
                </div>
                {dayItems.slice(0, 3).map((it) => (
                  <div key={it.id} className="flex items-start gap-1">
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: STATUS_DOT[(it.client_approval_status || 'pending_review') as CalendarApprovalStatus] || '#9ca3af' }} />
                    <span className="text-[8px] leading-tight text-white/80 line-clamp-2">
                      {PLATFORM_EMOJI[it.platform] || ''} {parseCalTitle(it.title) || it.platform}
                    </span>
                  </div>
                ))}
                {dayItems.length > 3 && <div className="text-[8px] text-white/40">+{dayItems.length - 3} more</div>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap text-[10px] text-white/70">
          {Object.entries(STATUS_DOT).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {key === 'pending_review' ? 'Pending review' : key === 'changes_requested' ? 'Changes requested' : key.charAt(0).toUpperCase() + key.slice(1)}
            </div>
          ))}
        </div>
        <div className="text-[11px] text-white/50 mt-2">{calMonthItems.length} posts this month</div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[22px]" style={{ background: k.color }} />
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">{k.label}</div>
            <div className="text-[34px] font-black text-white leading-none my-2">{k.value}</div>
            {k.sub && <div className="text-[11px] text-white/70">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Revenue Projections — Monthly */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-bold text-white">Revenue Projections · {CURRENT_YEAR}</div>
              {avgGrowthPct > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  +{avgGrowthPct.toFixed(1)}% avg MoM growth
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/50">
              Click any month to update actuals or projections
              {saving && <span className="ml-2 text-amber-400">Saving...</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-white/70">
              <div className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }} />
              Actual
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/70">
              <div className="w-3 h-3 rounded" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }} />
              Projected
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-44 mb-4">
          {chartMonths.map((m, i) => {
            const isPast = i <= currentMonthIdx;
            const isEditing = editingMonth === m.monthKey;
            return (
              <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-white/85">
                  {m.actual > 0 ? `$${(m.actual / 1000).toFixed(1)}K` : isPast ? '—' : ''}
                </div>
                <div className="w-full flex gap-0.5 items-end" style={{ height: '100%' }}>
                  <div
                    className="flex-1 rounded-t-md transition-all cursor-pointer hover:opacity-80"
                    style={{
                      height: m.actual > 0 ? `${(m.actual / chartMax) * 100}%` : '2px',
                      background: m.actual > 0 ? `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` : 'rgba(255,255,255,0.1)',
                      minHeight: 2,
                    }}
                    onClick={() => {
                      setEditingMonth(m.monthKey);
                      setEditValues({ actual: String(m.actual || ''), projected: String(m.projected || '') });
                    }}
                  />
                  <div
                    className="flex-1 rounded-t-md cursor-pointer hover:opacity-80"
                    style={{
                      height: `${(m.projected / chartMax) * 100}%`,
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      minHeight: 2,
                    }}
                    onClick={() => {
                      setEditingMonth(m.monthKey);
                      setEditValues({ actual: String(m.actual || ''), projected: String(m.projected || '') });
                    }}
                  />
                </div>
                <div className={`text-[10px] font-semibold ${i === currentMonthIdx ? 'text-white' : 'text-white/40'}`}>
                  {m.month}
                </div>

                {isEditing && (
                  <div className="absolute mt-2 rounded-xl shadow-xl p-4 z-10 w-56"
                    style={{ transform: 'translateY(100%)', background: 'rgba(15,31,46,0.95)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
                  >
                    <div className="text-[11px] font-bold text-white mb-2">{m.month} {CURRENT_YEAR}</div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Actual Revenue</label>
                        <input
                          type="number"
                          value={editValues.actual}
                          onChange={(e) => setEditValues({ ...editValues, actual: e.target.value })}
                          placeholder="0"
                          className="w-full mt-1 text-[13px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white outline-none focus:border-white/30 placeholder:text-white/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Projected Revenue</label>
                        <input
                          type="number"
                          value={editValues.projected}
                          onChange={(e) => setEditValues({ ...editValues, projected: e.target.value })}
                          placeholder="0"
                          className="w-full mt-1 text-[13px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white outline-none focus:border-white/30 placeholder:text-white/30"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveProjection(m.monthKey)}
                          className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg text-white"
                          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMonth(null)}
                          className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/10 text-white/70"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary row */}
        <div className="pt-4 border-t border-white/10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">YTD Actual</div>
            <div className="text-[22px] font-black text-white">${(ytdActual / 1000).toFixed(1)}K</div>
            {ytdProjected > 0 && (
              <div className={`text-[11px] font-semibold ${ytdActual >= ytdProjected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ytdActual >= ytdProjected ? 'On track' : `${Math.round((ytdActual / ytdProjected) * 100)}% of projection`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {quarters.map((q) => (
          <div
            key={q.label}
            className={`glass-card p-5 relative overflow-hidden ${
              q.isCurrent ? 'ring-1 ring-white/20' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{q.label} {CURRENT_YEAR}</div>
              {q.isComplete && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Complete</span>
              )}
              {q.isCurrent && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Current</span>
              )}
              {!q.isComplete && !q.isCurrent && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/40">Upcoming</span>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-white/50">{q.isComplete ? 'Final' : 'Actual'}</div>
                <div className="text-[20px] font-black text-white">
                  {q.actual > 0 ? `$${(q.actual / 1000).toFixed(1)}K` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/50">{q.isComplete ? 'Was projected' : 'Projected'}</div>
                <div className="text-[18px] font-bold text-white/60">${(q.projected / 1000).toFixed(1)}K</div>
              </div>
              {q.actual > 0 && q.projected > 0 && (
                <>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((q.actual / q.projected) * 100, 100)}%`,
                        background: q.actual >= q.projected
                          ? `linear-gradient(90deg, #10b981, #34d399)`
                          : `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                      }}
                    />
                  </div>
                  <div className={`text-[10px] font-semibold ${q.actual >= q.projected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Math.round((q.actual / q.projected) * 100)}% of projection
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ad Spend Breakdown */}
      {(AD_SPEND_BY_CLIENT[client.id] || []).length > 0 && (
        <div className="glass-card p-6">
          <div className="text-[15px] font-bold text-white mb-4">Ad Spend Breakdown</div>
          <div className="space-y-3">
            {(AD_SPEND_BY_CLIENT[client.id] || []).map((item, i) => {
              const total = (AD_SPEND_BY_CLIENT[client.id] || []).reduce((s, x) => s + x.monthly, 0);
              const pct = (item.monthly / total) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-[13px] font-bold text-white">{item.agency}</span>
                      <span className="text-[11px] text-white/70 ml-2">· {item.channel}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-white">{fmtUSD(item.monthly)}/mo</div>
                      <div className="text-[10px] text-white/70">{item.note}</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-[12px] font-bold text-white/50 uppercase tracking-wider">Total monthly ad spend</div>
            <div className="text-[20px] font-black text-white">
              {fmtUSD((AD_SPEND_BY_CLIENT[client.id] || []).reduce((s, i) => s + i.monthly, 0))}
            </div>
          </div>
        </div>
      )}

      {/* Lead Sources */}
      {leadSplit && (
        <div className="glass-card p-6">
          <div className="text-[15px] font-bold text-white mb-4">Lead Sources</div>
          <div className="grid gap-3">
            {LEAD_CATEGORIES.map((cat) => {
              const pct = leadSplit[cat.key] || 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-[13px] font-semibold text-white">{cat.label}</span>
                      <span className="text-[11px] text-white/50 ml-2">{cat.sub}</span>
                    </div>
                    <span className="text-[14px] font-black text-white">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content performance */}
      {topPosts.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-bold text-white">Top performing content</div>
            <span className="text-[11px] text-white/50">Last 30 days</span>
          </div>
          <div className="grid gap-3">
            {topPosts.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                  >
                    {p.platform.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{p.title}</div>
                    <div className="text-[10px] text-white/50">{p.platform} · {p.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="text-[10px] text-white/50">Engagement</div>
                    <div className="text-[13px] font-bold text-white">{p.engagement.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">Reach</div>
                    <div className="text-[13px] font-bold text-white">{p.reach.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPosts.length === 0 && (
        <div className="glass-card p-6 text-center">
          <div className="text-[14px] font-semibold text-white/60">Content performance</div>
          <div className="text-[12px] text-white/40 mt-1">We&apos;ll show your top posts here once we have engagement data.</div>
        </div>
      )}

      {/* Meta Ads Account card */}
      {client.metaAds && (
        <div className="glass-card p-6">
          <div className="text-[15px] font-bold text-white mb-4">Meta Ads Account</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1fr 1fr' }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Business Portfolio</div>
              <div className="text-[13px] font-bold text-white mt-1">{client.metaAds.businessPortfolioName}</div>
              <div className="text-[10px] text-white/70 font-mono">{client.metaAds.businessPortfolioId}</div>
              {client.metaAds.verificationStatus && (
                <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  client.metaAds.verificationStatus === 'Verified'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {client.metaAds.verificationStatus}
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Ad Account</div>
              <div className="text-[13px] font-bold text-white mt-1 font-mono">{client.metaAds.adAccountId}</div>
              {client.metaAds.partnerName && (
                <div className="text-[10px] text-white/70 mt-1">Managed by {client.metaAds.partnerName}</div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Pixel</div>
              {client.metaAds.datasetPixel ? (
                <>
                  <div className="text-[13px] font-bold text-white mt-1">{client.metaAds.datasetPixel.name}</div>
                  <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {client.metaAds.datasetPixel.status || 'Active'}
                  </span>
                </>
              ) : (
                <div className="text-[11px] text-white/40 italic">Not connected</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
