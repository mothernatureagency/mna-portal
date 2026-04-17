'use client';

/**
 * Contractor Workspace — for construction / remodel / new-build clients.
 *
 * Sections:
 *   1. Header (business + trade)
 *   2. P&L summary across all jobs
 *   3. Active Jobs grid — each job has revenue, costs, margin, status
 *   4. Job detail modal — edit costs, status, notes; view invoices
 *   5. Schedule (next 30 days of job-site events)
 *   6. Recent Notes feed
 *
 * Storage: jobs + notes are stored in client_kv keyed off the contractor's
 * email (no new tables needed). Schedule events use the existing
 * schedule_events table. Invoices use the existing invoices table.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  getContractorByEmail,
  TRADE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  jobPnL,
  type Contractor,
  type Job,
  type JobStatus,
} from '@/lib/contractors';

// ── Types ───────────────────────────────────────────────────────────
type ScheduleEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  description: string | null;
};

// ── Helpers ─────────────────────────────────────────────────────────
function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_JOB: Omit<Job, 'id' | 'createdAt'> = {
  name: '',
  address: '',
  status: 'bidding',
  contractAmount: 0,
  invoicedToDate: 0,
  paidToDate: 0,
  materialsCost: 0,
  laborCost: 0,
  startDate: '',
  targetCompletion: '',
  notes: '',
};

// ── Component ───────────────────────────────────────────────────────
export default function ContractorDashboard() {
  const [email, setEmail] = useState('');
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);

  // ── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setEmail(userEmail);
      const c = getContractorByEmail(userEmail);
      setContractor(c);
      if (!c) { setLoading(false); return; }

      const todayStr = new Date().toISOString().slice(0, 10);
      const futureStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      await Promise.all([
        // Jobs live in client_kv keyed by contractor email
        fetch(`/api/client-kv?clientId=${encodeURIComponent(userEmail)}&key=jobs`)
          .then((r) => r.json())
          .then((d) => setJobs(Array.isArray(d.value) ? d.value : []))
          .catch(() => {}),
        fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${todayStr}&to=${futureStr}`)
          .then((r) => r.json())
          .then((d) => setEvents(d.events || []))
          .catch(() => {}),
      ]);
      setLoading(false);
    })();
  }, []);

  // ── Save jobs back to client_kv ─────────────────────────────────
  async function saveJobs(next: Job[]) {
    setJobs(next);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: email, key: 'jobs', value: next }),
    });
  }

  // ── P&L roll-up across all jobs ─────────────────────────────────
  const pnl = useMemo(() => {
    let revenue = 0, cost = 0, contracted = 0, paid = 0;
    let activeCount = 0;
    for (const j of jobs) {
      revenue += j.invoicedToDate;
      cost += j.materialsCost + j.laborCost;
      contracted += j.contractAmount;
      paid += j.paidToDate;
      if (j.status === 'active' || j.status === 'punch_list') activeCount++;
    }
    const grossProfit = revenue - cost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    return { revenue, cost, grossProfit, margin, contracted, paid, activeCount };
  }, [jobs]);

  // ── States ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">
        Loading your workspace…
      </div>
    );
  }
  if (!contractor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3">
        <div className="text-white text-lg font-bold">Contractor account not configured</div>
        <p className="text-white/60 text-sm max-w-md">
          Your email <span className="text-white">{email || '(none)'}</span> isn't recognized as a contractor.
          Ask Alexus to add you to the contractor directory.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)', backgroundAttachment: 'fixed' }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-bold">Contractor Workspace</div>
            <h1 className="text-[26px] font-extrabold mt-1">{contractor.business}</h1>
            <div className="text-white/60 text-sm">
              {contractor.name} · {TRADE_LABELS[contractor.trade]}{contractor.serviceArea ? ` · ${contractor.serviceArea}` : ''}
            </div>
          </div>
          <button
            onClick={async () => { await createSupabaseClient().auth.signOut(); window.location.href = '/login'; }}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Sign out
          </button>
        </div>

        {/* ── P&L SUMMARY ── */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 mb-2">P&L · All Jobs</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="Active Jobs" value={String(pnl.activeCount)} note={`${jobs.length} total`} color="#0ea5e9" />
            <KPI label="Revenue Invoiced" value={fmtUSD(pnl.revenue)} note={`${fmtUSD(pnl.contracted)} contracted`} color="#0c6da4" />
            <KPI label="Costs" value={fmtUSD(pnl.cost)} note="Materials + Labor" color="#f59e0b" />
            <KPI label="Gross Profit" value={fmtUSD(pnl.grossProfit)} note={`${pnl.margin.toFixed(1)}% margin`} color={pnl.grossProfit >= 0 ? '#10b981' : '#ef4444'} />
            <KPI label="Cash Collected" value={fmtUSD(pnl.paid)} note={`${fmtUSD(pnl.revenue - pnl.paid)} outstanding`} color="#a78bfa" />
          </div>
        </div>

        {/* ── ACTIVE JOBS ── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[14px] font-bold">Jobs</div>
              <div className="text-[11px] text-white/50">Click any job to update costs, status, and notes</div>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
            >
              + New Job
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-[12px] text-white/45 text-center py-8">
              No jobs yet. Click <span className="text-white">+ New Job</span> to add your first project.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jobs.map((j) => {
                const p = jobPnL(j);
                return (
                  <button
                    key={j.id}
                    onClick={() => setEditingJob(j)}
                    className="text-left rounded-xl p-4 transition hover:bg-white/[0.07]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderLeft: `3px solid ${JOB_STATUS_COLORS[j.status]}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{j.name || 'Untitled job'}</div>
                        {j.address && <div className="text-[10px] text-white/55 truncate">{j.address}</div>}
                      </div>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${JOB_STATUS_COLORS[j.status]}22`, color: JOB_STATUS_COLORS[j.status] }}
                      >
                        {JOB_STATUS_LABELS[j.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                      <Stat label="Revenue" value={fmtUSD(p.revenue)} />
                      <Stat label="Costs" value={fmtUSD(p.cost)} />
                      <Stat label="Profit" value={fmtUSD(p.grossProfit)} accent={p.grossProfit >= 0 ? '#10b981' : '#ef4444'} />
                    </div>
                    {p.revenue > 0 && (
                      <div className="mt-2 text-[10px] text-white/55 text-right">
                        Margin <span className={p.margin >= 15 ? 'text-emerald-400 font-bold' : p.margin >= 0 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>{p.margin.toFixed(1)}%</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SCHEDULE ── */}
        <div className="glass-card p-5">
          <div className="text-[14px] font-bold mb-3">Schedule (next 30 days)</div>
          {events.length === 0 ? (
            <div className="text-[12px] text-white/45 text-center py-6">No events scheduled.</div>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-[11px] text-white/55 w-24 shrink-0">{fmtDate(e.event_date)}</div>
                  <div className="text-[11px] text-white/70 w-28 shrink-0">{e.start_time || 'all day'}{e.end_time ? `–${e.end_time}` : ''}</div>
                  <div className="text-sm font-semibold flex-1 truncate">{e.title}</div>
                  <span className="text-[9px] uppercase tracking-wider text-white/40">{e.event_type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      {/* ── JOB EDIT/CREATE MODAL ── */}
      {(editingJob || creating) && (
        <JobModal
          job={editingJob || { ...EMPTY_JOB, id: uuid(), createdAt: new Date().toISOString() }}
          isNew={creating}
          onClose={() => { setEditingJob(null); setCreating(false); }}
          onSave={async (updated) => {
            const next = creating
              ? [updated, ...jobs]
              : jobs.map((j) => (j.id === updated.id ? updated : j));
            await saveJobs(next);
            setEditingJob(null);
            setCreating(false);
          }}
          onDelete={async (id) => {
            await saveJobs(jobs.filter((j) => j.id !== id));
            setEditingJob(null);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function KPI({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <div className="glass-card p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</div>
      <div className="text-[22px] font-black text-white leading-none mt-1.5">{value}</div>
      <div className="text-[10px] text-white/45 mt-1">{note}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg py-1.5" style={{ background: 'rgba(0,0,0,0.18)' }}>
      <div className="text-[8px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-[12px] font-bold mt-0.5" style={{ color: accent || '#fff' }}>{value}</div>
    </div>
  );
}

function JobModal({
  job,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  job: Job;
  isNew: boolean;
  onClose: () => void;
  onSave: (j: Job) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Job>(job);
  const p = jobPnL(draft);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="max-w-2xl w-full rounded-2xl my-8"
        style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-white font-bold">{isNew ? 'New Job' : 'Edit Job'}</div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-3 text-white">
          <Field label="Job name (e.g. Smith — Kitchen Remodel)">
            <input
              type="text" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] outline-none"
            />
          </Field>
          <Field label="Address">
            <input
              type="text" value={draft.address || ''}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as JobStatus })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] outline-none"
              >
                {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                  <option key={s} value={s} className="bg-slate-900">{JOB_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Contract amount">
              <NumInput value={draft.contractAmount} onChange={(v) => setDraft({ ...draft, contractAmount: v })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date" value={draft.startDate || ''}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] outline-none"
              />
            </Field>
            <Field label="Target completion">
              <input
                type="date" value={draft.targetCompletion || ''}
                onChange={(e) => setDraft({ ...draft, targetCompletion: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoiced to date">
              <NumInput value={draft.invoicedToDate} onChange={(v) => setDraft({ ...draft, invoicedToDate: v })} />
            </Field>
            <Field label="Paid to date">
              <NumInput value={draft.paidToDate} onChange={(v) => setDraft({ ...draft, paidToDate: v })} />
            </Field>
            <Field label="Materials cost">
              <NumInput value={draft.materialsCost} onChange={(v) => setDraft({ ...draft, materialsCost: v })} />
            </Field>
            <Field label="Labor cost (subs + crew)">
              <NumInput value={draft.laborCost} onChange={(v) => setDraft({ ...draft, laborCost: v })} />
            </Field>
          </div>

          <Field label="Notes (running thread — what's been done, what's next, change orders)">
            <textarea
              rows={5} value={draft.notes || ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-[12px] outline-none resize-none"
            />
          </Field>

          {/* Live P&L preview */}
          <div className="rounded-xl p-3 grid grid-cols-3 gap-2 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Stat label="Revenue" value={fmtUSD(p.revenue)} />
            <Stat label="Costs" value={fmtUSD(p.cost)} />
            <Stat label={`Profit · ${p.margin.toFixed(1)}%`} value={fmtUSD(p.grossProfit)} accent={p.grossProfit >= 0 ? '#10b981' : '#ef4444'} />
          </div>
        </div>

        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {!isNew && (
            <button
              onClick={() => { if (confirm('Delete this job? This cannot be undone.')) onDelete(draft.id); }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={!draft.name.trim()}
              className="text-[11px] font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
            >
              {isNew ? 'Create Job' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">{label}</div>
      {children}
    </label>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-lg bg-white/5 border border-white/15 overflow-hidden">
      <span className="px-2 text-white/50 text-[12px]">$</span>
      <input
        type="number" min="0" step="100" value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="flex-1 px-1 py-2 bg-transparent text-white text-[13px] outline-none"
      />
    </div>
  );
}
