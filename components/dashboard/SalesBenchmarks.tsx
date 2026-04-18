'use client';

/**
 * Sales Benchmarks — manual-entry card.
 *
 * Alexus has access to Destin's numbers (same area developer) and
 * corporate averages. This lets her plug in monthly values per metric
 * and see Niceville's performance alongside them at a glance.
 *
 * Metrics tracked: leads, bookings, revenue, conversion.
 * Competitors: "mine" (Niceville), "destin" (area developer), "corporate" (Prime IV main).
 */

import React, { useEffect, useMemo, useState } from 'react';

type Entry = {
  id: string;
  competitor_key: string;
  metric: string;
  year_month: string;
  value: number;
  note: string | null;
  updated_at: string;
};

type Metric = 'leads' | 'bookings' | 'revenue' | 'conversion' | 'memberships';
type CompKey = 'mine' | 'destin' | 'corporate';

const METRICS: { key: Metric; label: string; fmt: (n: number) => string; icon: string }[] = [
  { key: 'revenue',     label: 'Revenue',       fmt: (n) => `$${Math.round(n).toLocaleString()}`, icon: 'payments' },
  { key: 'leads',       label: 'Leads',         fmt: (n) => n.toLocaleString(),                   icon: 'group_add' },
  { key: 'bookings',    label: 'Bookings',      fmt: (n) => n.toLocaleString(),                   icon: 'event_available' },
  { key: 'conversion',  label: 'Conv. Rate %',  fmt: (n) => `${n.toFixed(1)}%`,                   icon: 'trending_up' },
  { key: 'memberships', label: 'Memberships',   fmt: (n) => n.toLocaleString(),                   icon: 'card_membership' },
];

const COMPETITORS: { key: CompKey; label: string; sub: string }[] = [
  { key: 'mine',      label: 'Niceville',      sub: 'Your location' },
  { key: 'destin',    label: 'Destin',         sub: 'Area developer' },
  { key: 'corporate', label: 'Corporate avg',  sub: 'Prime IV main' },
];

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevYearMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelYM(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function SalesBenchmarks({
  clientId,
  gradientFrom,
  gradientTo,
}: {
  clientId: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ym, setYm] = useState<string>(currentYearMonth());
  const [editingKey, setEditingKey] = useState<string | null>(null);  // `${comp}-${metric}`
  const [draftValue, setDraftValue] = useState<string>('');

  useEffect(() => {
    fetch(`/api/sales-benchmarks?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  // Index by key/metric for fast lookup.
  // Coerce value to Number here — Postgres returns `numeric` columns as
  // strings via the pg driver, and later .toFixed() / .toLocaleString()
  // calls on a string crash with "is not a function".
  const byKey = useMemo(() => {
    const map: Record<string, Entry> = {};
    for (const e of entries) {
      map[`${e.competitor_key}|${e.metric}|${e.year_month}`] = {
        ...e,
        value: Number(e.value) || 0,
      };
    }
    return map;
  }, [entries]);

  const prevYm = prevYearMonth(ym);

  async function save(comp: CompKey, metric: Metric, value: number) {
    const res = await fetch('/api/sales-benchmarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, competitorKey: comp, metric, yearMonth: ym, value }),
    });
    if (res.ok) {
      const d = await res.json();
      setEntries((prev) => {
        const kept = prev.filter((e) => !(e.competitor_key === comp && e.metric === metric && e.year_month === ym));
        return [d.entry, ...kept];
      });
    }
  }

  const months = useMemo(() => {
    // Build a list of year-months from today back 12 months
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  }, []);

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>equalizer</span>
            Sales Benchmarks · Niceville vs Destin vs Corporate
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            Type a number to save. Deltas vs last month shown automatically.
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
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-white/45 uppercase text-[9px] tracking-wider">
                <th className="text-left font-semibold px-2 py-2">Metric</th>
                {COMPETITORS.map((c) => (
                  <th key={c.key} className={`text-right font-semibold px-2 py-2 ${c.key === 'mine' ? 'text-white' : ''}`}>
                    <div className="flex flex-col items-end">
                      <span>{c.label}</span>
                      <span className="text-[8px] text-white/35 font-normal normal-case tracking-normal">{c.sub}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-white/60" style={{ fontSize: 15 }}>{m.icon}</span>
                      <span className="font-semibold text-white">{m.label}</span>
                    </div>
                  </td>
                  {COMPETITORS.map((c) => {
                    const entryKey = `${c.key}|${m.key}|${ym}`;
                    const entry = byKey[entryKey];
                    const prev = byKey[`${c.key}|${m.key}|${prevYm}`];
                    const delta = entry && prev ? entry.value - prev.value : null;
                    const deltaPct = entry && prev && prev.value ? ((entry.value - prev.value) / prev.value) * 100 : null;
                    const editKey = `${c.key}|${m.key}`;
                    const isEditing = editingKey === editKey;

                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-2.5 text-right ${c.key === 'mine' ? 'bg-white/[0.04]' : ''}`}
                        onClick={() => {
                          if (!isEditing) {
                            setEditingKey(editKey);
                            setDraftValue(entry ? String(entry.value) : '');
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            step="any"
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => {
                              const v = Number(draftValue);
                              if (!isNaN(v) && draftValue.trim() !== '') save(c.key, m.key, v);
                              setEditingKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = Number(draftValue);
                                if (!isNaN(v) && draftValue.trim() !== '') save(c.key, m.key, v);
                                setEditingKey(null);
                              } else if (e.key === 'Escape') {
                                setEditingKey(null);
                              }
                            }}
                            className="w-24 px-2 py-1 rounded text-right text-white text-[12px] outline-none"
                            style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${gradientTo}` }}
                          />
                        ) : entry ? (
                          <div>
                            <div className={`font-bold tabular-nums ${c.key === 'mine' ? 'text-white' : 'text-white/85'}`}>
                              {m.fmt(entry.value)}
                            </div>
                            {delta !== null && (
                              <div className={`text-[9px] ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-white/45'}`}>
                                {delta > 0 ? '▲' : delta < 0 ? '▼' : '·'} {m.fmt(Math.abs(delta))}
                                {deltaPct !== null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-white/30 hover:text-white/60 font-mono text-[11px]">—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/10">
        <div className="text-[10px] text-white/45">
          Click any cell to enter or edit a number. Data saves instantly.
          Month-over-month deltas appear once two months have data.
        </div>
      </div>

      {/* Quick competitive insight */}
      {(() => {
        const mineRev = byKey[`mine|revenue|${ym}`]?.value;
        const destinRev = byKey[`destin|revenue|${ym}`]?.value;
        const corpRev = byKey[`corporate|revenue|${ym}`]?.value;
        if (!mineRev) return null;
        const parts: string[] = [];
        if (destinRev) {
          const ratio = (mineRev / destinRev) * 100;
          parts.push(`${ratio.toFixed(0)}% of Destin's volume`);
        }
        if (corpRev) {
          const ratio = (mineRev / corpRev) * 100;
          parts.push(`${ratio.toFixed(0)}% of corporate average`);
        }
        if (!parts.length) return null;
        return (
          <div
            className="rounded-xl p-3 mt-3"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}11)`, border: `1px solid ${gradientFrom}55` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">
              ✦ Where Niceville stands ({labelYM(ym)})
            </div>
            <div className="text-[12px] text-white/85">{parts.join(' · ')}</div>
          </div>
        );
      })()}
    </div>
  );
}
