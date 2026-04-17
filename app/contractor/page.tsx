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
import Link from 'next/link';
import {
  getContractorByEmail,
  CONTRACTORS,
  CONTRACTOR_AGENTS,
  TRADE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  jobPnL,
  SUPPLY_STATUS_LABELS,
  SUPPLY_STATUS_COLORS,
  type Contractor,
  type Job,
  type JobStatus,
  type SupplyItem,
  type SupplyStatus,
} from '@/lib/contractors';
import { isMNAStaff } from '@/lib/staff';

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
// Sample jobs shown to staff in preview mode so they can see the UI populated.
// Real contractors get an empty workspace + the placeholder hint.
const PREVIEW_JOBS: Job[] = [
  {
    id: 'preview-1',
    name: 'Smith — Kitchen Remodel',
    address: '142 Magnolia Dr, Niceville FL',
    status: 'active',
    contractAmount: 48000,
    invoicedToDate: 24000,
    paidToDate: 24000,
    materialsCost: 11200,
    laborCost: 7800,
    startDate: '2026-03-12',
    targetCompletion: '2026-05-20',
    notes: 'Cabinets installed. Countertop template scheduled for next Tuesday. Waiting on tile delivery.',
    createdAt: '2026-03-10T09:00:00Z',
  },
  {
    id: 'preview-2',
    name: 'Harper — Bathroom Renovation',
    address: '88 Bayshore Ln, Destin FL',
    status: 'punch_list',
    contractAmount: 22500,
    invoicedToDate: 22500,
    paidToDate: 18000,
    materialsCost: 6800,
    laborCost: 5200,
    startDate: '2026-02-20',
    targetCompletion: '2026-04-10',
    notes: 'Final inspection passed. Touch-up paint and grout sealing left. Awaiting last $4,500 payment.',
    createdAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'preview-3',
    name: 'Lakeside — New Build',
    address: '210 Bayou Way, Freeport FL',
    status: 'bidding',
    contractAmount: 425000,
    invoicedToDate: 0,
    paidToDate: 0,
    materialsCost: 0,
    laborCost: 0,
    startDate: '',
    targetCompletion: '',
    notes: 'Estimate submitted 4/12. Owner reviewing with bank. Decision expected this week.',
    createdAt: '2026-04-12T09:00:00Z',
  },
];

export default function ContractorDashboard() {
  const [email, setEmail] = useState('');
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);

  // ── Supply quick-add form ──
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [supplyDraft, setSupplyDraft] = useState<{ name: string; quantity: number; unit: string; vendor: string; estimatedUnitPrice: number; status: SupplyStatus }>({
    name: '', quantity: 1, unit: 'ea', vendor: '', estimatedUnitPrice: 0, status: 'needed',
  });
  const [estimating, setEstimating] = useState(false);

  // ── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setEmail(userEmail);
      const c = getContractorByEmail(userEmail);

      // Staff/owner preview mode — let MNA team review the workspace using
      // the first contractor in the directory as a stand-in. Read-only-ish:
      // changes still write to client_kv but keyed off the placeholder email,
      // so staff can play around without polluting a real contractor's data.
      if (!c && isMNAStaff(userEmail)) {
        setPreviewMode(true);
        const placeholder = CONTRACTORS[0] || null;
        setContractor(placeholder);
        setJobs(PREVIEW_JOBS);
        setEvents([
          { id: 'p-evt-1', title: 'Smith Remodel — countertop template', event_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), start_time: '10:00', end_time: '11:30', event_type: 'meeting', description: null },
          { id: 'p-evt-2', title: 'Harper Reno — final walk-through', event_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), start_time: '14:00', end_time: '15:00', event_type: 'meeting', description: null },
          { id: 'p-evt-3', title: 'Lakeside Bid — owner meeting', event_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), start_time: '09:30', end_time: '10:30', event_type: 'call', description: null },
        ]);
        setLoading(false);
        return;
      }

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
        fetch(`/api/client-kv?clientId=${encodeURIComponent(userEmail)}&key=supplies`)
          .then((r) => r.json())
          .then((d) => setSupplies(Array.isArray(d.value) ? d.value : []))
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
    // In staff preview mode the changes are session-only — we don't write
    // to a real contractor's KV row.
    if (previewMode) return;
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: email, key: 'jobs', value: next }),
    });
  }

  async function saveSupplies(next: SupplyItem[]) {
    setSupplies(next);
    if (previewMode) return;
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: email, key: 'supplies', value: next }),
    });
  }

  // Hit the Sourcer agent for a quick price estimate based on the item +
  // service area. Auto-fills the est. unit price field.
  async function estimateCost() {
    if (!supplyDraft.name.trim()) return;
    setEstimating(true);
    try {
      const r = await fetch('/api/contractor-agent/supply-sourcer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Give me ONE realistic average unit price (USD) for: "${supplyDraft.name}" in ${contractor?.serviceArea || 'the Florida Panhandle'}. Reply with ONLY a number (no $, no text). If you genuinely don't know, reply 0.`,
          }],
        }),
      });
      const data = await r.json();
      const num = parseFloat(String(data.reply || '').replace(/[^0-9.]/g, ''));
      if (num > 0) setSupplyDraft((d) => ({ ...d, estimatedUnitPrice: Math.round(num) }));
    } finally {
      setEstimating(false);
    }
  }

  function addSupply(e: React.FormEvent) {
    e.preventDefault();
    if (!supplyDraft.name.trim()) return;
    const item: SupplyItem = {
      id: uuid(),
      name: supplyDraft.name.trim(),
      quantity: Number(supplyDraft.quantity) || 1,
      unit: supplyDraft.unit || 'ea',
      vendor: supplyDraft.vendor.trim() || undefined,
      estimatedUnitPrice: Number(supplyDraft.estimatedUnitPrice) || 0,
      status: supplyDraft.status,
      createdAt: new Date().toISOString(),
    };
    saveSupplies([item, ...supplies]);
    setSupplyDraft({ name: '', quantity: 1, unit: 'ea', vendor: '', estimatedUnitPrice: 0, status: 'needed' });
    setShowSupplyForm(false);
  }

  function cycleSupplyStatus(item: SupplyItem) {
    const order: SupplyStatus[] = ['needed', 'sourcing', 'ordered', 'received'];
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    saveSupplies(supplies.map((s) => (s.id === item.id ? { ...s, status: next } : s)));
  }

  function deleteSupply(id: string) {
    saveSupplies(supplies.filter((s) => s.id !== id));
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

        {/* ── STAFF PREVIEW BANNER ── */}
        {previewMode && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}
          >
            <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-amber-200">Staff Preview Mode</div>
              <div className="text-[11px] text-white/65">
                You're viewing this as a real contractor would. Sample data shown — edits aren't persisted.
                Decide if you want to keep this as its own account or fold it into MNA Realty.
              </div>
            </div>
            <a
              href="/"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
            >
              ← Back to staff portal
            </a>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-bold">Contractor Workspace</div>
            <h1 className="text-[26px] font-extrabold mt-1">{contractor.business}</h1>
            <div className="text-white/60 text-sm">
              {contractor.name} · {TRADE_LABELS[contractor.trade]}{contractor.serviceArea ? ` · ${contractor.serviceArea}` : ''}
            </div>
          </div>
          {!previewMode && (
            <button
              onClick={async () => { await createSupabaseClient().auth.signOut(); window.location.href = '/login'; }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Sign out
            </button>
          )}
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

        {/* ── SUPPLY LIST ── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[14px] font-bold">Supply List</div>
              <div className="text-[11px] text-white/55">
                {supplies.filter((s) => s.status === 'needed').length} to source ·{' '}
                {supplies.filter((s) => s.status === 'ordered').length} ordered ·{' '}
                {supplies.filter((s) => s.status === 'received').length} received
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/contractor/agent/supply-sourcer"
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#06b6d4)' }}
              >
                Ask Sourcer
              </Link>
              <button
                onClick={() => setShowSupplyForm((v) => !v)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
              >
                {showSupplyForm ? 'Cancel' : '+ Add Item'}
              </button>
            </div>
          </div>

          {showSupplyForm && (
            <form
              onSubmit={addSupply}
              className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <input
                autoFocus
                type="text"
                placeholder="What do you need? (e.g. 5/8 drywall, subway tile, 36 vanity)"
                value={supplyDraft.name}
                onChange={(e) => setSupplyDraft({ ...supplyDraft, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input
                  type="number" min="1" value={supplyDraft.quantity}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, quantity: Number(e.target.value) || 1 })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                  placeholder="Qty"
                />
                <select
                  value={supplyDraft.unit}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, unit: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  {['ea', 'sheets', 'sf', 'lf', 'box', 'gal', 'lb'].map((u) => (
                    <option key={u} value={u} className="bg-slate-900">{u}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Vendor (optional)"
                  value={supplyDraft.vendor}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, vendor: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <div className="flex items-center px-2 rounded-lg border" style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}>
                  <span className="text-white/55 text-[12px] mr-1">$</span>
                  <input
                    type="number" min="0" step="1" value={supplyDraft.estimatedUnitPrice || ''}
                    onChange={(e) => setSupplyDraft({ ...supplyDraft, estimatedUnitPrice: Number(e.target.value) || 0 })}
                    className="flex-1 py-2 bg-transparent text-white text-[12px] outline-none"
                    placeholder="Est. unit price"
                  />
                </div>
                <select
                  value={supplyDraft.status}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, status: e.target.value as SupplyStatus })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  {(Object.keys(SUPPLY_STATUS_LABELS) as SupplyStatus[]).map((s) => (
                    <option key={s} value={s} className="bg-slate-900">{SUPPLY_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={estimateCost}
                  disabled={estimating || !supplyDraft.name.trim()}
                  className="text-[12px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50 flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#06b6d4)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>price_change</span>
                  {estimating ? 'Estimating…' : 'Estimate Cost'}
                </button>
                <button
                  type="submit"
                  className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                >
                  Add to Supply List
                </button>
              </div>
            </form>
          )}

          {supplies.length === 0 ? (
            <div className="text-[12px] text-white/55 text-center py-6">
              No supplies tracked yet. Add items as you spec out a job, then tap <span className="text-white">Ask Sourcer</span> to find best price within a radius.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-white/45 uppercase text-[9px] tracking-wider">
                    <th className="text-left font-semibold px-2 py-2">Item</th>
                    <th className="text-right font-semibold px-2 py-2">Qty</th>
                    <th className="text-left font-semibold px-2 py-2">Vendor</th>
                    <th className="text-right font-semibold px-2 py-2">Est $</th>
                    <th className="text-right font-semibold px-2 py-2">Total</th>
                    <th className="text-center font-semibold px-2 py-2">Status</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {supplies.map((s) => {
                    const total = s.quantity * (s.estimatedUnitPrice || 0);
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td className="px-2 py-2 font-semibold text-white">{s.name}</td>
                        <td className="px-2 py-2 text-right text-white/75">{s.quantity} {s.unit}</td>
                        <td className="px-2 py-2 text-white/75">{s.vendor || '—'}</td>
                        <td className="px-2 py-2 text-right text-white/75">{s.estimatedUnitPrice ? `$${s.estimatedUnitPrice}` : '—'}</td>
                        <td className="px-2 py-2 text-right font-bold text-white">{total ? `$${total.toLocaleString()}` : '—'}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => cycleSupplyStatus(s)}
                            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: `${SUPPLY_STATUS_COLORS[s.status]}22`, color: SUPPLY_STATUS_COLORS[s.status] }}
                            title="Click to advance status"
                          >
                            {SUPPLY_STATUS_LABELS[s.status]}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => deleteSupply(s.id)}
                            className="text-white/30 hover:text-rose-400 transition"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {(() => {
                  const sum = (status: SupplyStatus | null = null) =>
                    supplies
                      .filter((s) => !status || s.status === status)
                      .reduce((acc, s) => acc + s.quantity * (s.estimatedUnitPrice || 0), 0);
                  return (
                    <tfoot>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                        <td className="px-2 py-3 text-[10px] uppercase tracking-wider text-white/55 font-bold">Totals</td>
                        <td className="px-2 py-3"></td>
                        <td className="px-2 py-3 text-[10px] text-white/55">Needed: ${sum('needed').toLocaleString()}</td>
                        <td className="px-2 py-3 text-[10px] text-white/55">Ordered: ${sum('ordered').toLocaleString()}</td>
                        <td className="px-2 py-3 text-right text-[12px] font-extrabold text-white">${sum().toLocaleString()}</td>
                        <td className="px-2 py-3 text-[10px] text-emerald-400 text-center">Received: ${sum('received').toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </div>

        {/* ── AI HELPERS ── */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 mb-2">AI Helpers</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CONTRACTOR_AGENTS.map((a) => (
              <Link
                key={a.id}
                href={`/contractor/agent/${a.id}`}
                className="rounded-2xl p-4 glass-card transition hover:scale-[1.02]"
                style={{ borderLeft: '3px solid #4ab8ce' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-2"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>{a.icon}</span>
                </div>
                <div className="text-[14px] font-bold">{a.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold mt-0.5">{a.role}</div>
                <div className="text-[12px] text-white/65 mt-1.5 leading-snug">{a.tagline}</div>
              </Link>
            ))}
          </div>
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
