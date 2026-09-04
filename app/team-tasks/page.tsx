'use client';

/**
 * Team Tasks — Asana/Monday-style board for internal assignments.
 *
 * Three views of the same tasks, switchable like Monday.com:
 *   Table    — per-person groups with real columns (task, client, due,
 *              priority, status), colored pills, inline editing.
 *   Board    — Asana-style kanban: To do / In progress / Done columns.
 *   Calendar — month grid with each task on its deadline, colored by
 *              assignee, overdue highlighted.
 *
 * Tasks are one-time, monthly (auto-created each month), or per-new-client
 * (auto-created when a client is onboarded). Recurring definitions live in
 * the "Recurring" panel where they can be paused, applied, or removed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';
import { STAFF, isOwner } from '@/lib/staff';

type TeamTask = {
  id: string;
  title: string;
  description: string | null;
  assignee_email: string | null;
  client_id: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  recurrence: string;
  template_id: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

type TaskTemplate = {
  id: string;
  title: string;
  description: string | null;
  assignee_email: string | null;
  recurrence: string;
  due_day: number | null;
  priority: string;
  active: boolean;
};

type Member = { email: string; name: string; color: string };

const PALETTE = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: '#9ca3af' },
  normal: { label: 'Normal', color: '#0ea5e9' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#f43f5e' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'To do', color: '#9ca3af' },
  in_progress: { label: 'Working on it', color: '#f59e0b' },
  done: { label: 'Done', color: '#10b981' },
};

function colorFor(email: string): string {
  let sum = 0;
  for (let i = 0; i < email.length; i++) sum += email.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDue(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month grid: leading/trailing nulls pad to full weeks. */
function monthGrid(y: number, m: number): (string | null)[] {
  const startDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function TeamTasksPage() {
  const ctx = useClient() as any;
  const allClients: Array<{ id: string; shortName: string; name: string; branding?: { gradientFrom?: string } }> = ctx?.allClients || [];

  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [staffRows, setStaffRows] = useState<Array<{ email: string; name: string; color: string | null }>>([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'board' | 'calendar'>('table');
  const [calCursor, setCalCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [applyPick, setApplyPick] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: '', description: '', assigneeEmail: '', clientId: '',
    dueDate: todayIso(), priority: 'normal', recurrence: 'one_time', dueDay: '1',
  });

  // Team = static staff + anyone added via the Accounts/staff roster, deduped.
  const members: Member[] = useMemo(() => {
    const map = new Map<string, Member>();
    for (const s of STAFF) map.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), name: s.name.split(' ')[0], color: colorFor(s.email) });
    for (const s of staffRows) {
      const email = (s.email || '').toLowerCase();
      if (!email) continue;
      map.set(email, { email, name: s.name || email.split('@')[0], color: s.color || colorFor(email) });
    }
    return Array.from(map.values());
  }, [staffRows]);

  const memberOf = (email: string | null): Member | null =>
    email ? members.find((m) => m.email === email.toLowerCase()) || { email, name: email.split('@')[0], color: colorFor(email) } : null;

  const clientOf = (id: string | null) => (id ? allClients.find((c) => c.id === id) || null : null);

  async function load() {
    const res = await fetch('/api/team-tasks');
    if (res.ok) {
      const data = await res.json();
      setTasks(data.items || []);
      setTemplates(data.templates || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    createClient().auth.getUser().then((res: { data: { user: { email?: string | null } | null } }) => {
      const email = (res.data.user?.email || '').toLowerCase();
      setUserEmail(email);
      // Teammates land on their own list; the owner sees everyone.
      if (email && !isOwner(email)) setFilter('My Tasks');
    });
    fetch('/api/staff').then((r) => r.json()).then((d) => setStaffRows(d.staff || [])).catch(() => {});
    load();
  }, []);

  async function createTask() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const body: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigneeEmail: form.assigneeEmail || null,
        clientId: form.clientId || null,
        priority: form.priority,
        recurrence: form.recurrence,
      };
      if (form.recurrence === 'one_time') body.dueDate = form.dueDate || null;
      else body.dueDay = Number(form.dueDay) || null;
      const res = await fetch('/api/team-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setForm({ title: '', description: '', assigneeEmail: '', clientId: '', dueDate: todayIso(), priority: 'normal', recurrence: 'one_time', dueDay: '1' });
        setShowForm(false);
        if (form.recurrence === 'per_new_client') { setShowTemplates(true); setNotice('Saved — it will spawn for every new client. Use "Apply to client" below to run it for an existing one.'); }
        await load();
      }
    } finally { setSaving(false); }
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k === 'assigneeEmail' ? 'assignee_email' : k === 'dueDate' ? 'due_date' : k, v])) } : t)));
    await fetch('/api/team-tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    load();
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/team-tasks?id=${id}`, { method: 'DELETE' });
  }

  async function toggleTemplate(t: TaskTemplate) {
    await fetch('/api/team-tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: t.id, active: !t.active }) });
    load();
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/team-tasks?templateId=${id}`, { method: 'DELETE' });
    load();
  }

  async function runMonthlyNow() {
    const res = await fetch('/api/team-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run_monthly' }) });
    const d = await res.json().catch(() => ({}));
    setNotice(d.created > 0 ? `Created ${d.created} task${d.created === 1 ? '' : 's'} for this month.` : 'This month is already generated — nothing new to create.');
    load();
  }

  async function applyToClient(t: TaskTemplate) {
    const clientId = applyPick[t.id];
    if (!clientId) return;
    const c = clientOf(clientId);
    const res = await fetch('/api/team-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply_client', templateId: t.id, clientId, clientName: c?.shortName || c?.name }),
    });
    const d = await res.json().catch(() => ({}));
    setNotice(d.alreadyApplied ? `Already applied to ${c?.shortName || clientId} — skipped so it doesn't duplicate.` : `Task created for ${c?.shortName || clientId}.`);
    setApplyPick((p) => ({ ...p, [t.id]: '' }));
    load();
  }

  // ── Derived views ─────────────────────────────────────────────────
  const today = todayIso();
  const inFilter = (t: TeamTask) => {
    if (filter === 'All') return true;
    if (filter === 'My Tasks') return (t.assignee_email || '') === userEmail;
    return (t.assignee_email || '') === filter;
  };
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const shown = open.filter(inFilter);
  const shownAll = tasks.filter(inFilter);

  // Table: one Monday-style group per person, unassigned last.
  const lanes = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    for (const t of shown) {
      const key = t.assignee_email || '';
      map.set(key, [...(map.get(key) || []), t]);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])));
    return entries;
  }, [shown]);

  // Calendar: tasks bucketed by due date for the visible month.
  const calCells = monthGrid(calCursor.y, calCursor.m);
  const byDate = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    for (const t of shownAll) {
      if (!t.due_date) continue;
      map.set(t.due_date, [...(map.get(t.due_date) || []), t]);
    }
    return map;
  }, [shownAll]);
  const noDateCount = shown.filter((t) => !t.due_date).length;

  const overdueCount = (list: TeamTask[]) => list.filter((t) => t.due_date && t.due_date < today).length;

  // ── Shared cell renderers ─────────────────────────────────────────

  function DuePill({ task }: { task: TeamTask }) {
    const isOverdue = !!task.due_date && task.due_date < today && task.status !== 'done';
    const isToday = task.due_date === today && task.status !== 'done';
    return (
      <input type="date" value={task.due_date || ''} onChange={(e) => patchTask(task.id, { dueDate: e.target.value || null })}
        className="text-[10px] font-semibold px-1.5 py-1 rounded-lg border outline-none bg-transparent cursor-pointer w-[112px]"
        style={{
          color: isOverdue ? '#fda4af' : isToday ? '#fcd34d' : 'rgba(255,255,255,0.65)',
          borderColor: isOverdue ? 'rgba(244,63,94,0.45)' : isToday ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)',
          background: isOverdue ? 'rgba(244,63,94,0.1)' : isToday ? 'rgba(245,158,11,0.08)' : 'transparent',
        }}
        title={isOverdue ? `Overdue — was due ${fmtDue(task.due_date!)}` : 'Deadline'} />
    );
  }

  function StatusPill({ task }: { task: TeamTask }) {
    const s = STATUS_META[task.status] || STATUS_META.todo;
    return (
      <select value={task.status} onChange={(e) => patchTask(task.id, { status: e.target.value })}
        className="text-[10px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer border-0 w-[118px] text-center appearance-none"
        style={{ background: s.color + '2b', color: s.color }}>
        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#0d1b2a' }}>{v.label}</option>)}
      </select>
    );
  }

  function PriorityPill({ task }: { task: TeamTask }) {
    const p = PRIORITY_META[task.priority] || PRIORITY_META.normal;
    return (
      <select value={task.priority} onChange={(e) => patchTask(task.id, { priority: e.target.value })}
        className="text-[10px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer border-0 w-[92px] text-center appearance-none"
        style={{ background: p.color + '2b', color: p.color }}>
        {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#0d1b2a' }}>{v.label}</option>)}
      </select>
    );
  }

  function AssigneeSelect({ task }: { task: TeamTask }) {
    const m = memberOf(task.assignee_email);
    return (
      <select value={task.assignee_email || ''} onChange={(e) => patchTask(task.id, { assigneeEmail: e.target.value || null })}
        className="text-[10px] font-semibold px-2 py-1.5 rounded-lg outline-none cursor-pointer border w-[104px]"
        style={{ color: m?.color || 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)', background: m ? m.color + '14' : 'transparent' }} title="Reassign">
        <option value="">Unassigned</option>
        {members.map((mm) => <option key={mm.email} value={mm.email} style={{ background: '#0d1b2a' }}>{mm.name}</option>)}
      </select>
    );
  }

  function TitleCell({ task }: { task: TeamTask }) {
    const c = clientOf(task.client_id);
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-semibold text-white/90 truncate">{task.title}</span>
          {task.recurrence === 'monthly' && <span className="material-symbols-outlined text-sky-300/70 shrink-0" style={{ fontSize: 13 }} title="Repeats monthly">repeat</span>}
          {task.recurrence === 'per_new_client' && <span className="material-symbols-outlined text-violet-300/70 shrink-0" style={{ fontSize: 13 }} title="Created for a new client">add_business</span>}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {c && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ color: c.branding?.gradientFrom || '#4ab8ce', background: (c.branding?.gradientFrom || '#4ab8ce') + '18' }}>{c.shortName}</span>}
          {task.description && <span className="text-[10px] text-white/40 truncate">{task.description}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1250px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>assignment_ind</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Team Tasks</h1>
          </div>
          <p className="text-white/60 mt-1">Assign work to the team with deadlines — one-time, monthly, or for every new client.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switch — Monday-style */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {([['table', 'table_rows', 'Table'], ['board', 'view_kanban', 'Board'], ['calendar', 'calendar_month', 'Calendar']] as const).map(([mode, icon, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === mode ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTemplates((s) => !s)}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white border border-white/10 inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>repeat</span>
            Recurring ({templates.length})
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
            {showForm ? 'Cancel' : '+ New Task'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="glass-card px-4 py-2.5 text-[12px] text-cyan-200 flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} className="text-white/40 hover:text-white/80">✕</button>
        </div>
      )}

      {/* ── New task form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-card p-5 space-y-3">
          <input
            type="text" placeholder="Task title..." value={form.title} autoFocus
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
          />
          <input
            type="text" placeholder="Description (optional)..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Assign to</span>
              <select value={form.assigneeEmail} onChange={(e) => setForm({ ...form, assigneeEmail: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Client (optional)</span>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
                <option value="">No client</option>
                {allClients.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Priority</span>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Repeats</span>
              <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
                <option value="one_time">One time</option>
                <option value="monthly">Every month</option>
                <option value="per_new_client">Each new client</option>
              </select>
            </label>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {form.recurrence === 'one_time' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Deadline</span>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
              </label>
            )}
            {form.recurrence === 'monthly' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Due on day (each month)</span>
                <input type="number" min={1} max={28} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                  className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none w-28" />
              </label>
            )}
            {form.recurrence === 'per_new_client' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Due (days after client is added)</span>
                <input type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                  className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none w-28" />
              </label>
            )}
            <button onClick={createTask} disabled={!form.title.trim() || saving}
              className="text-[12px] font-bold px-5 py-2 rounded-xl text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
              {saving ? 'Saving…' : form.recurrence === 'one_time' ? 'Create Task' : 'Save Recurring Task'}
            </button>
            {form.recurrence === 'monthly' && <span className="text-[10px] text-white/40 pb-2.5">Auto-creates on the 1st of every month (this month's is created now).</span>}
            {form.recurrence === 'per_new_client' && <span className="text-[10px] text-white/40 pb-2.5">Auto-creates whenever a new client is added to the portal.</span>}
          </div>
        </div>
      )}

      {/* ── Recurring templates panel ─────────────────────────────── */}
      {showTemplates && (
        <div className="glass-card p-4" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="material-symbols-outlined text-violet-300" style={{ fontSize: 18 }}>repeat</span>
            <span className="text-[12px] font-semibold text-white/80">Recurring tasks</span>
            <span className="text-[11px] text-white/45">— monthly ones auto-create on the 1st; &quot;each new client&quot; ones fire when a client is added</span>
            <button onClick={runMonthlyNow} className="ml-auto text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:text-white border border-white/10">
              Generate this month now
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="text-[12px] text-white/40 py-2">No recurring tasks yet — pick &quot;Every month&quot; or &quot;Each new client&quot; when creating a task.</div>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t) => {
                const m = memberOf(t.assignee_email);
                return (
                  <div key={t.id} className={`flex items-center gap-3 py-2 px-2 rounded-lg border border-white/5 ${t.active ? '' : 'opacity-50'}`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0"
                      style={{ background: t.recurrence === 'monthly' ? 'rgba(14,165,233,0.15)' : 'rgba(139,92,246,0.15)', color: t.recurrence === 'monthly' ? '#7dd3fc' : '#c4b5fd' }}>
                      {t.recurrence === 'monthly' ? `Monthly · day ${t.due_day || 'end'}` : `New client · +${t.due_day || 7}d`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-white/90 truncate">{t.title}</div>
                      {t.description && <div className="text-[10px] text-white/45 truncate">{t.description}</div>}
                    </div>
                    {m && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0" style={{ color: m.color, background: m.color + '18' }}>{m.name}</span>
                    )}
                    {t.recurrence === 'per_new_client' && (
                      <span className="flex items-center gap-1 shrink-0">
                        <select value={applyPick[t.id] || ''} onChange={(e) => setApplyPick((p) => ({ ...p, [t.id]: e.target.value }))}
                          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 outline-none">
                          <option value="">Apply to client…</option>
                          {allClients.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                        </select>
                        {applyPick[t.id] && (
                          <button onClick={() => applyToClient(t)} className="text-[10px] font-bold px-2 py-1 rounded-lg text-white" style={{ background: 'rgba(139,92,246,0.4)' }}>Go</button>
                        )}
                      </span>
                    )}
                    <button onClick={() => toggleTemplate(t)} title={t.active ? 'Pause — stops future auto-creation' : 'Resume'}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white/5 text-white/60 hover:text-white border border-white/10 shrink-0">
                      {t.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} className="text-white/20 hover:text-red-400 shrink-0" title="Delete (existing tasks stay)">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {['All', 'My Tasks', ...members.map((m) => m.email)].map((f) => {
          const m = members.find((x) => x.email === f);
          const label = f === 'All' ? `All (${open.length})` : f === 'My Tasks' ? 'My Tasks' : m?.name || f;
          const isActive = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: isActive ? (m?.color || 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-[12px] text-white/40">Loading the board…</div>
      ) : (
        <>
          {/* ══ TABLE VIEW — Monday-style groups with columns ══════════ */}
          {viewMode === 'table' && (shown.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-[14px] font-semibold text-white/70">No open tasks{filter !== 'All' ? ' for this filter' : ''}</div>
              <div className="text-[11px] text-white/40 mt-1">Click &quot;+ New Task&quot; to assign one.</div>
            </div>
          ) : (
            lanes.map(([email, list]) => {
              const m = memberOf(email || null);
              const groupColor = m?.color || '#64748b';
              const overdue = overdueCount(list);
              return (
                <div key={email || 'unassigned'} className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    {/* Group title — Monday-style colored bar */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1 h-5 rounded-full" style={{ background: groupColor }} />
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: groupColor }}>
                        {(m?.name || 'Unassigned').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[13px] font-bold" style={{ color: groupColor }}>{m?.name || 'Unassigned'}</span>
                      <span className="text-[10px] text-white/35">{list.length} task{list.length === 1 ? '' : 's'}</span>
                      {overdue > 0 && <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded">{overdue} overdue</span>}
                    </div>
                    <div className="glass-card overflow-hidden" style={{ borderLeft: `3px solid ${groupColor}` }}>
                      {/* Column headers */}
                      <div className="grid grid-cols-[28px_minmax(220px,1fr)_112px_92px_118px_104px_28px] gap-2 items-center px-3 py-2 border-b border-white/10 bg-white/[0.03]">
                        <span />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Task</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Due date</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Priority</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 text-center">Status</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">Owner</span>
                        <span />
                      </div>
                      {list.map((task) => (
                        <div key={task.id} className="grid grid-cols-[28px_minmax(220px,1fr)_112px_92px_118px_104px_28px] gap-2 items-center px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.03] group">
                          <button onClick={() => patchTask(task.id, { status: 'done' })}
                            className="w-5 h-5 rounded border border-white/30 hover:border-emerald-400 transition-colors" title="Mark done" />
                          <TitleCell task={task} />
                          <DuePill task={task} />
                          <PriorityPill task={task} />
                          <StatusPill task={task} />
                          <AssigneeSelect task={task} />
                          <button onClick={() => deleteTask(task.id)}
                            className="text-[11px] text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          ))}

          {/* ══ BOARD VIEW — Asana-style kanban ════════════════════════ */}
          {viewMode === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {(['todo', 'in_progress', 'done'] as const).map((col) => {
                const meta = STATUS_META[col];
                const cards = (col === 'done' ? done.filter(inFilter).slice(0, 20) : shown.filter((t) => t.status === col));
                return (
                  <div key={col} className="glass-card p-3" style={{ borderTop: `3px solid ${meta.color}` }}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[12px] font-bold text-white/80">{meta.label}</span>
                      <span className="text-[10px] text-white/35">{cards.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[60px]">
                      {cards.length === 0 && <div className="text-[11px] text-white/25 text-center py-4">Nothing here</div>}
                      {cards.map((task) => {
                        const m = memberOf(task.assignee_email);
                        const c = clientOf(task.client_id);
                        const p = PRIORITY_META[task.priority] || PRIORITY_META.normal;
                        const isOverdue = !!task.due_date && task.due_date < today && task.status !== 'done';
                        return (
                          <div key={task.id} className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] p-3 group">
                            <div className="flex items-start gap-2">
                              <span className={`text-[12px] font-semibold flex-1 min-w-0 ${task.status === 'done' ? 'text-white/40 line-through' : 'text-white/90'}`}>{task.title}</span>
                              <button onClick={() => deleteTask(task.id)} className="text-[10px] text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0">✕</button>
                            </div>
                            {task.description && <div className="text-[10px] text-white/40 truncate mt-0.5">{task.description}</div>}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {c && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ color: c.branding?.gradientFrom || '#4ab8ce', background: (c.branding?.gradientFrom || '#4ab8ce') + '18' }}>{c.shortName}</span>}
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: p.color, background: p.color + '18' }}>{p.label}</span>
                              {task.due_date && (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isOverdue ? 'text-rose-300 bg-rose-500/15' : 'text-white/50 bg-white/5'}`}>
                                  {isOverdue ? '⚠ ' : ''}{fmtDue(task.due_date)}
                                </span>
                              )}
                              {m && (
                                <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: m.color }} title={m.name}>
                                  {m.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              {col !== 'todo' && (
                                <button onClick={() => patchTask(task.id, { status: col === 'done' ? 'in_progress' : 'todo' })}
                                  className="text-[9px] font-semibold px-2 py-1 rounded-lg bg-white/5 text-white/50 hover:text-white border border-white/10">← Back</button>
                              )}
                              {col !== 'done' && (
                                <button onClick={() => patchTask(task.id, { status: col === 'todo' ? 'in_progress' : 'done' })}
                                  className="text-[9px] font-bold px-2 py-1 rounded-lg text-white ml-auto"
                                  style={{ background: col === 'todo' ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.4)' }}>
                                  {col === 'todo' ? 'Start →' : 'Done ✓'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ CALENDAR VIEW — deadlines on a month grid ══════════════ */}
          {viewMode === 'calendar' && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCalCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))}
                    className="w-7 h-7 rounded-lg bg-white/5 text-white/60 hover:text-white flex items-center justify-center">‹</button>
                  <span className="text-[14px] font-bold text-white w-44 text-center">{MONTHS[calCursor.m]} {calCursor.y}</span>
                  <button onClick={() => setCalCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}
                    className="w-7 h-7 rounded-lg bg-white/5 text-white/60 hover:text-white flex items-center justify-center">›</button>
                  <button onClick={() => { const d = new Date(); setCalCursor({ y: d.getFullYear(), m: d.getMonth() }); }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white border border-white/10">Today</button>
                </div>
                {noDateCount > 0 && <span className="text-[10px] text-white/40">{noDateCount} open task{noDateCount === 1 ? '' : 's'} with no deadline (not shown)</span>}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DOW.map((d) => <div key={d} className="text-[9px] font-bold uppercase tracking-widest text-white/30 text-center py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calCells.map((iso, i) => {
                  if (!iso) return <div key={`pad-${i}`} className="rounded-lg min-h-[92px]" style={{ background: 'rgba(255,255,255,0.02)' }} />;
                  const dayTasks = byDate.get(iso) || [];
                  const isToday = iso === today;
                  return (
                    <div key={iso} className="rounded-lg min-h-[92px] p-1.5 flex flex-col gap-1 border"
                      style={{
                        background: isToday ? 'rgba(74,184,206,0.08)' : 'rgba(255,255,255,0.03)',
                        borderColor: isToday ? 'rgba(74,184,206,0.45)' : 'transparent',
                      }}>
                      <span className={`text-[10px] font-bold self-end ${isToday ? 'text-cyan-300' : 'text-white/35'}`}>{Number(iso.slice(8, 10))}</span>
                      {dayTasks.slice(0, 3).map((t) => {
                        const m = memberOf(t.assignee_email);
                        const isDone = t.status === 'done';
                        const isOverdue = !isDone && iso < today;
                        return (
                          <div key={t.id}
                            className={`text-[9px] font-semibold px-1.5 py-1 rounded-md truncate leading-tight ${isDone ? 'line-through opacity-40' : ''}`}
                            style={{
                              background: (m?.color || '#64748b') + (isDone ? '15' : '28'),
                              color: m?.color || 'rgba(255,255,255,0.6)',
                              border: isOverdue ? '1px solid rgba(244,63,94,0.55)' : '1px solid transparent',
                            }}
                            title={`${t.title}${m ? ` — ${m.name}` : ''}${isOverdue ? ' (overdue)' : ''}`}>
                            {t.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && <span className="text-[8px] text-white/35 px-1">+{dayTasks.length - 3} more</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Completed (table view only — board has its own column) ── */}
      {viewMode === 'table' && done.length > 0 && (
        <div>
          <button onClick={() => setShowDone((s) => !s)} className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2 hover:text-white/60">
            Completed ({done.length}) {showDone ? '▲' : '▼'}
          </button>
          {showDone && (
            <div className="glass-card p-4 opacity-60 space-y-1">
              {done.slice(0, 25).map((task) => {
                const m = memberOf(task.assignee_email);
                return (
                  <div key={task.id} className="flex items-center gap-3 py-1.5">
                    <button onClick={() => patchTask(task.id, { status: 'todo' })} title="Reopen"
                      className="w-4 h-4 rounded bg-emerald-600/30 flex items-center justify-center text-[9px] text-white shrink-0">✓</button>
                    <span className="text-[11px] text-white/40 line-through truncate flex-1">{task.title}</span>
                    {m && <span className="text-[9px] shrink-0" style={{ color: m.color }}>{m.name}</span>}
                    {task.completed_at && <span className="text-[9px] text-white/25 shrink-0">{fmtDue(task.completed_at.slice(0, 10))}</span>}
                  </div>
                );
              })}
              {done.length > 25 && <div className="text-[10px] text-white/30 mt-1">+{done.length - 25} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
