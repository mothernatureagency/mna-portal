'use client';

/**
 * MNA STAFF page for managing "Tasks from MNA → Client".
 *
 * This is the admin side of /client/tasks. Staff picks a client, adds request
 * items, sees status, and can delete completed ones. Clients never see this
 * page (middleware bounces them to /client).
 */

import { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type Request = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: 'open' | 'done';
  created_at: string;
  completed_at: string | null;
};

export default function StaffClientTasksPage() {
  const { activeClient } = useClient();
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/client-requests?clientId=${encodeURIComponent(activeClient.id)}`);
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeClient.id]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/client-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClient.id,
          title: title.trim(),
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setItems((prev) => [data.item, ...prev]);
      setTitle('');
      setDescription('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this task?')) return;
    const res = await fetch(`/api/client-requests?id=${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggle(id: string, next: 'open' | 'done') {
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, status: next } : r));
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
  }

  const open = items.filter((i) => i.status === 'open');
  const done = items.filter((i) => i.status === 'done');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>
            checklist
          </span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tasks for {activeClient.shortName}</h1>
        </div>
        <p className="text-white/60 mt-1">
          Things we're asking {activeClient.name} for. They see these on their client portal.
        </p>
      </div>

      <form onSubmit={addTask} className="glass-card p-5 space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">Task title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Send us 5 testimonials for Q2 campaign"
            className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 p-2.5 text-white text-sm placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Context, format, deadline, etc."
            className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 p-2.5 text-white text-sm placeholder:text-white/30"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          {submitting ? 'Adding…' : 'Add task'}
        </button>
      </form>

      {loading && <div className="glass-card p-6 text-white/70">Loading…</div>}

      {!loading && open.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Open ({open.length})</div>
          {open.map((r) => (
            <div key={r.id} className="glass-card p-4 flex items-start gap-3">
              <button
                onClick={() => toggle(r.id, 'done')}
                className="mt-0.5 w-5 h-5 rounded border-2 border-white/40 hover:border-emerald-400 shrink-0"
                aria-label="Mark done"
              />
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">{r.title}</div>
                {r.description && <div className="text-white/60 text-xs mt-1">{r.description}</div>}
                <div className="text-white/40 text-[10px] mt-1">Added {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <button onClick={() => remove(r.id)} className="text-white/30 hover:text-rose-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && done.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Completed ({done.length})</div>
          {done.map((r) => (
            <div key={r.id} className="glass-card p-4 flex items-start gap-3 opacity-60">
              <button
                onClick={() => toggle(r.id, 'open')}
                className="mt-0.5 w-5 h-5 rounded bg-emerald-500 border-2 border-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0"
              >
                ✓
              </button>
              <div className="flex-1">
                <div className="text-white font-semibold text-sm line-through">{r.title}</div>
                {r.description && <div className="text-white/60 text-xs mt-1 line-through">{r.description}</div>}
              </div>
              <button onClick={() => remove(r.id)} className="text-white/30 hover:text-rose-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card p-8 text-center text-white/60">
          No tasks yet. Add one above to ask {activeClient.shortName} for something.
        </div>
      )}
    </div>
  );
}
