'use client';

/**
 * Monthly month-over-month strip.
 *
 * Locks a card's current live numbers into a monthly snapshot on demand
 * ("Capture this month"), then shows this-month-vs-last-month deltas. Meant
 * to be dropped under the stat tiles of any analytics card (TikTok, YouTube,
 * Google Reviews, …).
 *
 * Snapshots reuse the kpi_entries store via /api/kpis under namespaced metric
 * keys (`snap_<scope>_<field>`), so no new table/route is needed and the keys
 * never collide with the real KPI metrics.
 */

import React, { useCallback, useEffect, useState } from 'react';

export type MoMMetric = {
  key: string;                 // short field id, e.g. 'followers'
  label: string;
  value: number | null;        // current live value (null when unavailable)
  fmt?: (n: number) => string;
  goodWhenUp?: boolean;        // delta colour (default true)
};

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevYm(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return ymOf(d);
}
function labelYM(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function MonthlyMoM({
  clientId,
  scope,
  metrics,
  gradientFrom,
  gradientTo,
  editable = true,
}: {
  clientId: string;
  scope: string;
  metrics: MoMMetric[];
  gradientFrom: string;
  gradientTo: string;
  editable?: boolean;
}) {
  const ym = ymOf(new Date());
  const prior = prevYm(ym);
  const prefix = `snap_${scope}_`;

  // field → ym → value
  const [snaps, setSnaps] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/kpis?clientId=${encodeURIComponent(clientId)}`);
      const d = await r.json();
      const map: Record<string, Record<string, number>> = {};
      for (const e of d.entries || []) {
        const metric: string = e.metric || '';
        if (!metric.startsWith(prefix)) continue;
        const field = metric.slice(prefix.length);
        (map[field] ||= {})[e.year_month] = Number(e.value) || 0;
      }
      setSnaps(map);
    } catch {}
  }, [clientId, prefix]);

  useEffect(() => { load(); }, [load]);

  const capturable = metrics.filter((m) => typeof m.value === 'number' && !Number.isNaN(m.value));

  async function capture() {
    if (capturable.length === 0) return;
    setBusy(true); setMsg('');
    try {
      await Promise.all(
        capturable.map((m) =>
          fetch('/api/kpis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, metric: `${prefix}${m.key}`, yearMonth: ym, value: m.value }),
          }),
        ),
      );
      setSnaps((prev) => {
        const next = { ...prev };
        for (const m of capturable) {
          next[m.key] = { ...(next[m.key] || {}), [ym]: m.value as number };
        }
        return next;
      });
      setMsg(`Captured ${labelYM(ym)}`);
    } catch {
      setMsg('Capture failed — try again');
    } finally {
      setBusy(false);
    }
  }

  const captured = (key: string, period: string): number | null => {
    const v = snaps[key]?.[period];
    return typeof v === 'number' ? v : null;
  };
  const hasThisMonth = metrics.some((m) => captured(m.key, ym) !== null);

  return (
    <div className="rounded-xl p-3 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">
          Month over month · {labelYM(ym)} vs {labelYM(prior)}
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-[10px] text-white/60">{msg}</span>}
          {editable && (
            <button
              onClick={capture}
              disabled={busy || capturable.length === 0}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
            >
              {busy ? 'Saving…' : hasThisMonth ? 'Re-capture this month' : 'Capture this month'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {metrics.map((m) => {
          const fmt = m.fmt || ((n: number) => n.toLocaleString());
          const now = captured(m.key, ym);
          const then = captured(m.key, prior);
          // Show the captured value if we have it, otherwise the live value as a preview.
          const display = now != null ? now : m.value;
          const delta = now != null && then != null ? now - then : null;
          const goodUp = m.goodWhenUp !== false;
          const up = (delta ?? 0) >= 0;
          const good = up === goodUp;
          return (
            <div key={m.key} className="rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <div className="text-[9px] uppercase tracking-wider font-bold text-white/45">{m.label}</div>
              <div className="text-[15px] font-black text-white leading-tight mt-0.5">
                {display != null ? fmt(display) : '—'}
                {now == null && display != null && (
                  <span className="text-[8px] font-semibold text-white/35 ml-1 align-middle">live</span>
                )}
              </div>
              {delta != null && delta !== 0 ? (
                <div className={`text-[10px] mt-0.5 font-semibold ${good ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {up ? '▲' : '▼'} {fmt(Math.abs(delta))} vs {labelYM(prior)}
                </div>
              ) : then != null ? (
                <div className="text-[10px] mt-0.5 text-white/40">no change vs {labelYM(prior)}</div>
              ) : (
                <div className="text-[10px] mt-0.5 text-white/30">awaiting {labelYM(prior)} snapshot</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
