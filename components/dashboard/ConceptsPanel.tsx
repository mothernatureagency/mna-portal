'use client';

/**
 * Concepts panel — per-client idea bank that the AI Generate-Posts
 * endpoint reads from. Each concept has a title, optional body, optional
 * suggested date, and optional tags. When generation runs, recent +
 * upcoming concepts get fed into the prompt as inspiration.
 */

import React, { useEffect, useState } from 'react';

type Concept = {
  id: string;
  title: string;
  body: string | null;
  suggested_date: string | null;
  tags: string | null;
  used_at: string | null;
  created_at: string;
};

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ConceptsPanel({
  clientId,
  gradientFrom,
  gradientTo,
}: {
  clientId: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', suggested_date: '', tags: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/content-concepts?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setConcepts(d.concepts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/content-concepts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          title: draft.title.trim(),
          body: draft.body.trim() || undefined,
          suggestedDate: draft.suggested_date || undefined,
          tags: draft.tags.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok && d.concept) setConcepts((prev) => [d.concept, ...prev]);
      setDraft({ title: '', body: '', suggested_date: '', tags: '' });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setConcepts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/content-concepts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lightbulb</span>
            Concepts
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            {concepts.length} idea{concepts.length === 1 ? '' : 's'} · the AI Generate Posts flow reads these for inspiration
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
          style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
        >
          {showForm ? 'Cancel' : '+ New Concept'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={add}
          className="rounded-xl p-3 mb-3 space-y-2"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Concept title (e.g. NAD+ vs B12 explainer)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          <textarea
            placeholder="Notes / angle / details (optional — give the AI something to chew on)"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={draft.suggested_date}
              onChange={(e) => setDraft({ ...draft, suggested_date: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              placeholder="Suggested date (optional)"
            />
            <input
              type="text"
              placeholder="Tags (e.g. seasonal, membership)"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !draft.title.trim()}
            className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
          >
            {busy ? 'Saving…' : 'Save Concept'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-[12px] text-white/55 py-6 text-center">Loading…</div>
      ) : concepts.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-6">
          No concepts yet. Drop in ideas, themes, or tied dates — the Generate Posts AI will read them.
        </div>
      ) : (
        <ul className="space-y-2">
          {concepts.map((c) => (
            <li
              key={c.id}
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `3px solid ${gradientFrom}`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className="text-[13px] font-bold text-white">{c.title}</div>
                    {c.suggested_date && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})`, color: '#fff' }}
                      >
                        {fmtDate(c.suggested_date)}
                      </span>
                    )}
                    {c.tags && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                      >
                        {c.tags}
                      </span>
                    )}
                  </div>
                  {c.body && (
                    <div className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap">{c.body}</div>
                  )}
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-white/30 hover:text-rose-400 shrink-0"
                  title="Delete concept"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
