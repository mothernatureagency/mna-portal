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

type AgendaItem = {
  id: string;
  client_id: string;
  date: string;
  time: string;
  title: string;
  notes: string;
  source: 'checklist' | 'manual';
  task_id?: string; // links to client_requests id if pulled from checklist
};

const MNA_EMAILS = [
  'mn@mothernatureagency.com',
  'admin@mothernatureagency.com',
  'info@mothernatureagency.com',
];

// Order: MNA first, then alphabetical
const CLIENT_TABS = [
  clients.find((c) => c.id === 'mna')!,
  ...clients.filter((c) => c.id !== 'mna').sort((a, b) => a.shortName.localeCompare(b.shortName)),
];

function getClientColor(clientId: string) {
  return clients.find((c) => c.id === clientId)?.branding.gradientFrom || '#0c6da4';
}

function getClientName(clientId: string) {
  return clients.find((c) => c.id === clientId)?.shortName || clientId;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function fmtTime(t: string) {
  if (!t) return '';
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch { return t; }
}

export default function AgendaPage() {
  const [activeTab, setActiveTab] = useState('mna');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualItems, setManualItems] = useState<Record<string, AgendaItem[]>>({});
  const [isStaff, setIsStaff] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ date: todayStr(), time: '09:00', title: '', notes: '' });
  const [loading, setLoading] = useState(true);

  // Detect user role
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setIsStaff(MNA_EMAILS.includes(email));
    });
  }, []);

  // Load all tasks (for checklist items)
  useEffect(() => {
    setLoading(true);
    fetch('/api/client-requests')
      .then((r) => r.json())
      .then((d) => setTasks(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  // Load manual agenda items from client_kv per client
  useEffect(() => {
    async function loadManual() {
      const result: Record<string, AgendaItem[]> = {};
      for (const c of clients) {
        try {
          const res = await fetch(`/api/client-kv?clientId=${c.id}&key=agenda_items`);
          const data = await res.json();
          if (data.value && Array.isArray(data.value)) {
            result[c.id] = data.value;
          }
        } catch { /* ignore */ }
      }
      setManualItems(result);
    }
    loadManual();
  }, []);

  async function saveManualItems(clientId: string, items: AgendaItem[]) {
    setManualItems((prev) => ({ ...prev, [clientId]: items }));
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'agenda_items', value: items }),
    });
  }

  async function addManualItem() {
    if (!newItem.title || !newItem.date) { alert('Date and title are required'); return; }
    const item: AgendaItem = {
      id: crypto.randomUUID(),
      client_id: activeTab,
      date: newItem.date,
      time: newItem.time,
      title: newItem.title,
      notes: newItem.notes,
      source: 'manual',
    };
    const existing = manualItems[activeTab] || [];
    await saveManualItems(activeTab, [...existing, item]);
    setNewItem({ date: todayStr(), time: '09:00', title: '', notes: '' });
    setShowAddForm(false);
  }

  async function removeManualItem(clientId: string, itemId: string) {
    const existing = manualItems[clientId] || [];
    await saveManualItems(clientId, existing.filter((i) => i.id !== itemId));
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: currentStatus === 'done' ? 'open' : 'done' }),
    });
    // Refresh tasks
    const res = await fetch('/api/client-requests');
    const data = await res.json();
    setTasks(data.items || []);
  }

  // Build agenda for active tab
  const clientTasks = tasks.filter((t) => t.client_id === activeTab && t.status !== 'done');
  const clientManual = (manualItems[activeTab] || []).filter((i) => i.date >= todayStr());

  // Merge: checklist tasks become agenda items with today's date if no date
  const checklistAgenda: AgendaItem[] = clientTasks.map((t) => ({
    id: `task-${t.id}`,
    client_id: t.client_id,
    date: todayStr(),
    time: '',
    title: t.title,
    notes: t.description || '',
    source: 'checklist' as const,
    task_id: t.id,
  }));

  // All items sorted by date then time
  const allItems = [...checklistAgenda, ...clientManual].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '99:99').localeCompare(b.time || '99:99');
  });

  // Group by date
  const byDate = new Map<string, AgendaItem[]>();
  allItems.forEach((item) => {
    const existing = byDate.get(item.date) || [];
    existing.push(item);
    byDate.set(item.date, existing);
  });

  // Count open tasks per client for badge
  const taskCounts: Record<string, number> = {};
  tasks.forEach((t) => {
    if (t.status !== 'done') {
      taskCounts[t.client_id] = (taskCounts[t.client_id] || 0) + 1;
    }
  });
  // Add manual items count
  Object.entries(manualItems).forEach(([cid, items]) => {
    const futureCount = items.filter((i) => i.date >= todayStr()).length;
    taskCounts[cid] = (taskCounts[cid] || 0) + futureCount;
  });

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>event_note</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Agenda</h1>
          </div>
          <p className="text-white/60 mt-1">Tasks and scheduled items across all clients.</p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            {showAddForm ? 'Cancel' : '+ Add Item'}
          </button>
        )}
      </div>

      {/* Client tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {CLIENT_TABS.map((c) => {
          const isActive = activeTab === c.id;
          const count = taskCounts[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => { setActiveTab(c.id); setShowAddForm(false); }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              style={{
                background: isActive ? c.branding.gradientFrom : 'rgba(255,255,255,0.06)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {c.shortName}
              {count > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add item form (staff only) */}
      {isStaff && showAddForm && (
        <div className="glass-card p-5">
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-3">
            Add to {getClientName(activeTab)} agenda
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input
              type="date"
              value={newItem.date}
              onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
            <input
              type="time"
              value={newItem.time}
              onChange={(e) => setNewItem({ ...newItem, time: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Agenda item title..."
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-2"
          />
          <input
            type="text"
            placeholder="Notes (optional)..."
            value={newItem.notes}
            onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-3"
          />
          <button
            onClick={addManualItem}
            className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            Add to Agenda
          </button>
        </div>
      )}

      {loading && <div className="glass-card p-6 text-white/70">Loading...</div>}

      {!loading && allItems.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="text-[14px] font-semibold text-white/70">
            No agenda items for {getClientName(activeTab)}
          </div>
          <div className="text-[11px] text-white/40 mt-1">
            {isStaff ? 'Tasks from the checklist will appear here automatically. You can also add items manually.' : 'No items scheduled yet.'}
          </div>
        </div>
      )}

      {!loading && Array.from(byDate.entries()).map(([date, dateItems]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full" style={{ background: getClientColor(activeTab) }} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{fmtDate(date)}</span>
            {date === todayStr() && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">TODAY</span>
            )}
            <span className="text-[10px] text-white/30">{dateItems.length} items</span>
          </div>
          <div className="glass-card p-4 space-y-1">
            {dateItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 group">
                {/* Checkbox for checklist items */}
                {item.source === 'checklist' && item.task_id ? (
                  <button
                    onClick={() => toggleTaskStatus(item.task_id!, tasks.find((t) => t.id === item.task_id)?.status || 'open')}
                    className="w-5 h-5 rounded border border-white/30 shrink-0 hover:border-emerald-400 transition-colors flex items-center justify-center"
                    title="Mark done"
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/30" style={{ fontSize: 12 }}>schedule</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-white/90 truncate">{item.title}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: item.source === 'checklist' ? 'rgba(124,58,237,0.15)' : 'rgba(14,165,233,0.15)',
                        color: item.source === 'checklist' ? '#a78bfa' : '#7dd3fc',
                        border: `1px solid ${item.source === 'checklist' ? 'rgba(124,58,237,0.3)' : 'rgba(14,165,233,0.3)'}`,
                      }}
                    >
                      {item.source === 'checklist' ? 'Task' : 'Manual'}
                    </span>
                  </div>
                  {item.notes && <div className="text-[10px] text-white/45 truncate">{item.notes}</div>}
                </div>
                {item.time && (
                  <span className="text-[11px] font-semibold text-white/50 shrink-0">{fmtTime(item.time)}</span>
                )}
                {isStaff && item.source === 'manual' && (
                  <button
                    onClick={() => removeManualItem(item.client_id, item.id)}
                    className="text-[10px] text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
