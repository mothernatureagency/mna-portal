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
  client_approval_status: ApprovalStatus | null;
};

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

  const todayStr = new Date().toISOString().slice(0, 10);

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
        <Link
          href="/content"
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
        >
          Open Content Tracker →
        </Link>
      </div>

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
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[9px] font-bold uppercase tracking-wider text-white/50 text-center pb-1">{d}</div>
            ))}
            {weeks.flat().map((day) => {
              const iso = day.toISOString().slice(0, 10);
              const posts = byDay[iso] || [];
              const isToday = iso === todayStr;
              const isCurrentMonth = day.getMonth() === month;

              return (
                <div
                  key={iso}
                  className={`min-h-[72px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${
                    isToday
                      ? 'border-white bg-white/15'
                      : isCurrentMonth
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className={`text-[9px] font-bold ${isCurrentMonth ? 'text-white/50' : 'text-white/25'}`}>
                    {day.getDate()}
                  </div>
                  {posts.slice(0, 3).map((p) => {
                    const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                    return (
                      <div key={p.id} className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: STATUS_DOT[status] }} />
                        <span className="text-[8px] leading-tight text-white/80 line-clamp-2">
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
