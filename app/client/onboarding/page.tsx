'use client';

/**
 * Client portal — Onboarding (RFAD).
 *
 * The Request for Access & Deliverables checklist. The client works through
 * it at their own pace; each tick hands the follow-up to whoever owns it on
 * our side, so nothing waits on someone noticing it was done.
 */

import { useCallback, useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';
import PortalSection from '@/components/client-portal/PortalSection';
import {
  RFAD_OWNERS,
  RFAD_SECTIONS,
  type RfadState,
} from '@/lib/rfad';

export default function ClientOnboardingPage() {
  const { client, isStaffPreview } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;

  const [state, setState] = useState<RfadState | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, pct: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/rfad?clientId=${encodeURIComponent(client.id)}`)
      .then((r) => r.json())
      .then((d) => { if (d?.state) { setState(d.state); setProgress(d.progress); } })
      .catch(() => setState({ items: {}, dispatched: [] }));
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  async function update(itemId: string, patch: { done?: boolean; value?: string }) {
    setBusy(itemId);
    try {
      const r = await fetch('/api/rfad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, itemId, ...patch }),
      });
      const d = await r.json();
      if (r.ok) {
        setState(d.state);
        setProgress(d.progress);
        if (d.assignedTo) {
          setJustAssigned(d.assignedTo);
          setTimeout(() => setJustAssigned(null), 2600);
        }
      }
    } catch { /* leave the box as-is on failure */ }
    finally { setBusy(null); }
  }

  const complete = progress.total > 0 && progress.done === progress.total;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Onboarding</h1>
          <span
            className="text-[15px] font-medium ml-1"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {client.name}
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Request for Access &amp; Deliverables — tick each item as you complete it. We pick up the rest.
        </p>
      </div>

      <PortalSection id="onboarding.rfad">
        <div className="space-y-5">
          {/* Progress */}
          <div className="glass-card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-bold text-white">
                {complete ? 'All set — thank you!' : `${progress.done} of ${progress.total} complete`}
              </div>
              <div className="text-[12px] font-black text-white">{progress.pct}%</div>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress.pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
              />
            </div>
            {justAssigned && (
              <div className="text-[11px] text-emerald-300 mt-2">
                Handed to your {Object.values(RFAD_OWNERS).find((o) => o.email === justAssigned)?.label || 'team'} — they&apos;ll take it from here.
              </div>
            )}
            {isStaffPreview && (
              <div className="text-[10.5px] text-white/40 mt-2">
                Staff view — each tick files a task for Social, Manager or Ads in the Task Manager.
              </div>
            )}
          </div>

          {state === null ? (
            <div className="glass-card p-8 text-center text-[12px] text-white/50">Loading your checklist…</div>
          ) : (
            RFAD_SECTIONS.map((section) => {
              const doneInSection = section.items.filter((i) => state.items[i.id]?.done).length;
              return (
                <div key={section.id} className="glass-card p-4 md:p-6">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-[15px] font-bold text-white">{section.title}</div>
                    <span className="text-[11px] font-semibold text-white/45 shrink-0">
                      {doneInSection}/{section.items.length}
                    </span>
                  </div>
                  {section.note && <p className="text-[11px] text-white/45 mb-3">{section.note}</p>}

                  <div className="space-y-2 mt-3">
                    {section.items.map((item) => {
                      const st = state.items[item.id] || {};
                      const owner = RFAD_OWNERS[item.owner];
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl transition-colors"
                          style={{
                            background: st.done ? 'rgba(16,185,129,.10)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${st.done ? 'rgba(16,185,129,.28)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              disabled={busy === item.id}
                              onClick={() => update(item.id, { done: !st.done })}
                              aria-label={st.done ? `Mark ${item.label} not done` : `Mark ${item.label} done`}
                              className="mt-0.5 w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors disabled:opacity-50"
                              style={{
                                background: st.done ? '#10b981' : 'transparent',
                                border: st.done ? 'none' : '1.5px solid rgba(255,255,255,.35)',
                              }}
                            >
                              {st.done && (
                                <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>check</span>
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[13px] font-semibold ${st.done ? 'text-white/60 line-through' : 'text-white'}`}>
                                  {item.label}
                                </span>
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0"
                                  title={`${owner.label} — ${owner.blurb}`}
                                >
                                  {owner.label}
                                </span>
                              </div>
                              {item.detail && (
                                <div className="text-[11.5px] text-white/55 mt-1 leading-relaxed">{item.detail}</div>
                              )}
                              {item.field && (
                                <input
                                  defaultValue={st.value || ''}
                                  placeholder={item.field.placeholder || item.field.label}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== (st.value || '')) update(item.id, { value: v });
                                  }}
                                  className="w-full mt-2 px-2.5 py-1.5 rounded-lg text-white text-[12px] placeholder:text-white/35 outline-none"
                                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PortalSection>
    </div>
  );
}
