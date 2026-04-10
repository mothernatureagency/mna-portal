'use client';

import { useEffect, useState } from 'react';

type Request = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: 'open' | 'done';
  created_at: string;
  completed_at: string | null;
};

export default function ClientTasksPage() {
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/client-requests');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: string, nextStatus: 'open' | 'done') {
    // optimistic
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, status: nextStatus } : r));
    const res = await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    if (!res.ok) {
      // rollback
      const data = await res.json();
      alert(data.error || 'Update failed');
      load();
    }
  }

  const open = items.filter((i) => i.status === 'open');
  const done = items.filter((i) => i.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold text-white">Tasks from Mother Nature Agency</h1>
        <p className="text-[13px] text-white/50 mt-1">
          Things we need from you to keep your content engine humming. Check them off when you're done and we'll get notified.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-8 text-center text-white/50">
          Loading your list…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card p-8 text-center text-white/50">
          <div className="text-[14px] font-semibold text-white/70">You're all caught up</div>
          <div className="text-[12px] mt-1">We'll post new requests here when we need anything.</div>
        </div>
      )}

      {!loading && open.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Open ({open.length})
          </div>
          {open.map((r) => (
            <div key={r.id} className="glass-card p-4 flex items-start gap-3">
              <button
                onClick={() => toggle(r.id, 'done')}
                className="mt-0.5 w-6 h-6 rounded-md border-2 border-white/30 hover:border-emerald-400 flex items-center justify-center shrink-0 transition-colors"
                aria-label="Mark done"
              />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-white">{r.title}</div>
                {r.description && (
                  <div className="text-[12px] text-white/50 mt-1 whitespace-pre-wrap leading-relaxed">
                    {r.description}
                  </div>
                )}
                <div className="text-[10px] text-white/30 mt-2">
                  Added {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && done.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Completed ({done.length})
          </div>
          {done.map((r) => (
            <div key={r.id} className="glass-card p-4 flex items-start gap-3 opacity-60">
              <button
                onClick={() => toggle(r.id, 'open')}
                className="mt-0.5 w-6 h-6 rounded-md border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0 text-white"
                aria-label="Mark open"
              >
                ✓
              </button>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-white/60 line-through">{r.title}</div>
                {r.description && (
                  <div className="text-[12px] text-white/40 mt-1 line-through">{r.description}</div>
                )}
                {r.completed_at && (
                  <div className="text-[10px] text-white/30 mt-2">
                    Completed {new Date(r.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
