'use client';

import React, { useEffect, useState } from 'react';
import { clients } from '@/lib/clients';
import { createClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
};

const TEAM = [
  { email: 'mn@mothernatureagency.com', name: 'Alexus', short: 'AW', color: '#7c3aed' },
  { email: 'admin@mothernatureagency.com', name: 'Vanessa', short: 'VN', color: '#f59e0b' },
  { email: 'info@mothernatureagency.com', name: 'Sable', short: 'SB', color: '#0ea5e9' },
  // Family / personal task assignees — show up in the same picker so
  // Alexus can hand off chores, schoolwork, or practice goals.
  { email: 'marissa@mothernatureagency.com', name: 'Marissa', short: 'MM', color: '#c084fc' },
];

// Client assignees — tasks can also be assigned to the client themselves
const CLIENT_ASSIGNEES = clients.map((c) => ({
  email: `client:${c.id}`,
  name: c.shortName,
  short: c.shortName.slice(0, 2).toUpperCase(),
  color: c.branding.gradientFrom,
}));

function getTeamMember(email: string | null) {
  return TEAM.find((t) => t.email === email) || CLIENT_ASSIGNEES.find((c) => c.email === email) || null;
}

function getClientName(clientId: string) {
  const c = clients.find((cl) => cl.id === clientId);
  return c?.shortName || clientId;
}

function getClientColor(clientId: string) {
  const c = clients.find((cl) => cl.id === clientId);
  return c?.branding.gradientFrom || '#0c6da4';
}

const FILTERS = ['All', 'My Tasks', 'Alexus', 'Vanessa', 'Sable', 'Marissa', 'Unassigned'] as const;

export default function TaskManagerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [userEmail, setUserEmail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ clientId: '', title: '', description: '', assignedTo: '' });

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setUserEmail(email);
      if (email !== 'mn@mothernatureagency.com') {
        setActiveFilter('My Tasks');
      }
    });
    loadTasks();
  }, []);

  async function loadTasks() {
    const res = await fetch('/api/client-requests');
    const data = await res.json();
    setTasks(data.items || []);
  }

  async function createTask() {
    if (!newTask.clientId || !newTask.title) return;
    await fetch('/api/client-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: newTask.clientId,
        title: newTask.title,
        description: newTask.description || null,
        assignedTo: newTask.assignedTo || null,
      }),
    });
    setNewTask({ clientId: '', title: '', description: '', assignedTo: '' });
    setShowForm(false);
    loadTasks();
  }

  async function toggleStatus(id: string, currentStatus: string) {
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: currentStatus === 'done' ? 'open' : 'done' }),
    });
    loadTasks();
  }

  async function updateAssignee(id: string, assignedTo: string) {
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, assignedTo: assignedTo || null }),
    });
    loadTasks();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/client-requests?id=${id}`, { method: 'DELETE' });
    loadTasks();
  }

  // Filter
  const filtered = tasks.filter((t) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'My Tasks') return t.assigned_to === userEmail;
    if (activeFilter === 'Unassigned') return !t.assigned_to;
    const member = TEAM.find((m) => m.name === activeFilter);
    return member ? t.assigned_to === member.email : true;
  });

  const openTasks = filtered.filter((t) => t.status !== 'done');
  const doneTasks = filtered.filter((t) => t.status === 'done');

  // Group open tasks by client
  const byClient = new Map<string, Task[]>();
  openTasks.forEach((t) => {
    const existing = byClient.get(t.client_id) || [];
    existing.push(t);
    byClient.set(t.client_id, existing);
  });

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>checklist</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Task Manager</h1>
          </div>
          <p className="text-white/60 mt-1">All tasks across all clients. Assign, track, and complete.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={newTask.clientId}
              onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </select>
            <select
              value={newTask.assignedTo}
              onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            >
              <option value="">Assign to...</option>
              <optgroup label="Team">
                {TEAM.map((m) => (
                  <option key={m.email} value={m.email}>{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="Client">
                {CLIENT_ASSIGNEES.map((c) => (
                  <option key={c.email} value={c.email}>{c.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <input
            type="text"
            placeholder="Task title..."
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-2"
          />
          <input
            type="text"
            placeholder="Description (optional)..."
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-3"
          />
          <button
            onClick={createTask}
            className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            Create Task
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f;
          const member = TEAM.find((m) => m.name === f);
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: isActive ? (member?.color || 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {f} {f === 'All' ? `(${tasks.filter((t) => t.status !== 'done').length})` : ''}
            </button>
          );
        })}
      </div>

      {/* Tasks grouped by client */}
      {Array.from(byClient.entries()).map(([clientId, clientTasks]) => (
        <div key={clientId}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full" style={{ background: getClientColor(clientId) }} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{getClientName(clientId)}</span>
            <span className="text-[10px] text-white/30">{clientTasks.length} open</span>
          </div>
          <div className="glass-card p-4 space-y-1">
            {clientTasks.map((task) => {
              const member = getTeamMember(task.assigned_to);
              return (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 group">
                  <button
                    onClick={() => toggleStatus(task.id, task.status)}
                    className="w-5 h-5 rounded border border-white/30 shrink-0 hover:border-white/60 transition-colors flex items-center justify-center"
                  >
                    {task.status === 'done' && <span className="text-[10px] text-emerald-400">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-white/90 truncate">{task.title}</div>
                    {task.description && (
                      <div className="text-[10px] text-white/45 truncate">{task.description}</div>
                    )}
                  </div>
                  <select
                    value={task.assigned_to || ''}
                    onChange={(e) => updateAssignee(task.id, e.target.value)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-transparent border border-white/10 outline-none cursor-pointer"
                    style={{
                      color: member?.color || 'rgba(255,255,255,0.4)',
                      background: member ? member.color + '15' : 'transparent',
                    }}
                  >
                    <option value="">Unassigned</option>
                    <optgroup label="Team">
                      {TEAM.map((m) => (
                        <option key={m.email} value={m.email}>{m.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Client">
                      {CLIENT_ASSIGNEES.map((c) => (
                        <option key={c.email} value={c.email}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-[10px] text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {openTasks.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="text-[14px] font-semibold text-white/70">
            {activeFilter === 'All' ? 'No open tasks' : `No tasks for ${activeFilter}`}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Click "+ New Task" to create one.</div>
        </div>
      )}

      {doneTasks.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">
            Completed ({doneTasks.length})
          </div>
          <div className="glass-card p-4 opacity-60">
            {doneTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5">
                <button
                  onClick={() => toggleStatus(task.id, task.status)}
                  className="w-4 h-4 rounded bg-emerald-600/30 flex items-center justify-center text-[9px] text-white shrink-0"
                >
                  ✓
                </button>
                <span className="text-[11px] text-white/40 line-through truncate">{task.title}</span>
                <span className="text-[9px] text-white/25 shrink-0">{getClientName(task.client_id)}</span>
              </div>
            ))}
            {doneTasks.length > 10 && (
              <div className="text-[10px] text-white/30 mt-2">+{doneTasks.length - 10} more completed</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
