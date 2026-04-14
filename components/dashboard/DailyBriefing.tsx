'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getTimeGreeting, getDateDisplay, DEFAULT_TIMEZONE } from '@/lib/timezone';

type BriefingData = {
  events: any[];
  overdue: any[];
  campaigns: any[];
  pendingContent: any[];
  summary: {
    todayEvents: number;
    tomorrowEvents: number;
    overdueCount: number;
    campaignDeadlines: number;
    pendingApprovals: number;
  };
};

/**
 * Daily Briefing alert — shows at the top of the MNA dashboard on login.
 * Fetches today's schedule, overdue tasks, campaign deadlines, and pending approvals.
 * Dismissable per session.
 */
export default function DailyBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userTimezone, setUserTimezone] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem('mna_briefing_dismissed')) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    // Get the logged-in user's email for personalized briefing
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || 'mn@mothernatureagency.com';
      // Extract first name from email for greeting
      const name = email.split('@')[0].split('.')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));

      // Fetch user timezone preference
      fetch(`/api/user-preferences?email=${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.preferences?.timezone) setUserTimezone(d.preferences.timezone);
        })
        .catch(() => {});

      fetch(`/api/schedule/reminders?email=${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem('mna_briefing_dismissed', '1');
  }

  if (dismissed || loading) return null;
  if (!data) return null;

  const { summary, events, overdue, campaigns, pendingContent } = data;
  const totalAlerts = summary.todayEvents + summary.overdueCount + summary.campaignDeadlines + summary.pendingApprovals;

  // Nothing to show
  if (totalAlerts === 0) return null;

  const today = getDateDisplay(userTimezone);
  const timeGreeting = getTimeGreeting(userTimezone);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f1f2e 0%, #0d2b47 50%, #124b73 100%)',
        border: '1px solid rgba(74,184,206,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>notifications_active</span>
          </div>
          <div>
            <div className="text-white text-[15px] font-bold">{timeGreeting}{userName ? `, ${userName}` : ''}</div>
            <div className="text-white/50 text-[12px]">{today}</div>
          </div>
          {totalAlerts > 0 && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300">
              {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} need attention
            </span>
          )}
        </div>
        <button
          onClick={dismiss}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {/* Today's Schedule */}
        <div className="p-5" style={{ background: 'rgba(15,31,46,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 16 }}>calendar_today</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Today&apos;s Schedule</span>
          </div>
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.slice(0, 4).map((e: any) => (
                <div key={e.id} className="flex items-start gap-2">
                  {e.priority === 'high' && (
                    <span className="text-amber-400 text-[10px] mt-0.5">!</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[12px] font-medium truncate">{e.title}</div>
                    {e.start_time && (
                      <div className="text-white/40 text-[10px]">{e.start_time}{e.end_time ? ` - ${e.end_time}` : ''}</div>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    e.event_type === 'meeting' ? 'bg-blue-400/20 text-blue-300' :
                    e.event_type === 'deadline' ? 'bg-red-400/20 text-red-300' :
                    e.event_type === 'call' ? 'bg-green-400/20 text-green-300' :
                    'bg-white/10 text-white/50'
                  }`}>
                    {e.event_type}
                  </span>
                </div>
              ))}
              {events.length > 4 && (
                <div className="text-white/30 text-[11px]">+{events.length - 4} more</div>
              )}
            </div>
          ) : (
            <div className="text-white/30 text-[12px]">No events today</div>
          )}
          <Link
            href="/schedule"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Open Schedule
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
          </Link>
        </div>

        {/* Overdue */}
        <div className="p-5" style={{ background: 'rgba(15,31,46,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-red-400" style={{ fontSize: 16 }}>warning</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Overdue</span>
          </div>
          {overdue.length > 0 ? (
            <div className="space-y-2">
              {overdue.slice(0, 4).map((e: any) => (
                <div key={e.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[12px] font-medium truncate">{e.title}</div>
                    <div className="text-red-300/60 text-[10px]">Due {e.event_date}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-[12px] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: 14 }}>check_circle</span>
              All caught up
            </div>
          )}
        </div>

        {/* Campaign Deadlines */}
        <div className="p-5" style={{ background: 'rgba(15,31,46,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-purple-400" style={{ fontSize: 16 }}>campaign</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Campaigns Due</span>
          </div>
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.slice(0, 4).map((c: any) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[12px] font-medium truncate">{c.name}</div>
                    <div className="text-white/40 text-[10px]">
                      {c.campaign_type === 'sms' ? 'SMS' : 'Email'} · {c.scheduled_date}
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    c.status === 'pending_review' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/50'
                  }`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-[12px]">No upcoming deadlines</div>
          )}
          <Link
            href="/campaigns"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
          >
            Open Campaigns
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
          </Link>
        </div>

        {/* Pending Approvals */}
        <div className="p-5" style={{ background: 'rgba(15,31,46,0.7)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 16 }}>rate_review</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Needs Review</span>
          </div>
          {pendingContent.length > 0 ? (
            <div className="space-y-2">
              {pendingContent.slice(0, 4).map((p: any) => (
                <div key={p.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[12px] font-medium truncate">{p.title || 'Untitled post'}</div>
                    <div className="text-white/40 text-[10px]">{p.platform} · {p.post_date}</div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    p.client_approval_status === 'changes_requested' ? 'bg-red-400/20 text-red-300' : 'bg-amber-400/20 text-amber-300'
                  }`}>
                    {p.client_approval_status === 'changes_requested' ? 'changes' : 'review'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-[12px]">No posts pending</div>
          )}
          <Link
            href="/content"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Open Content
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
