'use client';

/**
 * KPISection — headline KPI tiles for an agency or client view.
 *
 * Auto-pulls what the portal can (Meta ad metrics from /api/meta/insights);
 * pipeline metrics (leads, appointments, revenue, close rate) have no live API
 * so they're manual. Any metric can be overridden by typing a value, which is
 * saved per (client, metric, month) to /api/kpis — same MoM click-to-edit
 * pattern as the sales benchmarks. Month-over-month deltas are computed
 * automatically once two months of data exist.
 */

import React, { useEffect, useMemo, useState } from 'react';

type Source = 'meta' | 'manual';
type MetricDef = {
  key: string;
  label: string;
  source: Source;
  // which field on the Meta insights totals object feeds this metric
  metaField?: 'totalSpend' | 'totalImpressions' | 'totalClicks' | 'ctr' | 'cpc';
  fmt: (n: number) => string;
  icon: string;
  goodWhenUp?: boolean; // for delta colour (default true)
};

const METRICS: MetricDef[] = [
  { key: 'ad_spend',     label: 'Ad Spend',     source: 'meta',   metaField: 'totalSpend',       fmt: (n) => `$${Math.round(n).toLocaleString()}`, icon: 'payments', goodWhenUp: false },
  { key: 'impressions',  label: 'Impressions',  source: 'meta',   metaField: 'totalImpressions', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'visibility' },
  { key: 'clicks',       label: 'Clicks',       source: 'meta',   metaField: 'totalClicks',      fmt: (n) => Math.round(n).toLocaleString(),        icon: 'ads_click' },
  { key: 'ctr',          label: 'CTR',          source: 'meta',   metaField: 'ctr',              fmt: (n) => `${n.toFixed(2)}%`,                     icon: 'percent' },
  { key: 'cpc',          label: 'Cost / Click', source: 'meta',   metaField: 'cpc',              fmt: (n) => `$${n.toFixed(2)}`,                     icon: 'sell', goodWhenUp: false },
  { key: 'leads',        label: 'Leads',        source: 'manual', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'group_add' },
  { key: 'appointments', label: 'Booked Calls', source: 'manual', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'event_available' },
  { key: 'revenue',      label: 'Revenue',      source: 'manual', fmt: (n) => `$${Math.round(n).toLocaleString()}`,  icon: 'attach_money' },
  { key: 'close_rate',   label: 'Close Rate',   source: 'manual', fmt: (n) => `${n.toFixed(1)}%`,                    icon: 'trending_up' },
];

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevYearMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return ymOf(d);
}
function labelYM(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

type AutoTotals = Record<string, number>;

export default function KPISection({
  clientId,
  title = 'KPIs',
  gradientFrom,
  gradientTo,
  editable = false,
  adAccountId,
}: {
  clientId: string;
  title?: string;
  gradientFrom: string;
  gradientTo: string;
  editable?: boolean;
  adAccountId?: string;
}) {
  const realCurrentYM = useMemo(() => ymOf(new Date()), []);
  const realPrevYM = useMemo(() => prevYearMonth(realCurrentYM), [realCurrentYM]);

  const [ym, setYm] = useState<string>(realCurrentYM);
  const [manual, setManual] = useState<Record<string, Record<string, number>>>({}); // metric → ym → value
  const [autoThis, setAutoThis] = useState<AutoTotals | null>(null);
  const [autoPrev, setAutoPrev] = useState<AutoTotals | null>(null);
  const [metaErr, setMetaErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const months = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) list.push(ymOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    return list;
  }, []);

  // Load manual overrides
  useEffect(() => {
    fetch(`/api/kpis?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Record<string, number>> = {};
        for (const e of d.entries || []) {
          if (!map[e.metric]) map[e.metric] = {};
          map[e.metric][e.year_month] = Number(e.value) || 0;
        }
        setManual(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  // Auto-pull Meta insights for this + last month
  useEffect(() => {
    const q = adAccountId ? `&adAccountId=${encodeURIComponent(adAccountId)}` : '';
    Promise.all([
      fetch(`/api/meta/insights?datePreset=this_month${q}`).then((r) => r.json()),
      fetch(`/api/meta/insights?datePreset=last_month${q}`).then((r) => r.json()),
    ])
      .then(([cur, prev]) => {
        if (cur?.totals) setAutoThis(cur.totals); else setMetaErr(true);
        if (prev?.totals) setAutoPrev(prev.totals);
      })
      .catch(() => setMetaErr(true));
  }, [adAccountId]);

  // Auto value for a metric in a given month (only the real current/prev
  // months map to Meta presets).
  function autoVal(m: MetricDef, forYm: string): number | null {
    if (m.source !== 'meta' || !m.metaField) return null;
    const totals = forYm === realCurrentYM ? autoThis : forYm === realPrevYM ? autoPrev : null;
    if (!totals) return null;
    const v = totals[m.metaField];
    return typeof v === 'number' ? v : null;
  }
  // Resolved value: manual override wins, else auto.
  function resolve(m: MetricDef, forYm: string): { value: number | null; isAuto: boolean } {
    const man = manual[m.key]?.[forYm];
    if (man != null) return { value: man, isAuto: false };
    const auto = autoVal(m, forYm);
    return { value: auto, isAuto: auto != null };
  }

  async function saveMetric(metricKey: string, value: number) {
    setManual((prev) => ({ ...prev, [metricKey]: { ...(prev[metricKey] || {}), [ym]: value } }));
    await fetch('/api/kpis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, metric: metricKey, yearMonth: ym, value }),
    }).catch(() => {});
  }
  async function clearMetric(metricKey: string) {
    setManual((prev) => {
      const next = { ...prev, [metricKey]: { ...(prev[metricKey] || {}) } };
      delete next[metricKey][ym];
      return next;
    });
    await fetch(`/api/kpis?clientId=${encodeURIComponent(clientId)}&metric=${encodeURIComponent(metricKey)}&yearMonth=${ym}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  const prevYm = prevYearMonth(ym);

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>monitoring</span>
            {title}
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            Ad metrics auto-pull from Meta{metaErr ? ' (not connected — enter manually)' : ''}. {editable ? 'Click any tile to override.' : 'Pipeline numbers entered by your team.'} MoM deltas vs {labelYM(prevYm)}.
          </p>
        </div>
        <select
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border text-white focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }}
        >
          {months.map((m) => (
            <option key={m} value={m} className="bg-slate-900">{labelYM(m)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-[12px] text-white/55 py-8 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {METRICS.map((m) => {
            const { value, isAuto } = resolve(m, ym);
            const prev = resolve(m, prevYm);
            const delta = value != null && prev.value != null ? value - prev.value : null;
            const deltaPct = value != null && prev.value != null && prev.value !== 0
              ? ((value - prev.value) / Math.abs(prev.value)) * 100 : null;
            const goodUp = m.goodWhenUp !== false;
            const deltaGood = delta != null && (goodUp ? delta > 0 : delta < 0);
            const deltaBad = delta != null && (goodUp ? delta < 0 : delta > 0);
            const editKey = m.key;
            const isEditing = editingKey === editKey;
            const hasOverride = manual[m.key]?.[ym] != null;

            return (
              <div
                key={m.key}
                onClick={() => {
                  if (editable && !isEditing) {
                    setEditingKey(editKey);
                    setDraft(value != null ? String(value) : '');
                  }
                }}
                className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: editable ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/45 flex items-center gap-1">
                    <span className="material-symbols-outlined text-white/40" style={{ fontSize: 13 }}>{m.icon}</span>
                    {m.label}
                  </span>
                  {value != null && (
                    isAuto
                      ? <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold uppercase tracking-wide">auto</span>
                      : hasOverride && m.source === 'meta'
                        ? <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold uppercase tracking-wide">manual</span>
                        : null
                  )}
                </div>

                {isEditing ? (
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      const v = Number(draft);
                      if (!isNaN(v) && draft.trim() !== '') saveMetric(m.key, v);
                      setEditingKey(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = Number(draft);
                        if (!isNaN(v) && draft.trim() !== '') saveMetric(m.key, v);
                        setEditingKey(null);
                      } else if (e.key === 'Escape') setEditingKey(null);
                    }}
                    className="w-full px-2 py-1 rounded text-white text-[16px] font-bold outline-none"
                    style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${gradientTo}` }}
                  />
                ) : (
                  <div className="text-[20px] font-black text-white leading-none tabular-nums">
                    {value != null ? m.fmt(value) : <span className="text-white/30 text-[15px]">—</span>}
                  </div>
                )}

                <div className="min-h-[14px]">
                  {delta != null && delta !== 0 && (
                    <span className={`text-[9px] font-semibold ${deltaGood ? 'text-emerald-400' : deltaBad ? 'text-rose-400' : 'text-white/45'}`}>
                      {delta > 0 ? '▲' : '▼'} {m.fmt(Math.abs(delta))}
                      {deltaPct != null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%)`}
                    </span>
                  )}
                  {editable && hasOverride && m.source === 'meta' && !isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearMetric(m.key); }}
                      className="text-[8px] text-white/40 hover:text-white ml-2"
                    >
                      reset to auto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
