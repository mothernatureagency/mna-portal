'use client';

import { useEffect, useState } from 'react';
import { clients, Client } from '@/lib/clients';
import { createClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
};

type AgendaItem = {
  id: string;
  client_id: string;
  date: string;
  time: string;
  title: string;
  notes: string;
  source: 'checklist' | 'manual';
  task_id?: string;
};

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

export default function ClientAgendaPage() {
  const [client, setClient] = useState<Client>(clients.find((c) => c.id === 'prime-iv')!);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualItems, setManualItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      const clientId = (meta.client_id as string) || 'prime-iv';
      const found = clients.find((c) => c.id === clientId);
      if (found) setClient(found);
    });
  }, []);

  // Load tasks for this client
  useEffect(() => {
    setLoading(true);
    fetch('/api/client-requests')
      .then((r) => r.json())
      .then((d) => setTasks((d.items || []).filter((t: Task) => t.status !== 'done')))
      .finally(() => setLoading(false));
  }, []);

  // Load manual agenda items
  useEffect(() => {
    if (!client) return;
    fetch(`/api/client-kv?clientId=${client.id}&key=agenda_items`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value && Array.isArray(data.value)) {
          setManualItems(data.value.filter((i: AgendaItem) => i.client_id === client.id));
        }
      })
      .catch(() => {});
  }, [client]);

  async function toggleTask(taskId: string) {
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: 'done' }),
    });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const { gradientFrom, gradientTo } = client.branding;

  // Build agenda from tasks + manual items
  const checklistItems: AgendaItem[] = tasks.map((t) => ({
    id: `task-${t.id}`,
    client_id: t.client_id,
    date: todayStr(),
    time: '',
    title: t.title,
    notes: t.description || '',
    source: 'checklist' as const,
    task_id: t.id,
  }));

  const futureManual = manualItems.filter((i) => i.date >= todayStr());
  const allItems = [...checklistItems, ...futureManual].sort((a, b) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold text-neutral-900">Agenda</h1>
        <p className="text-[13px] text-neutral-500 mt-1">
          Upcoming tasks and scheduled items from your agency.
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-8 text-center text-neutral-500 shadow-sm border border-black/5">Loading...</div>
      )}

      {!loading && allItems.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-neutral-500 shadow-sm border border-black/5">
          <div className="text-[14px] font-semibold">No agenda items right now</div>
          <div className="text-[12px] mt-1">Your agency will add items here as they come up.</div>
        </div>
      )}

      {!loading && Array.from(byDate.entries()).map(([date, dateItems]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full" style={{ background: gradientFrom }} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{fmtDate(date)}</span>
            {date === todayStr() && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: gradientFrom }}>
                TODAY
              </span>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 space-y-1">
            {dateItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0">
                {item.source === 'checklist' && item.task_id ? (
                  <button
                    onClick={() => toggleTask(item.task_id!)}
                    className="w-5 h-5 rounded border-2 border-neutral-300 hover:border-emerald-500 shrink-0 flex items-center justify-center transition-colors"
                    title="Mark done"
                  />
                ) : (
                  <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center" style={{ background: `${gradientFrom}15` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12, color: gradientFrom }}>schedule</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-neutral-900 truncate">{item.title}</div>
                  {item.notes && <div className="text-[11px] text-neutral-500 truncate">{item.notes}</div>}
                </div>
                {item.time && (
                  <span className="text-[11px] font-semibold text-neutral-400 shrink-0">{fmtTime(item.time)}</span>
                )}
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: item.source === 'checklist' ? '#f3e8ff' : `${gradientFrom}15`,
                    color: item.source === 'checklist' ? '#7c3aed' : gradientFrom,
                  }}
                >
                  {item.source === 'checklist' ? 'Task' : 'Scheduled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
