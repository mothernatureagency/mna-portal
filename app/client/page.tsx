'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clients, Client } from '@/lib/clients';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';
import { getAttributionForClient } from '@/lib/data/attribution';
import AttributionOverview from '@/components/client-portal/AttributionOverview';
import { getPerformanceForClient } from '@/lib/data/performance';
import PerformanceOverview from '@/components/client-portal/PerformanceOverview';
import CompetitorBenchmark from '@/components/dashboard/CompetitorBenchmark';
import GoogleOverview from '@/components/client-portal/GoogleOverview';
import MetaAdsOverview from '@/components/client-portal/MetaAdsOverview';
import KPISection from '@/components/dashboard/KPISection';
import PortalSection from '@/components/client-portal/PortalSection';
import { usePortalEdit } from '@/components/client-portal/PortalEditContext';
import { EditableText, EditableNumber, EditButton } from '@/components/client-portal/PortalEditable';
import {
  DEFAULT_LEAD_SOURCES,
  KPI_COLORS,
  defaultAdSpend,
  defaultKpis,
  defaultTopPosts,
  type AdSpendRow,
  type KpiTile,
  type LeadSourceRow,
  type TopPostRow,
} from '@/lib/portal-layout';
import { driveThumbnailUrl, driveViewUrl } from '@/lib/drive';

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

// Calendar types for the overview preview
type CalendarApprovalStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'scheduled';
type CalendarItem = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  client_approval_status: CalendarApprovalStatus | null;
  photo_drive_url: string | null;
  caption: string | null;
};

/** Image with graceful fallback — hides itself if Drive thumbnail fails to load */
function DriveThumb({ url, className }: { url: string | null | undefined; className?: string }) {
  const thumb = driveThumbnailUrl(url, 400);
  const [failed, setFailed] = useState(false);
  if (!thumb || failed) return null;
  return <img src={thumb} alt="" className={className} onError={() => setFailed(true)} />;
}

const STATUS_DOT: Record<CalendarApprovalStatus, string> = {
  drafting: '#9ca3af',
  pending_review: '#f59e0b',
  approved: '#10b981',
  changes_requested: '#f43f5e',
  scheduled: '#0ea5e9',
};

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: '📸', Facebook: '📘', Meta: '🔷', TikTok: '🎵', LinkedIn: '💼', YouTube: '🎬',
};

function parseCalTitle(raw: string | null) {
  if (!raw) return '';
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
}

/** Shown in edit mode where a data-driven section has nothing to render yet. */
function SectionPlaceholder({ text }: { text: string }) {
  return <div className="glass-card p-5 text-[12px] text-white/40 italic">{text}</div>;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function ClientOverviewPage() {
  const { client, isStaffPreview } = useClientPortal();
  const { editMode, content, updateContent, title, setTitle } = usePortalEdit();
  const [projections, setProjections] = useState<MonthData[]>([]);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ actual: '', projected: '' });
  const [saving, setSaving] = useState(false);
  const [calItems, _setCalItems] = useState<CalendarItem[]>([]);
  function setCalItems(updater: CalendarItem[] | ((prev: CalendarItem[]) => CalendarItem[])) {
    _setCalItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((it) => ({
        ...it,
        post_date: it.post_date.length > 10
          ? (() => { const d = new Date(it.post_date); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; })()
          : it.post_date,
      }));
    });
  }
  const [leadSplit, setLeadSplit] = useState<Record<string, number> | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeCalId, setActiveCalId] = useState<string | null>(null);

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
    fetch(`/api/content-calendar?client=${encodeURIComponent(client.name)}&visible=1`)
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

  // Use local date parts to avoid UTC shift
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const calTodayStr = localDateStr(new Date());

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

  // Editable section content — staff overrides from portal_content, otherwise
  // the per-client defaults. Every setter writes straight back to the store.
  const kpis: KpiTile[] = content.kpis ?? defaultKpis(client);
  const adSpend: AdSpendRow[] = content.adSpend ?? defaultAdSpend(client);
  const topPosts: TopPostRow[] = content.topPosts ?? defaultTopPosts(client);
  const leadSources: LeadSourceRow[] =
    content.leadSources ??
    DEFAULT_LEAD_SOURCES.map((c) => ({ ...c, pct: leadSplit?.[c.key] ?? 0 }));

  function setKpi(i: number, patch: Partial<KpiTile>) {
    updateContent({ kpis: kpis.map((k, idx) => (idx === i ? { ...k, ...patch } : k)) });
  }
  function addKpi() {
    updateContent({
      kpis: [...kpis, { label: 'New metric', value: '—', sub: '', color: KPI_COLORS[kpis.length % KPI_COLORS.length] }],
    });
  }
  function removeKpi(i: number) {
    updateContent({ kpis: kpis.filter((_, idx) => idx !== i) });
  }
  function cycleKpiColor(i: number) {
    const cur = KPI_COLORS.indexOf(kpis[i].color);
    setKpi(i, { color: KPI_COLORS[(cur + 1) % KPI_COLORS.length] });
  }
  function setAdRow(i: number, patch: Partial<AdSpendRow>) {
    updateContent({ adSpend: adSpend.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function addAdRow() {
    updateContent({ adSpend: [...adSpend, { agency: 'Mother Nature Agency', channel: 'Meta', monthly: 0, note: '' }] });
  }
  function removeAdRow(i: number) {
    updateContent({ adSpend: adSpend.filter((_, idx) => idx !== i) });
  }
  function setLeadRow(i: number, patch: Partial<LeadSourceRow>) {
    updateContent({ leadSources: leadSources.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function addLeadRow() {
    updateContent({
      leadSources: [...leadSources, { key: `src-${Date.now()}`, label: 'New source', sub: '', pct: 0 }],
    });
  }
  function removeLeadRow(i: number) {
    updateContent({ leadSources: leadSources.filter((_, idx) => idx !== i) });
  }
  function setPost(i: number, patch: Partial<TopPostRow>) {
    updateContent({ topPosts: topPosts.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function addPost() {
    updateContent({ topPosts: [...topPosts, { platform: 'Instagram', title: 'New post', type: 'Reel', engagement: 0, reach: 0 }] });
  }
  function removePost(i: number) {
    updateContent({ topPosts: topPosts.filter((_, idx) => idx !== i) });
  }
  const adSpendTotal = adSpend.reduce((sum, r) => sum + (r.monthly || 0), 0);

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
          <EditableText
            value={content.subtitle ?? 'Your top-line results, projections, and content performance.'}
            onChange={(v) => updateContent({ subtitle: v })}
            className="text-[12px] text-white/60"
            placeholder="Intro line for this client"
            fullWidth={editMode}
          />
        </p>
      </div>

      <PortalSection id="overview.calendar">
      {/* Monthly Content Calendar Preview */}
      <div className="glass-card p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <div className="text-[14px] md:text-[15px] font-bold text-white">{calLabel}</div>
            <button onClick={() => setMonthOffset((o) => o + 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[10px] font-semibold text-white/50 hover:text-white/80 ml-1">Today</button>
            )}
          </div>
          <Link href="/client/calendar" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 self-start sm:self-auto">
            Open Content Calendar →
          </Link>
        </div>

        {/* Desktop: Calendar grid with photo previews */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[9px] font-bold uppercase tracking-wider text-white/50 text-center pb-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calWeeks.flat().map((day) => {
              const iso = localDateStr(day);
              const inMonth = day.getMonth() === calMonth;
              const isToday = iso === calTodayStr;
              const dayItems = calByDay[iso] || [];
              return (
                <div
                  key={iso}
                  className={`min-h-[90px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${
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
                  {dayItems.slice(0, 2).map((it) => {
                    const status = (it.client_approval_status || 'pending_review') as CalendarApprovalStatus;
                    return (
                      <button
                        key={it.id}
                        onClick={() => setActiveCalId(it.id)}
                        className="w-full text-left rounded overflow-hidden border border-white/10 bg-white/[0.04] hover:ring-2 hover:ring-white/20 hover:bg-white/10 transition-all cursor-pointer"
                      >
                        {it.photo_drive_url && (
                          <DriveThumb url={it.photo_drive_url} className="w-full h-[42px] object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className="px-1 py-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[status] || '#9ca3af' }} />
                          <span className="text-[7px] leading-tight text-white/70 truncate">
                            {PLATFORM_EMOJI[it.platform] || ''} {parseCalTitle(it.title) || it.platform}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {dayItems.length > 2 && <div className="text-[7px] text-white/40">+{dayItems.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: Agenda list view */}
        <div className="md:hidden space-y-2">
          {calMonthItems.length === 0 && (
            <div className="text-center text-white/40 text-[12px] py-6">No posts this month</div>
          )}
          {calMonthItems.map((it) => {
            const status = (it.client_approval_status || 'pending_review') as CalendarApprovalStatus;
            return (
              <button
                key={it.id}
                onClick={() => setActiveCalId(it.id)}
                className="w-full text-left flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 hover:ring-2 hover:ring-white/20 transition-all"
              >
                {it.photo_drive_url && (
                  <div className="shrink-0 rounded-lg overflow-hidden w-14 h-14">
                    <DriveThumb url={it.photo_drive_url} className="w-14 h-14 object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    {new Date(`${it.post_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}{it.platform}
                  </div>
                  <div className="text-[13px] font-semibold text-white truncate">{parseCalTitle(it.title) || 'Untitled'}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[status] || '#9ca3af' }} />
                    <span className="text-[10px] text-white/60 capitalize">{status.replace('_', ' ')}</span>
                  </div>
                </div>
              </button>
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

      </PortalSection>

      <PortalSection id="overview.kpis-live" titleKey="overview.kpis-live" defaultTitle="Performance KPIs">
      {/* Performance KPIs — auto-pull Meta ad metrics, manual pipeline numbers */}
      <KPISection
        clientId={client.id}
        title={title('overview.kpis-live', 'Performance KPIs')}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        adAccountId={client.metaAds?.adAccountId}
        editable={isStaffPreview}
      />

      </PortalSection>

      <PortalSection id="overview.meta-ads">
      {/* Meta Ads Performance — live campaign numbers, no account IDs */}
      <MetaAdsOverview
        clientId={client.id}
        adAccountId={client.metaAds?.adAccountId}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
      />
      </PortalSection>

      <PortalSection id="overview.google">
      {/* Google Performance — Business Profile (live) + Ads / GA4 / Search Console */}
      <GoogleOverview
        clientId={client.id}
        clientName={client.shortName}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        editable={isStaffPreview}
      />
      </PortalSection>

      <PortalSection id="overview.competitors">
      {/* Competitor Benchmark — currently only wired with data for Prime IV Niceville */}
      {client.id === 'prime-iv' ? (
        <CompetitorBenchmark gradientFrom={gradientFrom} gradientTo={gradientTo} clientId={client.id} clientName={client.shortName} editable={isStaffPreview} />
      ) : editMode ? (
        <SectionPlaceholder text="No competitor benchmark data wired up for this client yet." />
      ) : null}

      </PortalSection>

      {/* Calendar post preview modal */}
      {activeCalId && (() => {
        const item = calItems.find((i) => i.id === activeCalId);
        if (!item) return null;
        const status = (item.client_approval_status || 'pending_review') as CalendarApprovalStatus;
        const statusLabel = status === 'pending_review' ? 'Ready for review' : status === 'changes_requested' ? 'Changes requested' : status.charAt(0).toUpperCase() + status.slice(1);
        const driveLink = driveViewUrl(item.photo_drive_url);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActiveCalId(null)}>
            <div
              className="max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl rounded-2xl"
              style={{
                background: 'rgba(15,31,46,0.95)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(24px) saturate(180%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {item.photo_drive_url && (
                <a href={driveLink!} target="_blank" rel="noreferrer" className="block bg-black rounded-t-2xl overflow-hidden">
                  <DriveThumb url={item.photo_drive_url} className="w-full max-h-72 object-contain" />
                </a>
              )}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                    {new Date(`${item.post_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {item.platform} · {item.content_type || 'Post'}
                  </div>
                  <button onClick={() => setActiveCalId(null)} className="text-white/40 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="text-[18px] font-bold text-white leading-tight">{parseCalTitle(item.title) || 'Untitled'}</div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[status] || '#9ca3af' }} />
                  <span className="text-[12px] font-semibold text-white/70">{statusLabel}</span>
                </div>
                {item.caption && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Caption</div>
                    <div className="text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 max-h-52 overflow-y-auto">
                      {item.caption}
                    </div>
                  </div>
                )}
                {driveLink && (
                  <a href={driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/50 hover:text-white px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_library</span>
                    View Full Photo
                  </a>
                )}
                <div className="pt-3 border-t border-white/10">
                  <Link
                    href="/client/calendar"
                    className="text-[12px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1"
                  >
                    Open in Content Calendar →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <PortalSection id="overview.kpi-tiles">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="glass-card p-4 md:p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[22px]" style={{ background: k.color }} />
            {editMode && (
              <div className="flex items-center gap-1 mb-1.5">
                <button
                  type="button"
                  onClick={() => cycleKpiColor(i)}
                  title="Change accent colour"
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ background: k.color }}
                />
                <EditButton icon="delete" label="" tone="danger" onClick={() => removeKpi(i)} />
              </div>
            )}
            <EditableText
              value={k.label}
              onChange={(v) => setKpi(i, { label: v })}
              className="text-[10px] font-bold uppercase tracking-wider text-white/60 block"
              placeholder="Metric"
              fullWidth={editMode}
            />
            <EditableText
              value={k.value}
              onChange={(v) => setKpi(i, { value: v })}
              className="text-[26px] md:text-[34px] font-black text-white leading-none my-2 block"
              placeholder="—"
              fullWidth={editMode}
            />
            {(k.sub || editMode) && (
              <EditableText
                value={k.sub || ''}
                onChange={(v) => setKpi(i, { sub: v })}
                className="text-[11px] text-white/70 block"
                placeholder="Context line"
                fullWidth={editMode}
              />
            )}
          </div>
        ))}
        {editMode && (
          <button
            type="button"
            onClick={addKpi}
            className="glass-card p-4 md:p-5 flex flex-col items-center justify-center gap-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>add</span>
            <span className="text-[11px] font-semibold">Add tile</span>
          </button>
        )}
      </div>

      </PortalSection>

      <PortalSection id="overview.revenue">
      {/* Revenue Projections — Monthly */}
      <div className="glass-card p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[14px] md:text-[15px] font-bold text-white">
                <EditableText
                  value={title('overview.revenue', 'Revenue Projections')}
                  onChange={(v) => setTitle('overview.revenue', v)}
                  className="text-[14px] md:text-[15px] font-bold text-white"
                  placeholder="Section title"
                  minCh={14}
                />
                {' · '}{CURRENT_YEAR}
              </div>
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
        <div className="flex items-end gap-1.5 md:gap-2 h-36 md:h-44 mb-4 overflow-x-auto">
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

      </PortalSection>

      <PortalSection id="overview.quarters">
      {/* Quarterly Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

      </PortalSection>

      <PortalSection id="overview.performance">
      {/* Performance Overview (Q1 vs April) */}
      {(() => {
        const perfData = getPerformanceForClient(client.id);
        return perfData ? (
          <PerformanceOverview data={perfData} gradientFrom={gradientFrom} gradientTo={gradientTo} isStaff={isStaffPreview} />
        ) : editMode ? (
          <SectionPlaceholder text="No period-over-period performance data for this client yet." />
        ) : null;
      })()}

      </PortalSection>

      <PortalSection id="overview.attribution">
      {/* Attribution Overview */}
      {(() => {
        const attrData = getAttributionForClient(client.id);
        return attrData ? (
          <AttributionOverview data={attrData} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        ) : editMode ? (
          <SectionPlaceholder text="No attribution data for this client yet." />
        ) : null;
      })()}

      </PortalSection>

      <PortalSection id="overview.ad-spend">
      {/* Ad Spend Breakdown */}
      {(adSpend.length > 0 || editMode) && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <EditableText
              value={title('overview.ad-spend', 'Ad Spend Breakdown')}
              onChange={(v) => setTitle('overview.ad-spend', v)}
              className="text-[15px] font-bold text-white"
              placeholder="Section title"
              minCh={12}
            />
            {editMode && <EditButton icon="add" label="Add budget line" tone="accent" onClick={addAdRow} />}
          </div>
          <div className="space-y-3">
            {adSpend.map((item, i) => {
              const pct = adSpendTotal > 0 ? (item.monthly / adSpendTotal) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-1.5 gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <EditableText
                        value={item.agency}
                        onChange={(v) => setAdRow(i, { agency: v })}
                        className="text-[13px] font-bold text-white"
                        placeholder="Agency"
                        minCh={10}
                      />
                      <span className="text-[11px] text-white/70">·</span>
                      <EditableText
                        value={item.channel}
                        onChange={(v) => setAdRow(i, { channel: v })}
                        className="text-[11px] text-white/70"
                        placeholder="Channel"
                        minCh={6}
                      />
                      {editMode && (
                        <EditButton icon="delete" label="Remove" tone="danger" onClick={() => removeAdRow(i)} />
                      )}
                    </div>
                    <div className="sm:text-right">
                      <div className="text-[14px] font-bold text-white">
                        {editMode ? (
                          <>
                            <EditableNumber
                              value={item.monthly}
                              onChange={(v) => setAdRow(i, { monthly: v })}
                              prefix="$"
                              step={50}
                              min={0}
                            />
                            /mo
                          </>
                        ) : (
                          `${fmtUSD(item.monthly)}/mo`
                        )}
                      </div>
                      <EditableText
                        value={item.note}
                        onChange={(v) => setAdRow(i, { note: v })}
                        className="text-[10px] text-white/70"
                        placeholder="Note — e.g. $20/day daily budget"
                        minCh={14}
                      />
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
                  </div>
                </div>
              );
            })}
            {adSpend.length === 0 && (
              <div className="text-[12px] text-white/40 italic">
                No budget lines yet — add one and it appears in this client&apos;s portal.
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-[12px] font-bold text-white/50 uppercase tracking-wider">Total monthly ad spend</div>
            <div className="text-[20px] font-black text-white">{fmtUSD(adSpendTotal)}</div>
          </div>
        </div>
      )}

      </PortalSection>

      <PortalSection id="overview.lead-sources">
      {/* Lead Sources */}
      {(leadSplit || content.leadSources || editMode) && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <EditableText
              value={title('overview.lead-sources', 'Lead Sources')}
              onChange={(v) => setTitle('overview.lead-sources', v)}
              className="text-[15px] font-bold text-white"
              placeholder="Section title"
              minCh={12}
            />
            {editMode && <EditButton icon="add" label="Add source" tone="accent" onClick={addLeadRow} />}
          </div>
          <div className="grid gap-3">
            {leadSources.map((cat, i) => (
              <div key={cat.key}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <EditableText
                      value={cat.label}
                      onChange={(v) => setLeadRow(i, { label: v })}
                      className="text-[13px] font-semibold text-white"
                      placeholder="Source"
                      minCh={10}
                    />
                    <EditableText
                      value={cat.sub}
                      onChange={(v) => setLeadRow(i, { sub: v })}
                      className="text-[11px] text-white/50"
                      placeholder="Detail"
                      minCh={8}
                    />
                    {editMode && (
                      <EditButton icon="delete" label="Remove" tone="danger" onClick={() => removeLeadRow(i)} />
                    )}
                  </div>
                  <span className="text-[14px] font-black text-white shrink-0">
                    <EditableNumber
                      value={cat.pct}
                      onChange={(v) => setLeadRow(i, { pct: v })}
                      suffix="%"
                      min={0}
                      max={100}
                    />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, cat.pct))}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {editMode && (
            <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-white/45">
              Total {leadSources.reduce((sum, r) => sum + (r.pct || 0), 0)}%
            </div>
          )}
        </div>
      )}

      </PortalSection>

      <PortalSection id="overview.top-content">
      {/* Content performance */}
      {(topPosts.length > 0 || editMode) && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <EditableText
              value={title('overview.top-content', 'Top performing content')}
              onChange={(v) => setTitle('overview.top-content', v)}
              className="text-[15px] font-bold text-white"
              placeholder="Section title"
              minCh={14}
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50">Last 30 days</span>
              {editMode && <EditButton icon="add" label="Add post" tone="accent" onClick={addPost} />}
            </div>
          </div>
          <div className="grid gap-3">
            {topPosts.map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                  >
                    {(p.platform || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <EditableText
                      value={p.title}
                      onChange={(v) => setPost(i, { title: v })}
                      className="text-[13px] font-semibold text-white block truncate"
                      placeholder="Post title"
                      fullWidth={editMode}
                    />
                    <div className="text-[10px] text-white/50 flex items-center gap-1.5 flex-wrap">
                      <EditableText
                        value={p.platform}
                        onChange={(v) => setPost(i, { platform: v })}
                        className="text-[10px] text-white/50"
                        placeholder="Platform"
                        minCh={8}
                      />
                      <span>·</span>
                      <EditableText
                        value={p.type}
                        onChange={(v) => setPost(i, { type: v })}
                        className="text-[10px] text-white/50"
                        placeholder="Type"
                        minCh={5}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5 pl-12 sm:pl-0 sm:text-right">
                  <div>
                    <div className="text-[10px] text-white/50">Engagement</div>
                    <div className="text-[13px] font-bold text-white">
                      <EditableNumber value={p.engagement} onChange={(v) => setPost(i, { engagement: v })} min={0} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">Reach</div>
                    <div className="text-[13px] font-bold text-white">
                      <EditableNumber value={p.reach} onChange={(v) => setPost(i, { reach: v })} min={0} />
                    </div>
                  </div>
                  {editMode && <EditButton icon="delete" label="Remove" tone="danger" onClick={() => removePost(i)} />}
                </div>
              </div>
            ))}
            {topPosts.length === 0 && (
              <div className="text-[12px] text-white/40 italic">
                No posts listed yet — add one to highlight this client&apos;s best content.
              </div>
            )}
          </div>
        </div>
      )}

      {topPosts.length === 0 && !editMode && (
        <div className="glass-card p-6 text-center">
          <div className="text-[14px] font-semibold text-white/60">
            {title('overview.top-content', 'Top performing content')}
          </div>
          <div className="text-[12px] text-white/40 mt-1">We&apos;ll show your top posts here once we have engagement data.</div>
        </div>
      )}

      </PortalSection>

      <PortalSection id="overview.meta-account">
      {/* Meta Ads Account card */}
      {!client.metaAds && editMode && (
        <SectionPlaceholder text="No Meta ad account is linked to this client yet." />
      )}
      {client.metaAds && (
        <div className="glass-card p-6">
          <EditableText
            value={title('overview.meta-account', 'Meta Ads Account')}
            onChange={(v) => setTitle('overview.meta-account', v)}
            className="text-[15px] font-bold text-white mb-4 block"
            placeholder="Section title"
            minCh={12}
          />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Business Portfolio</div>
              <div className="text-[13px] font-bold text-white mt-1">{client.metaAds.businessPortfolioName}</div>
              {isStaffPreview && (
                <div className="text-[10px] text-white/70 font-mono">{client.metaAds.businessPortfolioId}</div>
              )}
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
              <div className="text-[13px] font-bold text-white mt-1 font-mono">
                {isStaffPreview ? client.metaAds.adAccountId : 'Connected'}
              </div>
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
      </PortalSection>
    </div>
  );
}
