'use client';

/**
 * MonthlyContentCalendar — Month-to-month content calendar with arrow navigation.
 * Pulls from /api/content-calendar for a given client.
 * Reusable across any client dashboard.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import React from 'react';
import { driveThumbnailUrl, driveViewUrl } from '@/lib/drive';

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
  assigned_role: string | null;
  client_approval_status: ApprovalStatus | null;
  photo_drive_url?: string | null;
  client_comments?: string | null;
  mna_comments?: string | null;
  client_visible?: boolean | null;
};

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  drafting: 'Drafting',
  pending_review: 'Ready for review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  scheduled: 'Scheduled',
};

// PDM brand cascade posts are auto-approved reference items — styled dark
// blue so MNA sees them at a glance but doesn't confuse them for our own
// work that needs approval. We detect via either the assigned_role flag
// (new posts from the seed route) OR the title prefix [PDM ...] (works
// retroactively on posts seeded before the flag existed).
function isPdmItem(item: ContentItem): boolean {
  if (item.assigned_role === 'PDM (Brand)') return true;
  const t = item.title || '';
  return /^\[\s*PDM\b/i.test(t);
}

const STATUS_DOT: Record<ApprovalStatus, string> = {
  drafting:          '#9ca3af',
  pending_review:    '#f59e0b',
  approved:          '#10b981',
  changes_requested: '#f43f5e',
  scheduled:         '#0ea5e9',
};

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: '📸',
  Facebook: '📘',
  TikTok: '🎵',
  LinkedIn: '💼',
};

function parseTitle(raw: string | null) {
  if (!raw) return '';
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
}

export default function MonthlyContentCalendar({
  clientName,
  gradientFrom,
  gradientTo,
  interactive = false,
}: {
  clientName: string;
  gradientFrom: string;
  gradientTo: string;
  // When true, clicking a post opens an editable card popup and clicking an
  // empty day starts a new post. Off by default so the Niceville dashboard's
  // calendar keeps its read-only/multi-select behavior.
  interactive?: boolean;
}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month

  // Interactive mode: post-card popup + new-post composer
  const [activePost, setActivePost] = useState<ContentItem | null>(null);
  const [newPostDate, setNewPostDate] = useState<string | null>(null);
  const [newPostPlatform, setNewPostPlatform] = useState('Instagram');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBusy, setNewPostBusy] = useState(false);

  // Per-post AI / edit state (keyed off the active post)
  const [writing, setWriting] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const [redoGuidance, setRedoGuidance] = useState('');
  const [captionEditing, setCaptionEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [photoDraft, setPhotoDraft] = useState('');
  const [photoEditing, setPhotoEditing] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  // Keep the open popup in sync with the latest items (after AI writes etc.)
  function syncActive(updated: ContentItem) {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setActivePost((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
  }

  function openPost(p: ContentItem) {
    setActivePost(p);
    setRedoOpen(false);
    setRedoGuidance('');
    setCaptionEditing(false);
    setCaptionDraft(p.caption || '');
    setPhotoEditing(false);
    setPhotoDraft(p.photo_drive_url || '');
    setCommentDraft('');
  }

  function openNewPost(iso: string) {
    setNewPostDate(iso);
    setNewPostPlatform('Instagram');
    setNewPostTitle('');
  }

  async function patchPost(id: string, patch: Record<string, any>) {
    const res = await fetch('/api/content-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.item) syncActive(data.item);
    return res.ok;
  }

  async function writeCopy(id: string, guidance?: string) {
    setWriting(true);
    try {
      const res = await fetch(`/api/content-calendar/${id}/write-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guidance ? { guidance } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.item) {
        syncActive(data.item);
        setCaptionDraft(data.item.caption || '');
        setRedoOpen(false);
        setRedoGuidance('');
      }
    } finally {
      setWriting(false);
    }
  }

  async function approvePost(id: string) {
    await patchPost(id, { client_approval_status: 'approved', client_comments: null });
  }
  async function requestChangesPost(id: string) {
    if (!commentDraft.trim()) return;
    await patchPost(id, { client_approval_status: 'changes_requested', client_comments: commentDraft.trim() });
    setCommentDraft('');
  }

  async function createPost() {
    if (!newPostDate || !newPostTitle.trim()) return;
    setNewPostBusy(true);
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          items: [{
            post_date: newPostDate,
            platform: newPostPlatform,
            title: newPostTitle.trim(),
            status: 'Draft',
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const created = data.inserted?.[0];
      if (res.ok && created) {
        setItems((prev) => [...prev, created]);
        setNewPostDate(null);
        openPost(created); // jump straight into the card so they can write copy
      }
    } finally {
      setNewPostBusy(false);
    }
  }

  // Drag-to-reschedule: track the post being dragged and the day being hovered
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);

  // Multi-day selection → "Generate Posts" for those days
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genPlatform, setGenPlatform] = useState('Instagram');
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  function toggleDay(iso: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }
  function clearSelection() { setSelectedDays(new Set()); }

  async function movePost(postId: string, toIso: string) {
    // Optimistic update
    setItems((prev) => prev.map((p) => p.id === postId ? { ...p, post_date: toIso } : p));
    await fetch('/api/content-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, post_date: toIso }),
    }).catch(() => {});
  }

  async function generatePosts() {
    const days = Array.from(selectedDays).sort();
    if (days.length === 0 || !genTopic.trim()) return;
    setGenBusy(true); setGenMsg('');
    try {
      const res = await fetch('/api/content-calendar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          days,
          topic: genTopic.trim(),
          platform: genPlatform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      setItems((prev) => [...prev, ...(data.posts || [])]);
      setGenMsg(`Generated ${data.posts?.length || 0} posts.`);
      clearSelection();
      setGenTopic('');
      setTimeout(() => { setGeneratorOpen(false); setGenMsg(''); }, 1400);
    } catch (e: any) {
      setGenMsg(`Error: ${e.message}`);
    } finally {
      setGenBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(clientName)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.items || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientName]);

  // Current displayed month
  const displayDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const monthLabel = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const { weeks, byDay, monthItems } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    // Build grid starting from Sunday before month start
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startDow);

    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
    const days: Date[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }

    const weeksOut: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksOut.push(days.slice(i, i + 7));
    }

    // Index items by date
    const byDayOut: Record<string, ContentItem[]> = {};
    for (const it of items) {
      const key = it.post_date.slice(0, 10);
      if (!byDayOut[key]) byDayOut[key] = [];
      byDayOut[key].push(it);
    }

    // Items in this month
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const monthItemsOut = items.filter((i) => i.post_date >= monthStart && i.post_date <= monthEnd);

    return { weeks: weeksOut, byDay: byDayOut, monthItems: monthItemsOut };
  }, [items, year, month]);

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const countByStatus = monthItems.reduce<Record<string, number>>((acc, it) => {
    const s = it.client_approval_status || 'pending_review';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-card p-6">
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonthOffset((o) => o - 1)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors text-[16px]"
          >
            ←
          </button>
          <div>
            <h3 className="text-[16px] font-bold text-white">{monthLabel}</h3>
            <p className="text-[11px] text-white/50">{monthItems.length} posts this month</p>
          </div>
          <button
            onClick={() => setMonthOffset((o) => o + 1)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors text-[16px]"
          >
            →
          </button>
          {monthOffset !== 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="text-[10px] font-semibold text-white/50 hover:text-white/80 ml-1"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedDays.size > 0 && (
            <>
              <span className="text-[10px] text-white/60">{selectedDays.size} day{selectedDays.size === 1 ? '' : 's'} selected</span>
              <button
                onClick={clearSelection}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Clear
              </button>
              <button
                onClick={() => setGeneratorOpen(true)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                ✨ Generate Posts
              </button>
            </>
          )}
          <Link
            href="/content"
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            Open Content Tracker →
          </Link>
        </div>
      </div>

      {/* Tip when nothing is selected */}
      {interactive ? (
        !loading && (
          <div className="text-[10px] text-white/45 mb-3">
            Tip · Click a post to open it and write/approve copy. Click an empty day to start a new post.
          </div>
        )
      ) : (
        selectedDays.size === 0 && !loading && items.length > 0 && (
          <div className="text-[10px] text-white/45 mb-3">
            Tip · Click a day to select it, drag a post to move it, or click "Generate Posts" after selecting days.
          </div>
        )
      )}

      {/* Generator dialog */}
      {generatorOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !genBusy && setGeneratorOpen(false)}>
          <div
            className="max-w-md w-full rounded-2xl p-5"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white font-bold mb-3">Generate Posts for {selectedDays.size} day{selectedDays.size === 1 ? '' : 's'}</div>
            <div className="text-[11px] text-white/55 mb-3">
              AI will draft a post for each selected day based on the topic you give it. You can edit each one afterward.
            </div>
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Topic / angle (e.g. spring detox, new member offer)"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <select
                value={genPlatform}
                onChange={(e) => setGenPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              >
                <option className="bg-slate-900">Instagram</option>
                <option className="bg-slate-900">TikTok</option>
                <option className="bg-slate-900">Facebook</option>
                <option className="bg-slate-900">LinkedIn</option>
              </select>
            </div>
            {genMsg && <div className="text-[11px] text-white/75 mt-2">{genMsg}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setGeneratorOpen(false)}
                disabled={genBusy}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={generatePosts}
                disabled={genBusy || !genTopic.trim()}
                className="text-[11px] font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                {genBusy ? 'Generating…' : `✨ Generate ${selectedDays.size} post${selectedDays.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-white/50 py-10 text-sm">Loading calendar...</div>
      )}

      {!loading && items.length === 0 && !interactive && (
        <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
          <div className="text-[13px] font-semibold text-white/85">No content loaded yet</div>
          <div className="text-[11px] text-white/70 mt-1 mb-3">
            Head to the Content Tracker to seed the VRBO Launch playbook.
          </div>
          <Link
            href="/content"
            className="inline-block text-[11px] font-bold text-white px-4 py-2 rounded-lg"
            style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
          >
            Go to Content Tracker
          </Link>
        </div>
      )}

      {!loading && (items.length > 0 || interactive) && (
        <>
          {/* Status legend */}
          <div className="flex items-center gap-4 mb-3 flex-wrap text-[10px] text-white/70">
            {(
              [
                ['approved', 'Approved'],
                ['scheduled', 'Scheduled'],
                ['pending_review', 'Ready for review'],
                ['changes_requested', 'Changes requested'],
                ['drafting', 'Drafting'],
              ] as [ApprovalStatus, string][]
            ).map(([s, label]) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[s] }} />
                <span>{label} {countByStatus[s] ? `· ${countByStatus[s]}` : ''}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: '#0b2547', border: '1px solid #1e3a8a' }} />
              <span className="text-blue-200">PDM · Brand Cascade (reference)</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[9px] font-bold uppercase tracking-wider text-white/50 text-center pb-1">{d}</div>
            ))}
            {weeks.flat().map((day) => {
              const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
              const posts = byDay[iso] || [];
              const isToday = iso === todayStr;
              const isCurrentMonth = day.getMonth() === month;

              const isSelected = selectedDays.has(iso);
              const isDragTarget = dragOverIso === iso;
              return (
                <div
                  key={iso}
                  onClick={() => {
                    if (!isCurrentMonth) return;
                    if (interactive) { if (posts.length === 0) openNewPost(iso); }
                    else toggleDay(iso);
                  }}
                  onDragOver={(e) => { if (draggingId) { e.preventDefault(); setDragOverIso(iso); } }}
                  onDragLeave={() => setDragOverIso((cur) => cur === iso ? null : cur)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId) {
                      movePost(draggingId, iso);
                      setDraggingId(null);
                      setDragOverIso(null);
                    }
                  }}
                  className={`min-h-[72px] rounded-lg border p-1.5 flex flex-col gap-1 cursor-pointer transition-all ${
                    isToday
                      ? 'border-white bg-white/15'
                      : isCurrentMonth
                      ? 'border-white/10 bg-white/5 hover:bg-white/10'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                  style={
                    isDragTarget
                      ? { outline: `2px dashed ${gradientTo}`, outlineOffset: 2 }
                      : isSelected
                      ? { background: `linear-gradient(135deg,${gradientFrom}33,${gradientTo}22)`, borderColor: gradientTo, borderWidth: 2 }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-[9px] font-bold ${isCurrentMonth ? 'text-white/50' : 'text-white/25'}`}>
                      {day.getDate()}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: gradientTo }}>
                        check_circle
                      </span>
                    )}
                  </div>
                  {posts.slice(0, 3).map((p) => {
                    const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                    const pdm = isPdmItem(p);
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => { setDraggingId(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { setDraggingId(null); setDragOverIso(null); }}
                        onClick={(e) => { e.stopPropagation(); if (interactive) openPost(p); }}
                        className="flex items-start gap-1 rounded px-1 py-0.5 cursor-grab active:cursor-grabbing"
                        style={{
                          ...(pdm ? { background: '#0b2547', border: '1px solid #1e3a8a' } : {}),
                          opacity: draggingId === p.id ? 0.4 : 1,
                        }}
                        title={pdm ? 'PDM · Brand Cascade · drag to reschedule' : 'Drag to reschedule'}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0"
                          style={{ background: pdm ? '#60a5fa' : STATUS_DOT[status] }}
                        />
                        <span className={`text-[8px] leading-tight line-clamp-2 ${pdm ? 'text-blue-100 font-semibold' : 'text-white/80'}`}>
                          {pdm && <span className="text-blue-300 font-bold">PDM · </span>}
                          {PLATFORM_EMOJI[p.platform] || ''} {parseTitle(p.title)}
                        </span>
                      </div>
                    );
                  })}
                  {posts.length > 3 && (
                    <div className="text-[8px] text-white/40">+{posts.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* New-post composer (interactive mode) */}
      {interactive && newPostDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !newPostBusy && setNewPostDate(null)}>
          <div
            className="max-w-md w-full rounded-2xl p-5"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white font-bold mb-1">New post</div>
            <div className="text-[11px] text-white/55 mb-3">
              {new Date(`${newPostDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Post title / topic"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newPostTitle.trim()) createPost(); }}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <select
                value={newPostPlatform}
                onChange={(e) => setNewPostPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              >
                <option className="bg-slate-900">Instagram</option>
                <option className="bg-slate-900">TikTok</option>
                <option className="bg-slate-900">Facebook</option>
                <option className="bg-slate-900">LinkedIn</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setNewPostDate(null)}
                disabled={newPostBusy}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                disabled={newPostBusy || !newPostTitle.trim()}
                className="text-[11px] font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                {newPostBusy ? 'Creating…' : 'Create & write copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post card popup (interactive mode) */}
      {interactive && activePost && (() => {
        const p = activePost;
        const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
        const thumb = driveThumbnailUrl(p.photo_drive_url);
        const view = driveViewUrl(p.photo_drive_url);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActivePost(null)}>
            <div
              className="max-w-lg w-full rounded-2xl p-5 max-h-[88vh] overflow-y-auto"
              style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                    {new Date(`${p.post_date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}{PLATFORM_EMOJI[p.platform] || ''} {p.platform}
                  </div>
                  <div className="text-white font-bold text-[15px] mt-0.5 leading-tight">{parseTitle(p.title) || 'Untitled'}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `${STATUS_DOT[status]}22`, color: STATUS_DOT[status], border: `1px solid ${STATUS_DOT[status]}55` }}>
                  {APPROVAL_LABEL[status]}
                </span>
              </div>

              {/* Photo */}
              <div className="mb-3">
                {thumb && !photoEditing && (
                  <a href={view!} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-white/10 mb-2">
                    <img src={thumb} alt="" className="w-full h-40 object-cover opacity-90 hover:opacity-100 transition-opacity" />
                  </a>
                )}
                {photoEditing ? (
                  <div className="flex gap-2">
                    <input
                      value={photoDraft}
                      onChange={(e) => setPhotoDraft(e.target.value)}
                      placeholder="Paste Google Drive share link"
                      className="flex-1 text-[11px] rounded-lg bg-white/5 border border-white/15 p-2 text-white placeholder:text-white/30 outline-none"
                    />
                    <button
                      onClick={async () => { await patchPost(p.id, { photo_drive_url: photoDraft.trim() || null }); setPhotoEditing(false); }}
                      className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-emerald-500/80 text-white"
                    >Save</button>
                    <button onClick={() => setPhotoEditing(false)} className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-white/10 text-white/80">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setPhotoDraft(p.photo_drive_url || ''); setPhotoEditing(true); }}
                    className="text-[10px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{view ? 'edit' : 'link'}</span>
                    {view ? 'Edit photo link' : 'Add photo (Drive link)'}
                  </button>
                )}
              </div>

              {/* Caption */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Caption</div>
                  {p.caption && !captionEditing && (
                    <button
                      onClick={() => { setCaptionDraft(p.caption || ''); setCaptionEditing(true); }}
                      className="text-[10px] text-white/40 hover:text-white inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span> Edit
                    </button>
                  )}
                </div>
                {captionEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      rows={8}
                      className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-3 text-white outline-none leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => { await patchPost(p.id, { caption: captionDraft }); setCaptionEditing(false); }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/80 text-white"
                      >Save caption</button>
                      <button onClick={() => setCaptionEditing(false)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80">Cancel</button>
                    </div>
                  </div>
                ) : p.caption ? (
                  <div className="text-white/85 text-xs whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">{p.caption}</div>
                ) : (
                  <div className="text-white/40 text-xs italic">No caption yet — generate one with AI below.</div>
                )}
              </div>

              {/* AI write / redo */}
              <div className="mb-3">
                {!p.caption ? (
                  <button
                    onClick={() => writeCopy(p.id)}
                    disabled={writing}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
                  >
                    {writing ? 'Writing…' : '✨ Write copy with AI'}
                  </button>
                ) : redoOpen ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">What should change?</div>
                    <textarea
                      value={redoGuidance}
                      onChange={(e) => setRedoGuidance(e.target.value)}
                      placeholder="e.g. more casual, shorter, focus on the promo, less salesy…"
                      rows={2}
                      className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => writeCopy(p.id, redoGuidance)}
                        disabled={writing}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                        style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
                      >
                        {writing ? 'Rewriting…' : 'Regenerate'}
                      </button>
                      <button onClick={() => { setRedoOpen(false); setRedoGuidance(''); }} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRedoOpen(true)}
                    disabled={writing}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white/70 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50"
                  >
                    ✨ Redo copy with guidance
                  </button>
                )}
              </div>

              {/* Client comments (if any) */}
              {p.client_comments && (
                <div className="text-xs bg-rose-400/10 border border-rose-400/30 rounded-lg p-2 mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-rose-200/80 font-semibold mb-1">Client comments</div>
                  <div className="text-rose-100 whitespace-pre-wrap">{p.client_comments}</div>
                </div>
              )}

              {/* Approval controls */}
              {p.caption && status !== 'scheduled' && (
                <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => approvePost(p.id)}
                      disabled={status === 'approved'}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/80 text-white disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => requestChangesPost(p.id)}
                      disabled={!commentDraft.trim()}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-500/70 text-white disabled:opacity-40"
                    >
                      Request changes
                    </button>
                    <button
                      onClick={async () => { await patchPost(p.id, { client_visible: !p.client_visible }); }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 ${p.client_visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/60 border border-white/15'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{p.client_visible ? 'visibility' : 'visibility_off'}</span>
                      {p.client_visible ? 'Live to client' : 'Push to client'}
                    </button>
                  </div>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Comment (required to request changes)"
                    rows={2}
                    className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30 outline-none"
                  />
                </div>
              )}

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
                <Link href="/content" className="text-[10px] text-white/45 hover:text-white/80">Open in Content Tracker →</Link>
                <button onClick={() => setActivePost(null)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
