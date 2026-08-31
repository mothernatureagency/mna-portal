'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

export const dynamic = 'force-dynamic';

type SpecialStatus = 'drafting' | 'pending_review' | 'approved' | 'denied' | 'changes_requested';

type Special = {
  id: string;
  month: string;
  name: string;
  offer: string | null;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  terms: string | null;
  status: SpecialStatus;
  client_comments: string | null;
  mna_comments: string | null;
};

const STATUS_STYLES: Record<SpecialStatus, { label: string; bg: string; text: string; dot: string }> = {
  drafting:          { label: 'Being drafted',      bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', dot: '#9ca3af' },
  pending_review:    { label: 'Needs your call',    bg: 'rgba(251,191,36,0.18)',  text: '#fbbf24',               dot: '#f59e0b' },
  approved:          { label: 'Approved',           bg: 'rgba(52,211,153,0.18)',  text: '#34d399',               dot: '#10b981' },
  denied:            { label: 'Not this month',     bg: 'rgba(248,113,113,0.18)', text: '#f87171',               dot: '#ef4444' },
  changes_requested: { label: 'Changes requested',  bg: 'rgba(251,113,133,0.18)', text: '#fb7185',               dot: '#f43f5e' },
};

function monthLabel(month: string) {
  try {
    return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch { return month; }
}

function fmtRange(s: Special) {
  if (!s.starts_on && !s.ends_on) return null;
  const f = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (s.starts_on && s.ends_on) return `${f(s.starts_on)} – ${f(s.ends_on)}`;
  return s.starts_on ? `from ${f(s.starts_on)}` : `until ${f(s.ends_on!)}`;
}

export default function ClientSpecialsPage() {
  const { client } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;

  const [items, setItems] = useState<Special[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/specials?clientId=${encodeURIComponent(client.id)}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch { setItems([]); }
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  // Newest month first — the one they need to act on is usually the furthest out.
  const byMonth = useMemo(() => {
    const groups = new Map<string, Special[]>();
    for (const s of items) {
      if (!groups.has(s.month)) groups.set(s.month, []);
      groups.get(s.month)!.push(s);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  const waiting = items.filter((s) => s.status === 'pending_review').length;

  async function decide(id: string, status: SpecialStatus, note?: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/specials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(note !== undefined ? { client_comments: note || null } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save that');
      setItems((prev) => prev.map((s) => (s.id === id ? data.item : s)));
      setCommentFor(null);
      setComment('');
    } catch (e: any) {
      alert(e.message || 'Could not save that');
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold text-white tracking-tight">Monthly Specials</h1>
        <p className="text-white/60 text-[13px] mt-1 max-w-2xl">
          The offers we&apos;re planning to run for you. Approve the ones you want, tell us what to change, or
          take one off the table — we build the month&apos;s content around whatever you approve here.
        </p>
      </div>

      {waiting > 0 && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fbbf24' }}>pending_actions</span>
          <div className="text-[13px] text-amber-100">
            <span className="font-bold">{waiting} special{waiting === 1 ? '' : 's'}</span> waiting on you.
          </div>
        </div>
      )}

      {loading && <div className="text-white/50 text-sm">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined text-white/20" style={{ fontSize: 42 }}>local_offer</span>
          <div className="text-white/70 font-semibold mt-2">Nothing to review yet</div>
          <div className="text-white/40 text-[13px] mt-1">We&apos;ll put next month&apos;s specials here as soon as they&apos;re drafted.</div>
        </div>
      )}

      {byMonth.map(([month, specials]) => (
        <div key={month} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[17px] font-bold text-white">{monthLabel(month)}</h2>
            <span className="text-[12px] text-white/40">
              {specials.filter((s) => s.status === 'approved').length} of {specials.length} approved
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {specials.map((s) => {
              const st = STATUS_STYLES[s.status] || STATUS_STYLES.pending_review;
              const range = fmtRange(s);
              const decided = s.status === 'approved' || s.status === 'denied';
              return (
                <div key={s.id} className="glass-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white font-bold text-[15px] leading-tight">{s.name}</div>
                      {s.offer && <div className="text-[14px] font-bold mt-0.5" style={{ color: gradientTo }}>{s.offer}</div>}
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1.5"
                      style={{ background: st.bg, color: st.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                      {st.label}
                    </span>
                  </div>

                  {(range || s.terms) && (
                    <div className="flex gap-3 flex-wrap text-[11px] text-white/50">
                      {range && (
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_month</span>{range}
                        </span>
                      )}
                      {s.terms && (
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>{s.terms}
                        </span>
                      )}
                    </div>
                  )}

                  {s.description && <div className="text-[12.5px] text-white/65 leading-relaxed">{s.description}</div>}

                  {s.mna_comments && (
                    <div className="text-[12px] bg-white/5 border border-white/10 rounded-lg p-2.5">
                      <div className="text-[10px] uppercase font-bold text-white/35 mb-0.5">Note from us</div>
                      <div className="text-white/70 whitespace-pre-wrap">{s.mna_comments}</div>
                    </div>
                  )}

                  {s.client_comments && (
                    <div className="text-[12px] rounded-lg p-2.5" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)' }}>
                      <div className="text-[10px] uppercase font-bold text-rose-300/80 mb-0.5">What you asked for</div>
                      <div className="text-rose-200 whitespace-pre-wrap">{s.client_comments}</div>
                    </div>
                  )}

                  {/* Decide */}
                  {commentFor === s.id ? (
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="What should we change? Price, dates, wording…"
                        className="w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(s.id, 'changes_requested', comment)}
                          disabled={busyId === s.id || !comment.trim()}
                          className="text-[12px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#e11d48,#fb7185)' }}
                        >
                          Send changes
                        </button>
                        <button
                          onClick={() => { setCommentFor(null); setComment(''); }}
                          className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/60 border border-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap pt-2 mt-auto border-t border-white/5">
                      <button
                        onClick={() => decide(s.id, 'approved')}
                        disabled={busyId === s.id || s.status === 'approved'}
                        className="flex-1 min-w-[110px] text-[12px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-35 inline-flex items-center justify-center gap-1.5"
                        style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
                        {s.status === 'approved' ? 'Approved' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setCommentFor(s.id); setComment(s.client_comments || ''); }}
                        disabled={busyId === s.id}
                        className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/70 border border-white/15 hover:bg-white/10 disabled:opacity-40"
                      >
                        Change
                      </button>
                      <button
                        onClick={() => { if (confirm(`Take "${s.name}" off the plan for ${monthLabel(s.month)}?`)) decide(s.id, 'denied'); }}
                        disabled={busyId === s.id || s.status === 'denied'}
                        className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/45 border border-white/10 hover:text-rose-300 disabled:opacity-35"
                      >
                        {s.status === 'denied' ? 'Removed' : 'Skip it'}
                      </button>
                    </div>
                  )}

                  {decided && (
                    <div className="text-[11px] text-white/35">
                      You can still change your mind — just pick a different option above.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
