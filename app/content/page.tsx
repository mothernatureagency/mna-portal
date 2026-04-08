'use client';
import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type ContentItem = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  status: string;
  assigned_role: string | null;
};

function parseTitle(raw: string | null) {
  if (!raw) return { phase: '', title: '', hook: '', cta: '' };
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const phase = phaseMatch ? phaseMatch[1] : '';
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  const title = hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
  let hook = '';
  let cta = '';
  if (hookIdx >= 0) {
    const afterHook = rest.slice(hookIdx + ' — Hook:'.length);
    const ctaIdx = afterHook.indexOf('| CTA:');
    if (ctaIdx >= 0) {
      hook = afterHook.slice(0, ctaIdx).trim();
      cta = afterHook.slice(ctaIdx + '| CTA:'.length).trim();
    } else {
      hook = afterHook.trim();
    }
  }
  return { phase, title, hook, cta };
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export default function ContentPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!activeClient?.name) return;
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, [activeClient?.name]);

  const platforms = Array.from(new Set(items.map((i) => i.platform)));
  const shown = filter === 'all' ? items : items.filter((i) => i.platform === filter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>grid_view</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Content Tracker</h1>
        </div>
        <p className="text-white/60 mt-1">
          {activeClient?.name || 'No client selected'} · {items.length} posts
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${filter === 'all' ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          All ({items.length})
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${filter === p ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            {p} ({items.filter((i) => i.platform === p).length})
          </button>
        ))}
      </div>

      {loading && <div className="glass-card p-6 text-white/70">Loading…</div>}

      {!loading && shown.length === 0 && (
        <div className="glass-card p-8 text-center text-white/60">
          No content yet. Go to <strong className="text-white">Agents → Content Calendar</strong> and click "Load into Pinecrest" or ask the agent to build a plan.
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((it) => {
            const parsed = parseTitle(it.title);
            return (
              <div key={it.id} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/60">{fmtDate(it.post_date)}</div>
                  {parsed.phase && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 uppercase tracking-wider">{parsed.phase}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.platform}</span>
                  {it.content_type && <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.content_type}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-200">{it.status}</span>
                </div>
                <div className="text-white font-bold text-base leading-tight">{parsed.title || 'Untitled'}</div>
                {parsed.hook && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-0.5">Hook</div>
                    <div className="text-white/85 text-sm leading-snug">"{parsed.hook}"</div>
                  </div>
                )}
                {parsed.cta && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-0.5">CTA</div>
                    <div className="text-white/85 text-sm">{parsed.cta}</div>
                  </div>
                )}
                {it.assigned_role && (
                  <div className="pt-2 border-t border-white/10 text-xs text-white/50">
                    Owner: {it.assigned_role}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
