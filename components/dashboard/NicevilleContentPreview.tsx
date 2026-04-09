'use client';

/**
 * NicevilleContentPreview
 *
 * Mini calendar widget shown at the TOP of the Prime IV Niceville dashboard.
 * Pulls real content_calendar rows via /api/content-calendar and renders the
 * next ~21 days as a 3-week calendar strip, color-coded by approval status.
 *
 * No fabricated data. If the DB is empty we show an empty state pointing at
 * the Content Tracker's "Load Spring Reset" button.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

function parseTitle(raw: string | null) {
  if (!raw) return '';
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function NicevilleContentPreview({ clientName }: { clientName: string }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(clientName)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.items || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientName]);

  // Build a 3-week window starting from the current week's Sunday.
  const { weeks, byDay } = useMemo(() => {
    const today = startOfDay(new Date());
    // Back up to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    const weeksOut: Date[][] = [days.slice(0, 7), days.slice(7, 14), days.slice(14, 21)];

    const byDayOut: Record<string, ContentItem[]> = {};
    for (const it of items) {
      const key = it.post_date.slice(0, 10);
      if (!byDayOut[key]) byDayOut[key] = [];
      byDayOut[key].push(it);
    }
    return { weeks: weeksOut, byDay: byDayOut };
  }, [items]);

  const windowStart = weeks[0][0];
  const windowEnd = weeks[2][6];
  const windowItems = items.filter((i) => {
    const d = new Date(i.post_date);
    return d >= windowStart && d <= windowEnd;
  });
  const countByStatus = windowItems.reduce<Record<string, number>>((acc, it) => {
    const s = it.client_approval_status || 'pending_review';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-[16px] font-bold text-white">Content Calendar · next 3 weeks</h3>
          <p className="text-[11px] text-white/70 mt-0.5">
            Pulled live from the Content Tracker. Click through to approve or edit.
          </p>
        </div>
        <Link
          href="/content"
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
        >
          Open Content Tracker →
        </Link>
      </div>

      {loading && (
        <div className="text-center text-white/50 py-10 text-sm">Loading calendar…</div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
          <div className="text-[13px] font-semibold text-white/85">No content loaded yet</div>
          <div className="text-[11px] text-white/70 mt-1 mb-3">
            Head to the Content Tracker and click "Load Spring Reset" to seed the 45 day plan.
          </div>
          <Link
            href="/content"
            className="inline-block text-[11px] font-bold text-white px-4 py-2 rounded-lg"
            style={{ background: 'linear-gradient(135deg,#1c3d6e,#3a7ab5)' }}
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
                <span>{label} · {countByStatus[s] || 0}</span>
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
              const isToday = iso === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={iso}
                  className={`min-h-[72px] rounded-lg border p-1.5 flex flex-col gap-1 ${isToday ? 'border-white bg-white/15' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="text-[9px] font-bold text-white/50">{day.getDate()}</div>
                  {posts.slice(0, 3).map((p) => {
                    const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                    return (
                      <div key={p.id} className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: STATUS_DOT[status] }} />
                        <span className="text-[9px] leading-tight text-white/85 line-clamp-2">{parseTitle(p.title)}</span>
                      </div>
                    );
                  })}
                  {posts.length > 3 && (
                    <div className="text-[9px] text-white/50">+{posts.length - 3} more</div>
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
