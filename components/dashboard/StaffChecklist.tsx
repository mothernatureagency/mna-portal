'use client';

/**
 * StaffChecklist — Vanessa's (admin@) personalized top section.
 * Shows MNA-level tasks as a checklist + an editable agenda section.
 */

import React, { useEffect, useState } from 'react';

type Task = { id: string; title: string; description: string | null; status: string; created_at: string };
type AgendaItem = { date: string; time: string; title: string; notes?: string };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

export default function StaffChecklist() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [newEvent, setNewEvent] = useState({ date: '', time: '', title: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    // Fetch tasks assigned to Vanessa across all clients
    fetch('/api/client-requests?assignedTo=admin@mothernatureagency.com')
      .then((r) => r.json())
      .then((d) => setTasks(d.items || []))
      .catch(() => {});

    // Fetch agenda from client_kv
    fetch('/api/client-kv?clientId=mna&key=staff_agenda_admin')
      .then((r) => r.json())
      .then((d) => {
        if (d.value && Array.isArray(d.value)) setAgenda(d.value);
      })
      .catch(() => {});
  }, []);

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  async function toggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'open' : 'done';
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  }

  async function addAgendaItem() {
    if (!newEvent.date || !newEvent.title) return;
    const updated = [...agenda, { ...newEvent }].sort(
      (a, b) => new Date(a.date + 'T' + (a.time || '00:00')).getTime() - new Date(b.date + 'T' + (b.time || '00:00')).getTime()
    );
    setAgenda(updated);
    setNewEvent({ date: '', time: '', title: '' });
    setShowAddForm(false);
    // Save to client_kv
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', key: 'staff_agenda_admin', value: updated }),
    });
  }

  async function removeAgendaItem(index: number) {
    const updated = agenda.filter((_, i) => i !== index);
    setAgenda(updated);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', key: 'staff_agenda_admin', value: updated }),
    });
  }

  // Upcoming agenda items (today and future)
  const today = new Date().toISOString().slice(0, 10);
  const upcomingAgenda = agenda.filter((a) => a.date >= today);

  return (
    <div className="space-y-6">
      {/* ── CHECKLIST ── */}
      <div>
        <SectionLabel>My Checklist</SectionLabel>
        <div className="glass-card p-5" style={{ borderLeft: '3px solid #7c3aed' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold text-white">
              Tasks
              <span className="text-white/50 font-normal ml-2">{openTasks.length} open</span>
            </div>
          </div>

          {openTasks.length === 0 && doneTasks.length === 0 && (
            <div className="text-[12px] text-white/50 italic py-3">No tasks yet. Tasks assigned to MNA will appear here.</div>
          )}

          <div className="space-y-1.5">
            {openTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
                onClick={() => toggleTask(task.id, task.status)}
              >
                <div className="w-4 h-4 rounded border border-white/30 mt-0.5 shrink-0 group-hover:border-white/60 transition-colors" />
                <div>
                  <div className="text-[12px] text-white/90">{task.title}</div>
                  {task.description && (
                    <div className="text-[10px] text-white/50 mt-0.5">{task.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {doneTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Completed</div>
              {doneTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 py-1 cursor-pointer group"
                  onClick={() => toggleTask(task.id, task.status)}
                >
                  <div className="w-4 h-4 rounded bg-emerald-600/30 flex items-center justify-center text-[9px] text-white shrink-0">✓</div>
                  <span className="text-[11px] text-white/40 line-through">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AGENDA ── */}
      <div>
        <SectionLabel>Agenda & Reminders</SectionLabel>
        <div className="glass-card p-5" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold text-white">Upcoming</div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-[11px] font-semibold px-3 py-1 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              {showAddForm ? 'Cancel' : '+ Add Event'}
            </button>
          </div>

          {showAddForm && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="text-[11px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
                />
                <input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="text-[11px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
                />
                <button
                  onClick={addAgendaItem}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  Add
                </button>
              </div>
              <input
                type="text"
                placeholder="Event title..."
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full text-[12px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
              />
            </div>
          )}

          {upcomingAgenda.length === 0 && (
            <div className="text-[12px] text-white/50 italic py-2">No upcoming events. Click "+ Add Event" to schedule meetings, deadlines, or reminders.</div>
          )}

          <div className="space-y-2">
            {upcomingAgenda.map((item, i) => {
              const isToday = item.date === today;
              const dateObj = new Date(item.date + 'T12:00:00');
              const dayLabel = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="w-14 shrink-0">
                    <div className={`text-[10px] font-bold ${isToday ? 'text-amber-400' : 'text-white/50'}`}>{dayLabel}</div>
                    {item.time && <div className="text-[10px] text-white/40">{item.time}</div>}
                  </div>
                  <div className={`w-0.5 h-6 rounded-full ${isToday ? 'bg-amber-400' : 'bg-white/15'}`} />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-white/90">{item.title}</div>
                    {item.notes && <div className="text-[10px] text-white/50">{item.notes}</div>}
                  </div>
                  <button
                    onClick={() => removeAgendaItem(agenda.indexOf(item))}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors shrink-0"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
