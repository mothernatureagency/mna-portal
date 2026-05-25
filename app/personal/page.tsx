'use client';

/**
 * Personal — Alexus's private space.
 *
 * Outer page matches the dark MNA dashboard aesthetic. The custody calendar
 * itself is a "paper" card — white background, blue accents, black text —
 * so it can be screenshot directly for formal documentation (court,
 * mediation, co-parent plans).
 *
 * Overrides are shared with the kids' /student calendar via the
 * `parent_overrides` KV under client_id="mna", so changes here flow through
 * to Marissa & Kyle's views automatically.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { getParentForDate } from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';

type Parent = 'mom' | 'dad';
type OverrideValue = Parent | 'clear';
type Overrides = Record<string, OverrideValue>;
type View = 'month' | 'year' | 'school';

// ── Paper theme (calendar only) ─────────────────────────────────────────
const PAPER = {
  bg:        '#ffffff',
  text:      '#0b1220',
  mute:      '#5b6472',
  rule:      '#dde3eb',
  ruleSoft:  '#eef2f7',
  mom:       '#1d4ed8',          // blue-700
  momFill:   '#dbe6ff',
  momText:   '#1e3a8a',
  dad:       '#0f172a',          // slate-900
  dadFill:   '#e2e8f0',
  dadText:   '#0f172a',
  today:     '#2563eb',
  brand:     '#1d4ed8',
};

// ── Helpers ──────────────────────────────────────────────────────────────
function isoFor(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return isoFor(d.getFullYear(), d.getMonth(), d.getDate());
}
function fmtLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
function custodyFor(iso: string, overrides: Overrides): Parent {
  const o = overrides[iso];
  if (o === 'mom' || o === 'dad') return o;
  return getParentForDate(new Date(`${iso}T12:00:00`)).who as Parent;
}
function overnightsForRange(start: string, end: string, overrides: Overrides) {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  let mom = 0, dad = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const iso = isoFor(d.getFullYear(), d.getMonth(), d.getDate());
    const who = custodyFor(iso, overrides);
    if (who === 'mom') mom++; else dad++;
  }
  return { mom, dad, total: mom + dad };
}
function overnightsForYear(year: number, overrides: Overrides) {
  return overnightsForRange(`${year}-01-01`, `${year}-12-31`, overrides);
}
function overnightsForMonth(year: number, month: number, overrides: Overrides) {
  const last = new Date(year, month + 1, 0).getDate();
  return overnightsForRange(isoFor(year, month, 1), isoFor(year, month, last), overrides);
}
function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((n / total) * 1000) / 10}%`;
}
function findHandoffs(start: string, end: string, overrides: Overrides): { date: string; from: Parent; to: Parent }[] {
  const out: { date: string; from: Parent; to: Parent }[] = [];
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  let prevWho: Parent | null = null;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const iso = isoFor(d.getFullYear(), d.getMonth(), d.getDate());
    const who = custodyFor(iso, overrides);
    if (prevWho && prevWho !== who) out.push({ date: iso, from: prevWho, to: who });
    prevWho = who;
  }
  return out;
}

/** A "pickup day" = first day with a new parent (custody changed overnight). */
function isPickupDay(iso: string, overrides: Overrides): boolean {
  const d = new Date(`${iso}T12:00:00`);
  const prev = new Date(d);
  prev.setDate(d.getDate() - 1);
  const prevIso = isoFor(prev.getFullYear(), prev.getMonth(), prev.getDate());
  return custodyFor(prevIso, overrides) !== custodyFor(iso, overrides);
}

/** School year = June 1, Y → May 31, Y+1 (12 full months / 365 days).
 *  Return the June-anchor year for a given date. */
function getSchoolYearStartYear(d: Date = new Date()): number {
  const y = d.getFullYear();
  const m = d.getMonth(); // June = 5
  return m >= 5 ? y : y - 1;
}

/** 12 months June startYear → May startYear+1, inclusive. */
function schoolMonths(startYear: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const total = 5 + i; // June = 5
    out.push({ year: startYear + Math.floor(total / 12), month: total % 12 });
  }
  return out;
}

function overnightsForSchoolYear(startYear: number, overrides: Overrides) {
  return overnightsForRange(`${startYear}-06-01`, `${startYear + 1}-05-31`, overrides);
}

// ════════════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════════════
export default function PersonalPage() {
  const [email, setEmail] = useState('');
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [overrides, setOverrides] = useState<Overrides>({});
  const [view, setView] = useState<View>('month');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [schoolStartYear, setSchoolStartYear] = useState(getSchoolYearStartYear(now));

  const todayStr = todayIso();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState(todayStr);
  const [bulkEnd, setBulkEnd] = useState(todayStr);
  const [bulkWho, setBulkWho] = useState<'mom' | 'dad' | 'reset'>('mom');

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const e = user?.email || '';
      setEmail(e);
      setAuthorized(isMNAStaff(e));

      try {
        const r = await fetch('/api/client-kv?clientId=mna&key=parent_overrides');
        const d = await r.json();
        if (d.value && typeof d.value === 'object') setOverrides(d.value);
      } catch {}
    })();
  }, []);

  async function saveOverrides(next: Overrides) {
    setOverrides(next);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', key: 'parent_overrides', value: next }),
    }).catch(() => {});
  }

  function cycleDay(iso: string) {
    const cur = overrides[iso];
    const next: Overrides = { ...overrides };
    if (!cur) next[iso] = 'mom';
    else if (cur === 'mom') next[iso] = 'dad';
    else if (cur === 'dad') next[iso] = 'clear';
    else delete next[iso];
    saveOverrides(next);
  }

  function applyBulk() {
    if (!bulkStart || !bulkEnd || bulkStart > bulkEnd) return;
    const next: Overrides = { ...overrides };
    const s = new Date(`${bulkStart}T12:00:00`);
    const e = new Date(`${bulkEnd}T12:00:00`);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = isoFor(d.getFullYear(), d.getMonth(), d.getDate());
      if (bulkWho === 'reset') delete next[iso];
      else next[iso] = bulkWho;
    }
    saveOverrides(next);
    setBulkOpen(false);
  }

  function clearAllOverrides() {
    if (!confirm('Reset every day back to the default rule? This cannot be undone.')) return;
    saveOverrides({});
  }

  /** Co-parent share: print without overnight counts or builder UI. */
  function printForCoParent() {
    document.body.classList.add('share-mode');
    setTimeout(() => {
      window.print();
      // Clear after the print dialog closes
      setTimeout(() => document.body.classList.remove('share-mode'), 500);
    }, 50);
  }

  const monthStats   = useMemo(() => overnightsForMonth(year, month, overrides), [year, month, overrides]);
  const yearStats    = useMemo(() => overnightsForYear(year, overrides), [year, overrides]);
  const ytdStats     = useMemo(() => overnightsForRange(`${year}-01-01`, todayStr < `${year}-12-31` ? todayStr : `${year}-12-31`, overrides), [year, todayStr, overrides]);
  const schoolStats  = useMemo(() => overnightsForSchoolYear(schoolStartYear, overrides), [schoolStartYear, overrides]);

  const handoffs = useMemo(() => {
    let start: string, end: string;
    if (view === 'month') {
      start = isoFor(year, month, 1);
      const last = new Date(year, month + 1, 0).getDate();
      end = isoFor(year, month, last);
    } else if (view === 'school') {
      start = `${schoolStartYear}-05-01`;
      end = `${schoolStartYear + 1}-05-31`;
    } else {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    }
    return findHandoffs(start, end, overrides);
  }, [view, year, month, schoolStartYear, overrides]);

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">Loading…</div>;
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3">
        <div className="text-white text-lg font-bold">Not available</div>
        <p className="text-white/60 text-sm max-w-md">
          This is a private personal section.
        </p>
      </div>
    );
  }

  const dateLong = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto px-4 md:px-6 py-6">

      {/* ── AESTHETIC HEADER ───────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-cyan-300">Personal · Private</div>
          <h1 className="text-[28px] md:text-[32px] font-extrabold text-white mt-1 leading-none tracking-tight">
            Custody Calendar
          </h1>
          <div className="text-white/50 text-[12px] mt-1.5">{dateLong}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print">
          <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {(['month', 'year', 'school'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${view === v ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                style={view === v ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' } : undefined}>
                {v === 'school' ? 'School Year' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white/70 hover:text-white flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>print</span>
            Print
          </button>
          <button onClick={printForCoParent}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
            title="One-page schedule with no overnight counts — clean view to send the other parent for approval">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
            Send to Co-Parent
          </button>
        </div>
      </div>

      {/* ── AESTHETIC STAT CARDS (dark) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overnights-block">
        {view === 'school' ? (
          <>
            <DarkStat
              label={`School Year · Jun ${schoolStartYear} → May ${schoolStartYear + 1}`}
              mom={schoolStats.mom} dad={schoolStats.dad} total={schoolStats.total}
              highlight
            />
            <DarkStat label={`${year} · Year-to-Date`} mom={ytdStats.mom} dad={ytdStats.dad} total={ytdStats.total} />
            <DarkStat label={`${schoolStartYear + 1} · Calendar-Year Projected`} mom={overnightsForYear(schoolStartYear + 1, overrides).mom} dad={overnightsForYear(schoolStartYear + 1, overrides).dad} total={overnightsForYear(schoolStartYear + 1, overrides).total} />
          </>
        ) : (
          <>
            <DarkStat
              label={view === 'month' ? new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : `${year} · Full Year`}
              mom={view === 'month' ? monthStats.mom : yearStats.mom}
              dad={view === 'month' ? monthStats.dad : yearStats.dad}
              total={view === 'month' ? monthStats.total : yearStats.total}
              highlight
            />
            <DarkStat label={`${year} · Year-to-Date`} mom={ytdStats.mom} dad={ytdStats.dad} total={ytdStats.total} />
            <DarkStat label={`${year} · Projected`} mom={yearStats.mom} dad={yearStats.dad} total={yearStats.total} />
          </>
        )}
      </div>

      {/* ── AESTHETIC BUILDER PANEL ────────────────────────────────── */}
      <div className="rounded-2xl p-4 no-print" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[13px] font-bold text-white">Build your schedule</div>
            <div className="text-[11px] text-white/45 mt-0.5">
              Tap any day on the calendar to cycle Mom → Dad → Default rule. Or bulk-set a date range below.
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBulkOpen(v => !v)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
              {bulkOpen ? 'Close' : 'Bulk set range'}
            </button>
            <button onClick={clearAllOverrides}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white/70 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Reset all
            </button>
          </div>
        </div>

        {bulkOpen && (
          <div className="mt-3 pt-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" style={{ borderTop: '1px dashed rgba(255,255,255,0.07)' }}>
            <DarkField label="From">
              <input type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className={darkInputCls} />
            </DarkField>
            <DarkField label="To">
              <input type="date" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className={darkInputCls} />
            </DarkField>
            <DarkField label="Assign to">
              <div className="flex gap-1">
                {(['mom','dad','reset'] as const).map(k => (
                  <button key={k} onClick={() => setBulkWho(k)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                      bulkWho === k ? 'text-white' : 'text-white/55 hover:text-white/80'
                    }`}
                    style={bulkWho === k
                      ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {k === 'reset' ? 'Default' : k}
                  </button>
                ))}
              </div>
            </DarkField>
            <button onClick={applyBulk}
              className="text-[12px] font-bold px-4 py-2 rounded-lg text-white h-9"
              style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
              Apply
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── FORMAL CALENDAR (white paper card) ────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div id="custody-paper" style={{
        background: PAPER.bg, color: PAPER.text,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}>
        {view === 'month' ? (
          <PaperMonthView
            year={year} month={month} overrides={overrides}
            onDayClick={cycleDay} setYear={setYear} setMonth={setMonth}
          />
        ) : view === 'year' ? (
          <PaperYearView
            year={year} overrides={overrides}
            onYearChange={setYear}
            onPickMonth={(m) => { setMonth(m); setView('month'); }}
          />
        ) : (
          <PaperSchoolView
            startYear={schoolStartYear} overrides={overrides}
            onStartYearChange={setSchoolStartYear}
            onPickMonth={(y, m) => { setYear(y); setMonth(m); setView('month'); }}
          />
        )}
      </div>

      {/* ── HANDOFF LIST (aesthetic dark) ──────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-[15px] font-extrabold text-white">
            Handoff dates · {
              view === 'month'  ? new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              : view === 'school' ? `Jun ${schoolStartYear} → May ${schoolStartYear + 1}`
              : year
            }
          </h2>
          <span className="text-[11px] text-white/40">{handoffs.length} handoff{handoffs.length === 1 ? '' : 's'}</span>
        </div>
        {handoffs.length === 0 ? (
          <div className="rounded-xl px-4 py-6 text-center text-[12px] text-white/40"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            No handoffs in this range.
          </div>
        ) : (
          <ol className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', listStyle: 'none', margin: 0, padding: 0 }}>
            {handoffs.map((h, i) => (
              <li key={h.date} className="grid items-center gap-3 px-4 py-2.5 text-[12.5px] text-white"
                style={{ gridTemplateColumns: '24px 1fr auto', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] text-white/35 tabular-nums">{i + 1}</span>
                <span>
                  <span className="font-bold">{fmtShort(h.date)}</span>
                  <span className="text-white/45"> · {fmtLong(h.date)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <DarkParentChip who={h.from} muted />
                  <span className="text-white/30">→</span>
                  <DarkParentChip who={h.to} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Print-mode: hide page chrome, expand the paper card.
          Share-mode (Send to Co-Parent) additionally hides overnight counts. */}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          aside, .no-print { display: none !important; }
          #custody-paper { box-shadow: none !important; border-radius: 0 !important; }
        }
        body.share-mode .overnights-block { display: none !important; }
        @media print {
          body.share-mode .overnights-block { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// AESTHETIC DARK PIECES
// ════════════════════════════════════════════════════════════════════════

const darkInputCls =
  "w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30";

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</span>
      {children}
    </label>
  );
}

function DarkStat({ label, mom, dad, total, highlight }: { label: string; mom: number; dad: number; total: number; highlight?: boolean }) {
  return (
    <div className="rounded-2xl p-4"
      style={{
        background: highlight ? 'linear-gradient(135deg, rgba(12,109,164,0.18), rgba(74,184,206,0.10))' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? 'rgba(74,184,206,0.25)' : 'rgba(255,255,255,0.07)'}`,
      }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</div>
      <div className="flex items-baseline gap-4 mt-2.5">
        <div>
          <div className="text-[26px] font-extrabold text-cyan-300 tabular-nums leading-none">{mom}</div>
          <div className="text-[10.5px] text-white/45 mt-1">Mom · {pct(mom, total)}</div>
        </div>
        <div className="w-px h-7" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div>
          <div className="text-[26px] font-extrabold text-white tabular-nums leading-none">{dad}</div>
          <div className="text-[10.5px] text-white/45 mt-1">Dad · {pct(dad, total)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[13px] font-bold text-white tabular-nums leading-none">{total}</div>
          <div className="text-[10.5px] text-white/40 mt-1">overnights</div>
        </div>
      </div>
    </div>
  );
}

function DarkParentChip({ who, muted }: { who: Parent; muted?: boolean }) {
  const isMom = who === 'mom';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
      style={{
        background: isMom ? 'rgba(74,184,206,0.15)' : 'rgba(255,255,255,0.08)',
        color: isMom ? '#67e8f9' : '#e2e8f0',
        opacity: muted ? 0.65 : 1,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: isMom ? '#22d3ee' : '#e2e8f0' }} />
      {isMom ? 'Mom' : 'Dad'}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PAPER (formal white/blue/black) CALENDAR
// ════════════════════════════════════════════════════════════════════════

function PaperMonthView({
  year, month, overrides, onDayClick, setYear, setMonth,
}: {
  year: number; month: number; overrides: Overrides;
  onDayClick: (iso: string) => void;
  setYear: (y: number) => void; setMonth: (m: number) => void;
}) {
  const monthName = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const today = todayIso();
  const stats = overnightsForMonth(year, month, overrides);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }
  function jumpToday() { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }

  return (
    <div>
      {/* Title bar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${PAPER.rule}`, background: '#f8fafc',
      }}>
        <button onClick={prevMonth} style={paperNavBtn} aria-label="Previous month">‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: PAPER.text, letterSpacing: '-0.01em' }}>{monthName}</div>
          <button onClick={jumpToday} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
            background: '#fff', color: PAPER.text, border: `1px solid ${PAPER.rule}`, cursor: 'pointer',
          }}>Today</button>
        </div>
        <button onClick={nextMonth} style={paperNavBtn} aria-label="Next month">›</button>
      </div>

      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${PAPER.ruleSoft}` }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            textAlign: 'center', padding: '10px 0', fontSize: 10.5, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: PAPER.mute,
          }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} style={{
              aspectRatio: '1.05 / 1',
              borderTop: `1px solid ${PAPER.ruleSoft}`,
              borderLeft: i % 7 === 0 ? 'none' : `1px solid ${PAPER.ruleSoft}`,
              background: '#fafbfd',
            }} />;
          }
          const iso = isoFor(year, month, day);
          const who = custodyFor(iso, overrides);
          const pickup = isPickupDay(iso, overrides);
          const isToday = iso === today;
          const fill = who === 'mom' ? PAPER.momFill : PAPER.dadFill;
          const bar = who === 'mom' ? PAPER.mom : PAPER.dad;
          const label = who === 'mom' ? 'M' : 'D';
          const labelColor = who === 'mom' ? PAPER.momText : PAPER.dadText;
          return (
            <button key={iso}
              onClick={() => onDayClick(iso)}
              title={`${fmtLong(iso)} · ${who === 'mom' ? 'Mom' : 'Dad'}${pickup ? ' · pickup day' : ''}`}
              style={{
                aspectRatio: '1.05 / 1',
                borderTop: `1px solid ${PAPER.ruleSoft}`,
                borderLeft: i % 7 === 0 ? 'none' : `1px solid ${PAPER.ruleSoft}`,
                borderRight: 'none', borderBottom: 'none',
                background: fill, position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '8px 10px',
                cursor: 'pointer', font: 'inherit', color: PAPER.text, textAlign: 'left',
                outline: isToday ? `2px solid ${PAPER.today}` : 'none',
                outlineOffset: '-2px',
              }}>
              <span style={{ position: 'absolute', top: 6, bottom: 6, left: 0, width: 3, background: bar, borderRadius: '0 2px 2px 0' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, paddingLeft: 6 }}>{day}</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: labelColor, paddingLeft: 6 }}>{label}</span>
              {pickup && (
                <span title="Pickup day" style={{
                  position: 'absolute', top: 8, right: 8, width: 6, height: 6,
                  borderRadius: '50%', background: PAPER.brand,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer totals strip — included so it's part of the screenshot */}
      <div className="overnights-block" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderTop: `1px solid ${PAPER.rule}`, fontSize: 13, color: PAPER.text,
      }}>
        <div style={{ padding: '12px 16px', borderRight: `1px solid ${PAPER.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.mom, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Mom</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{stats.mom} · {pct(stats.mom, stats.total)}</span>
        </div>
        <div style={{ padding: '12px 16px', borderRight: `1px solid ${PAPER.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.dad, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Dad</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{stats.dad} · {pct(stats.dad, stats.total)}</span>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, color: PAPER.mute }}>
          <span>Total overnights</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: PAPER.text }}>{stats.total}</span>
        </div>
      </div>
    </div>
  );
}

function PaperYearView({
  year, overrides, onYearChange, onPickMonth,
}: {
  year: number; overrides: Overrides;
  onYearChange: (y: number) => void;
  onPickMonth: (m: number) => void;
}) {
  const stats = overnightsForYear(year, overrides);
  return (
    <div style={{ padding: '16px 18px 20px' }}>
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
      }}>
        <button onClick={() => onYearChange(year - 1)} style={paperNavBtn}>‹</button>
        <div style={{ fontSize: 22, fontWeight: 800, color: PAPER.text, letterSpacing: '-0.01em' }}>{year}</div>
        <button onClick={() => onYearChange(year + 1)} style={paperNavBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonth key={m} year={year} month={m} overrides={overrides} onClick={() => onPickMonth(m)} />
        ))}
      </div>
      <div className="overnights-block" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 18,
        borderTop: `1px solid ${PAPER.rule}`, paddingTop: 14, fontSize: 13, color: PAPER.text,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.mom, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Mom</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', paddingRight: 14 }}>{stats.mom} · {pct(stats.mom, stats.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.dad, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Dad</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', paddingRight: 14 }}>{stats.dad} · {pct(stats.dad, stats.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: PAPER.mute }}>
          <span>Total overnights</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: PAPER.text }}>{stats.total}</span>
        </div>
      </div>
    </div>
  );
}

function PaperSchoolView({
  startYear, overrides, onStartYearChange, onPickMonth,
}: {
  startYear: number; overrides: Overrides;
  onStartYearChange: (y: number) => void;
  onPickMonth: (year: number, month: number) => void;
}) {
  const stats = overnightsForSchoolYear(startYear, overrides);
  const months = schoolMonths(startYear);
  const title = `School Year · Jun ${startYear} → May ${startYear + 1}`;

  return (
    <div style={{ padding: '16px 18px 20px' }}>
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
      }}>
        <button onClick={() => onStartYearChange(startYear - 1)} style={paperNavBtn} title="Previous school year">‹</button>
        <div style={{ fontSize: 18, fontWeight: 800, color: PAPER.text, letterSpacing: '-0.01em', textAlign: 'center' }}>
          {title}
        </div>
        <button onClick={() => onStartYearChange(startYear + 1)} style={paperNavBtn} title="Next school year">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {months.map(({ year: y, month: m }) => (
          <MiniMonth key={`${y}-${m}`} year={y} month={m} overrides={overrides} onClick={() => onPickMonth(y, m)} />
        ))}
      </div>
      <div className="overnights-block" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 18,
        borderTop: `1px solid ${PAPER.rule}`, paddingTop: 14, fontSize: 13, color: PAPER.text,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.mom, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Mom</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', paddingRight: 14 }}>{stats.mom} · {pct(stats.mom, stats.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, background: PAPER.dad, borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Dad</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', paddingRight: 14 }}>{stats.dad} · {pct(stats.dad, stats.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: PAPER.mute }}>
          <span>Total overnights · school year</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: PAPER.text }}>{stats.total}</span>
        </div>
      </div>
    </div>
  );
}

function MiniMonth({
  year, month, overrides, onClick,
}: { year: number; month: number; overrides: Overrides; onClick: () => void }) {
  const monthName = new Date(year, month).toLocaleDateString(undefined, { month: 'long' });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const today = todayIso();
  const stats = overnightsForMonth(year, month, overrides);

  return (
    <div onClick={onClick}
      style={{
        border: `1px solid ${PAPER.rule}`, borderRadius: 10, padding: 12, background: PAPER.bg,
        cursor: 'pointer', transition: 'box-shadow 120ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(29,78,216,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: PAPER.text }}>{monthName}</div>
        <div className="overnights-block" style={{ fontSize: 10.5, color: PAPER.mute, fontVariantNumeric: 'tabular-nums' }}>
          M {stats.mom} · D {stats.dad}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 8.5, fontWeight: 700, color: PAPER.mute, textAlign: 'center' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} style={{ aspectRatio: '1/1' }} />;
          const iso = isoFor(year, month, day);
          const who = custodyFor(iso, overrides);
          const pickup = isPickupDay(iso, overrides);
          const isToday = iso === today;
          const fill = who === 'mom' ? PAPER.momFill : PAPER.dadFill;
          return (
            <div key={iso} style={{
              aspectRatio: '1/1', borderRadius: 3, background: fill,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, position: 'relative',
              color: who === 'mom' ? PAPER.momText : PAPER.dadText,
              outline: isToday ? `1.5px solid ${PAPER.today}` : 'none',
              outlineOffset: '-1.5px',
            }}>
              {day}
              {pickup && <span style={{ position: 'absolute', top: 1, right: 1, width: 3, height: 3, borderRadius: '50%', background: PAPER.brand }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const paperNavBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: `1px solid ${PAPER.rule}`,
  background: '#fff', color: PAPER.text, fontSize: 20, lineHeight: 1, cursor: 'pointer', fontWeight: 800,
};
