'use client';

import { useEffect, useMemo, useState } from 'react';
import { driveViewUrl } from '@/lib/drive';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

function toDateOnly(s: string): string {
  if (!s) return s;
  if (s.length === 10) return s;
  try {
    const d = new Date(s);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  } catch { return s.slice(0, 10); }
}

type ApprovalStatus =
  | 'drafting'
  | 'pending_review'
  | 'approved'
  | 'changes_requested'
  | 'scheduled';

type ContentItem = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  caption: string | null;
  client_approval_status: ApprovalStatus | null;
  client_comments: string | null;
  mna_comments: string | null;
  photo_drive_url: string | null;
};

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; bg: string; text: string }> = {
  drafting:          { label: 'Drafting',          bg: 'rgba(255,255,255,0.1)',  text: 'rgba(255,255,255,0.5)' },
  pending_review:    { label: 'Ready for review',  bg: 'rgba(251,191,36,0.2)',   text: '#fbbf24' },
  approved:          { label: 'Approved',          bg: 'rgba(52,211,153,0.2)',   text: '#34d399' },
  changes_requested: { label: 'Changes requested', bg: 'rgba(251,113,133,0.2)',  text: '#fb7185' },
  scheduled:         { label: 'Scheduled',         bg: 'rgba(56,189,248,0.2)',   text: '#38bdf8' },
};

function parseTitle(raw: string | null) {
  if (!raw) return { phase: '', title: '' };
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const phase = phaseMatch ? phaseMatch[1] : '';
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return { phase, title: hookIdx >= 0 ? rest.slice(0, hookIdx) : rest };
}

function monthKey(d: string) {
  return d.slice(0, 7); // YYYY-MM
}

function formatMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysInMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function firstWeekday(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).getDay();
}

export default function ClientCalendarPage() {
  const { client } = useClientPortal();
  const [items, _setItems] = useState<ContentItem[]>([]);
  function setItems(updater: ContentItem[] | ((prev: ContentItem[]) => ContentItem[])) {
    _setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((it) => ({ ...it, post_date: toDateOnly(it.post_date) }));
    });
  }
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(client.name)}&visible=1`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, [client.name]);

  // Group by month for the calendar view
  const months = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const it of items) {
      const k = monthKey(it.post_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  async function patchItem(id: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/content-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data.item } : it)));
  }

  async function approve(id: string) {
    try { await patchItem(id, { client_approval_status: 'approved' }); }
    catch (e: any) { alert(e.message); }
  }

  async function requestChanges(id: string) {
    const comment = commentDraft[id]?.trim();
    if (!comment) { alert('Please describe what you want changed.'); return; }
    try {
      await patchItem(id, { client_approval_status: 'changes_requested', client_comments: comment });
      setCommentDraft((d) => ({ ...d, [id]: '' }));
      setActiveId(null);
    } catch (e: any) { alert(e.message); }
  }

  const activeItem = items.find((i) => i.id === activeId) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold text-white">Content Calendar</h1>
          <p className="text-[13px] text-white/50 mt-1">
            Review each post, approve it, or leave a comment if you want changes.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${view === 'grid' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${view === 'list' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
          >
            List
          </button>
        </div>
      </div>

      {loading && <div className="glass-card p-8 text-center text-white/50">Loading your calendar…</div>}

      {!loading && items.length === 0 && (
        <div className="glass-card p-8 text-center text-white/50">
          <div className="text-[14px] font-semibold text-white/70">No posts in your calendar yet</div>
          <div className="text-[12px] mt-1">Your agency will share content here for your review.</div>
        </div>
      )}

      {/* Calendar grid view */}
      {!loading && view === 'grid' && months.map(([key, monthItems]) => {
        const total = daysInMonth(key);
        const offset = firstWeekday(key);
        const byDay: Record<number, ContentItem[]> = {};
        for (const it of monthItems) {
          const day = Number(it.post_date.slice(8, 10));
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(it);
        }
        return (
          <div key={key} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-bold text-white">{formatMonth(key)}</div>
              <div className="text-[11px] text-white/40">{monthItems.length} posts</div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                <div key={w} className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-center pb-2">{w}</div>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: total }).map((_, i) => {
                const day = i + 1;
                const posts = byDay[day] || [];
                return (
                  <div
                    key={day}
                    className="min-h-[110px] rounded-xl border border-white/10 p-1.5 flex flex-col gap-1 bg-white/5"
                  >
                    <div className="text-[10px] font-bold text-white/40">{day}</div>
                    {posts.map((p) => {
                      const parsed = parseTitle(p.title);
                      const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                      const style = APPROVAL_STYLES[status];
                      return (
                        <button
                          key={p.id}
                          onClick={() => setActiveId(p.id)}
                          className="group relative text-left rounded-lg overflow-hidden border border-white/10 hover:ring-2 hover:ring-white/20 transition"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                          <div className="px-1.5 py-1">
                            <div className="text-[9px] font-bold text-white/80 truncate">{parsed.title}</div>
                            <div
                              className="text-[8px] font-bold mt-0.5 inline-block px-1.5 py-0.5 rounded"
                              style={{ background: style.bg, color: style.text }}
                            >
                              {style.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* List view */}
      {!loading && view === 'list' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const parsed = parseTitle(it.title);
            const status = (it.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[status];
            const driveLink = driveViewUrl(it.photo_drive_url);
            return (
              <div key={it.id} className="glass-card overflow-hidden flex flex-col">
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/40">
                    <span>{new Date(`${it.post_date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span>{it.platform} · {it.content_type || 'Post'}</span>
                  </div>
                  <div className="text-[15px] font-bold text-white leading-tight">{parsed.title}</div>
                  <div className="flex items-center gap-2">
                    <div
                      className="inline-block text-[11px] font-bold px-2 py-1 rounded"
                      style={{ background: style.bg, color: style.text }}
                    >
                      {style.label}
                    </div>
                    {driveLink && (
                      <a
                        href={driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_library</span>
                        View Photo
                      </a>
                    )}
                  </div>
                  {it.caption && (
                    <div className="text-[12px] text-white/60 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10 max-h-40 overflow-y-auto">
                      {it.caption}
                    </div>
                  )}
                  {status !== 'scheduled' && (
                    <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(it.id)}
                          disabled={status === 'approved'}
                          className="flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold bg-emerald-600 text-white disabled:opacity-40"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => requestChanges(it.id)}
                          className="flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold bg-rose-500 text-white"
                        >
                          Request changes
                        </button>
                      </div>
                      <textarea
                        value={commentDraft[it.id] || ''}
                        onChange={(e) => setCommentDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                        placeholder="Leave a comment (required if requesting changes)"
                        rows={2}
                        className="w-full text-[12px] rounded-lg border border-white/15 bg-white/5 text-white placeholder:text-white/30 p-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal when a calendar cell is clicked */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActiveId(null)}>
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl"
            style={{
              background: 'rgba(15,31,46,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(24px) saturate(180%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const parsed = parseTitle(activeItem.title);
              const status = (activeItem.client_approval_status || 'pending_review') as ApprovalStatus;
              const style = APPROVAL_STYLES[status];
              const driveLink = driveViewUrl(activeItem.photo_drive_url);
              return (
                <>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                        {new Date(`${activeItem.post_date.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {activeItem.platform} · {activeItem.content_type || 'Post'}
                      </div>
                      <button onClick={() => setActiveId(null)} className="text-white/40 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                    <div className="text-[20px] font-bold text-white">{parsed.title}</div>
                    <div className="flex items-center gap-2">
                      <div
                        className="inline-block text-[11px] font-bold px-2 py-1 rounded"
                        style={{ background: style.bg, color: style.text }}
                      >
                        {style.label}
                      </div>
                      {driveLink && (
                        <a href={driveLink} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_library</span>
                          View Photo
                        </a>
                      )}
                    </div>
                    {activeItem.caption && (
                      <div className="text-[13px] text-white/60 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10">
                        {activeItem.caption}
                      </div>
                    )}
                    {activeItem.client_comments && (
                      <div className="text-[12px] bg-rose-500/15 border border-rose-500/30 rounded-lg p-3">
                        <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">Your comments</div>
                        <div className="text-rose-300 whitespace-pre-wrap">{activeItem.client_comments}</div>
                      </div>
                    )}
                    {status !== 'scheduled' && (
                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <textarea
                          value={commentDraft[activeItem.id] || ''}
                          onChange={(e) => setCommentDraft((d) => ({ ...d, [activeItem.id]: e.target.value }))}
                          placeholder="Leave a comment (required if requesting changes)"
                          rows={3}
                          className="w-full text-[13px] rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-white/30 p-3"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(activeItem.id)}
                            disabled={status === 'approved'}
                            className="flex-1 rounded-xl px-4 py-3 text-[13px] font-semibold bg-emerald-600 text-white disabled:opacity-40"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => requestChanges(activeItem.id)}
                            className="flex-1 rounded-xl px-4 py-3 text-[13px] font-semibold bg-rose-500 text-white"
                          >
                            Request changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
