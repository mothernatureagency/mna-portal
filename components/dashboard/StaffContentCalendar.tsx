'use client';

/**
 * StaffContentCalendar — Sable's (info@) personalized top section.
 * Shows upcoming content across ALL clients in a unified 2-week view + her tasks.
 */

import React, { useEffect, useState } from 'react';
import { clients } from '@/lib/clients';

type ContentItem = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  caption: string | null;
  client_approval_status: string;
  clientName?: string;
};

type Task = { id: string; title: string; description: string | null; status: string };

const STATUS_COLORS: Record<string, string> = {
  drafting: '#94a3b8',
  pending_review: '#f59e0b',
  approved: '#059669',
  changes_requested: '#ef4444',
  scheduled: '#0ea5e9',
};

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: '📸',
  Facebook: '📘',
  TikTok: '🎵',
  LinkedIn: '💼',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

// Get the client's gradient color for visual coding
function getClientColor(clientName: string): string {
  const c = clients.find((cl) => cl.name === clientName);
  return c?.branding.gradientFrom || '#0c6da4';
}

function getClientShortName(clientName: string): string {
  const c = clients.find((cl) => cl.name === clientName);
  return c?.shortName || clientName;
}

export default function StaffContentCalendar() {
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch content for all clients that have content projects
    const clientNames = clients.filter((c) => c.id !== 'mna').map((c) => c.name);
    Promise.all(
      clientNames.map((name) =>
        fetch(`/api/content-calendar?client=${encodeURIComponent(name)}`)
          .then((r) => r.json())
          .then((d) => (d.items || []).map((item: ContentItem) => ({ ...item, clientName: name })))
          .catch(() => [])
      )
    ).then((results) => {
      const merged = results.flat().sort((a, b) => a.post_date.localeCompare(b.post_date));
      setAllContent(merged);
    });

    // Fetch MNA tasks
    fetch('/api/client-requests?clientId=mna')
      .then((r) => r.json())
      .then((d) => setTasks(d.items || []))
      .catch(() => {});
  }, []);

  // Filter to next 14 days
  const today = new Date();
  const twoWeeksOut = new Date(today);
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  const todayStr = today.toISOString().slice(0, 10);
  const twoWeeksStr = twoWeeksOut.toISOString().slice(0, 10);

  const upcomingContent = allContent.filter(
    (item) => item.post_date >= todayStr && item.post_date <= twoWeeksStr
  );

  // Group by date
  const byDate = new Map<string, ContentItem[]>();
  upcomingContent.forEach((item) => {
    const existing = byDate.get(item.post_date) || [];
    existing.push(item);
    byDate.set(item.post_date, existing);
  });

  const openTasks = tasks.filter((t) => t.status !== 'done');

  async function toggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'open' : 'done';
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  }

  return (
    <div className="space-y-6">
      {/* ── CONTENT CALENDAR ── */}
      <div>
        <SectionLabel>Content Calendar · All Clients · Next 14 Days</SectionLabel>
        <div className="glass-card p-5" style={{ borderLeft: '3px solid #0ea5e9' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[14px] font-bold text-white">Upcoming Content</div>
              <div className="text-[11px] text-white/50">{upcomingContent.length} posts across {new Set(upcomingContent.map((i) => i.clientName)).size} clients</div>
            </div>
            <div className="flex items-center gap-3">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[9px] text-white/50 capitalize">{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {upcomingContent.length === 0 && (
            <div className="text-[12px] text-white/50 italic py-3">No content scheduled in the next 14 days.</div>
          )}

          <div className="space-y-1">
            {Array.from(byDate.entries()).map(([date, items]) => {
              const d = new Date(date + 'T12:00:00');
              const isToday = date === todayStr;
              const dayLabel = isToday
                ? 'Today'
                : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

              return (
                <div key={date}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mt-3 mb-1.5 ${isToday ? 'text-sky-400' : 'text-white/40'}`}>
                    {dayLabel}
                  </div>
                  {items.map((item) => {
                    const isExpanded = expandedId === item.id;
                    const clientColor = getClientColor(item.clientName || '');
                    const statusColor = STATUS_COLORS[item.client_approval_status] || '#94a3b8';
                    // Extract just the title from the full title (which includes phase, hook, cta)
                    const displayTitle = item.title?.replace(/^\[.*?\]\s*/, '').split(' — ')[0] || 'Untitled';

                    return (
                      <div key={item.id}>
                        <div
                          className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                          <span className="text-[11px]">{PLATFORM_EMOJI[item.platform] || '📌'}</span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: clientColor + '22', color: clientColor }}
                          >
                            {getClientShortName(item.clientName || '')}
                          </span>
                          <span className="text-[12px] text-white/85 truncate flex-1">{displayTitle}</span>
                          <span className="text-[9px] text-white/40 shrink-0">{item.content_type}</span>
                        </div>

                        {isExpanded && item.caption && (
                          <div className="ml-8 mr-2 mb-2 p-3 rounded-lg text-[11px] text-white/70 leading-relaxed whitespace-pre-line"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            {item.caption.length > 300 ? item.caption.slice(0, 300) + '...' : item.caption}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MY TASKS ── */}
      <div>
        <SectionLabel>My Tasks</SectionLabel>
        <div className="glass-card p-5" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="text-[14px] font-bold text-white mb-3">
            Open Tasks
            <span className="text-white/50 font-normal ml-2">{openTasks.length}</span>
          </div>

          {openTasks.length === 0 && (
            <div className="text-[12px] text-white/50 italic py-2">No open tasks. Nice work!</div>
          )}

          <div className="space-y-1.5">
            {openTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
                onClick={() => toggleTask(task.id, task.status)}
              >
                <div className="w-4 h-4 rounded border border-white/30 mt-0.5 shrink-0 group-hover:border-white/60 transition-colors" />
                <div>
                  <div className="text-[12px] text-white/90">{task.title}</div>
                  {task.description && (
                    <div className="text-[10px] text-white/50 mt-0.5">{task.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
