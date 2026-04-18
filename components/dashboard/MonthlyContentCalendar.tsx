'use client';

/**
 * MonthlyContentCalendar — Month-to-month content calendar with arrow navigation.
 * Pulls from /api/content-calendar for a given client.
 * Reusable across any client dashboard.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import React from 'react';

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
}: {
  clientName: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month

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
      {selectedDays.size === 0 && !loading && items.length > 0 && (
        <div className="text-[10px] text-white/45 mb-3">
          Tip · Click a day to select it, drag a post to move it, or click "Generate Posts" after selecting days.
        </div>
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

      {!loading && items.length === 0 && (
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

      {!loading && items.length > 0 && (
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
                  onClick={() => { if (isCurrentMonth) toggleDay(iso); }}
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
                        onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}
