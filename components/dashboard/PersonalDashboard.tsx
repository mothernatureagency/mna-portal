'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useClient } from '@/context/ClientContext';
import { clients as allClientsList } from '@/lib/clients';
import { getTimeGreeting, getDateDisplay, getTodayInTimezone, DEFAULT_TIMEZONE } from '@/lib/timezone';
import { getDisplayName } from '@/lib/display-names';

type ScheduleEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  priority: string;
  completed: boolean;
  client_id: string | null;
  description: string | null;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  meeting: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', icon: 'groups' },
  call: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', icon: 'call' },
  task: { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af', icon: 'check_circle' },
  deadline: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', icon: 'flag' },
  review: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', icon: 'rate_review' },
  personal: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', icon: 'person' },
};

export default function PersonalDashboard() {
  const { setActiveClientId, allClients } = useClient();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [tomorrowEvents, setTomorrowEvents] = useState<ScheduleEvent[]>([]);
  const [personalEvents, setPersonalEvents] = useState<ScheduleEvent[]>([]);
  const [businessEvents, setBusinessEvents] = useState<ScheduleEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [userTimezone, setUserTimezone] = useState(DEFAULT_TIMEZONE);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const today = getTodayInTimezone(userTimezone);
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA', { timeZone: userTimezone });
  })();
  const timeGreeting = getTimeGreeting(userTimezone);
  const dateDisplay = getDateDisplay(userTimezone);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || 'mn@mothernatureagency.com';
      setUserEmail(email);
      setUserName(getDisplayName(email));

      // Fetch user timezone preference
      fetch(`/api/user-preferences?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.preferences?.timezone) setUserTimezone(data.preferences.timezone);
        })
        .catch(() => {});

      // Fetch schedule
      fetch(`/api/schedule?email=${encodeURIComponent(email)}&from=${today}&to=${tomorrow}`)
        .then(r => r.json())
        .then(data => {
          const events: ScheduleEvent[] = data.events || [];
          const todayE = events.filter(e => e.event_date === today && !e.completed);
          const tomorrowE = events.filter(e => e.event_date === tomorrow && !e.completed);
          setTodayEvents(todayE);
          setTomorrowEvents(tomorrowE);
          setPersonalEvents(todayE.filter(e => e.event_type === 'personal'));
          setBusinessEvents(todayE.filter(e => e.event_type !== 'personal'));
        })
        .catch(() => {});
    });
  }, [today, tomorrow]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function sendChat(text?: string) {
    const msg = (text || chatInput).trim();
    if (!msg || chatLoading) return;
    setChatInput('');

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: msg };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, { id: crypto.randomUUID(), role: 'assistant', content: data.reply || 'Something went wrong.' }]);
    } catch {
      setChatMessages([...newMessages, { id: crypto.randomUUID(), role: 'assistant', content: 'Sorry, I had trouble connecting.' }]);
    } finally {
      setChatLoading(false);
      // Refresh schedule in case assistant added something
      fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${today}&to=${tomorrow}`)
        .then(r => r.json())
        .then(data => {
          const events: ScheduleEvent[] = data.events || [];
          setTodayEvents(events.filter(e => e.event_date === today && !e.completed));
          setTomorrowEvents(events.filter(e => e.event_date === tomorrow && !e.completed));
        })
        .catch(() => {});
    }
  }

  function toggleComplete(id: string) {
    fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: true }),
    }).then(() => {
      setTodayEvents(prev => prev.filter(e => e.id !== id));
      setBusinessEvents(prev => prev.filter(e => e.id !== id));
      setPersonalEvents(prev => prev.filter(e => e.id !== id));
    });
  }

  function EventCard({ event }: { event: ScheduleEvent }) {
    const style = EVENT_COLORS[event.event_type] || EVENT_COLORS.task;
    const clientName = event.client_id ? allClientsList.find(c => c.id === event.client_id)?.shortName : null;
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors hover:bg-white/5 group">
        <button
          onClick={() => toggleComplete(event.id)}
          className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
          style={{ borderColor: style.text + '40', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = style.bg; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined text-transparent group-hover:text-white/40" style={{ fontSize: 14 }}>check</span>
        </button>
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: style.text }}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">
            {event.priority === 'high' && <span className="text-amber-400 mr-1">!</span>}
            {event.title}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            {event.start_time && <span>{event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}</span>}
            {clientName && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold" style={{ background: style.bg, color: style.text }}>
                {clientName}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: style.bg, color: style.text }}>
          {event.event_type}
        </span>
      </div>
    );
  }

  // Client quick cards (non-mna only)
  const clientCards = allClients.filter(c => c.id !== 'mna');

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold text-white tracking-tight">
            {timeGreeting}, {userName}
          </h1>
          <p className="text-[13px] text-white/40 mt-0.5">{dateDisplay}</p>
        </div>
        <Link
          href="/schedule"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
          Full Schedule
        </Link>
      </div>

      {/* ── Two-column layout: Schedule + Assistant ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT: Schedule (3 cols) */}
        <div className="lg:col-span-3 space-y-5">

          {/* Personal Schedule */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 18 }}>person</span>
                <span className="text-[12px] font-bold uppercase tracking-wider text-amber-400">Personal</span>
              </div>
              <Link href="/schedule" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">View all</Link>
            </div>
            <div className="px-3 py-2">
              {personalEvents.length > 0 ? (
                personalEvents.map(e => <EventCard key={e.id} event={e} />)
              ) : (
                <div className="text-white/25 text-[12px] text-center py-4">No personal events today</div>
              )}
            </div>
          </div>

          {/* Business Schedule */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>work</span>
                <span className="text-[12px] font-bold uppercase tracking-wider text-cyan-400">Business</span>
                {businessEvents.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400">{businessEvents.length}</span>
                )}
              </div>
              <Link href="/schedule" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">View all</Link>
            </div>
            <div className="px-3 py-2">
              {businessEvents.length > 0 ? (
                businessEvents.map(e => <EventCard key={e.id} event={e} />)
              ) : (
                <div className="text-white/25 text-[12px] text-center py-4">No business events today</div>
              )}
            </div>
          </div>

          {/* Tomorrow Preview */}
          {tomorrowEvents.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-white/30" style={{ fontSize: 18 }}>upcoming</span>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-white/30">Tomorrow ({tomorrowEvents.length})</span>
                </div>
              </div>
              <div className="px-3 py-2">
                {tomorrowEvents.slice(0, 4).map(e => <EventCard key={e.id} event={e} />)}
                {tomorrowEvents.length > 4 && (
                  <div className="text-white/25 text-[11px] text-center py-2">+{tomorrowEvents.length - 4} more</div>
                )}
              </div>
            </div>
          )}

          {/* Quick Client Cards */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/25 mb-3 px-1">Your Clients</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {clientCards.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveClientId(c.id)}
                  className="rounded-xl px-4 py-3.5 text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = c.branding.gradientFrom + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-[11px] mb-2"
                    style={{ background: `linear-gradient(135deg, ${c.branding.gradientFrom}, ${c.branding.gradientTo})` }}
                  >
                    {c.shortName.charAt(0)}
                  </div>
                  <div className="text-[12px] font-bold text-white truncate">{c.shortName}</div>
                  <div className="text-[10px] text-white/30 truncate">{c.industry}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Assistant chat (2 cols) */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl flex flex-col"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              height: 'calc(100vh - 180px)',
              minHeight: 500,
            }}
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>smart_toy</span>
                </div>
                <span className="text-[13px] font-bold text-white">MNA Assistant</span>
              </div>
              <Link href="/assistant" className="text-[11px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
                Full view
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
              </Link>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-white/15 mb-3" style={{ fontSize: 36 }}>smart_toy</span>
                  <p className="text-white/25 text-[12px] mb-4">Ask me to add tasks, set meetings, or check your schedule.</p>
                  <div className="space-y-1.5">
                    {["What's on my schedule?", "Add a task for tomorrow", "Remember something for me"].map(s => (
                      <button
                        key={s}
                        onClick={() => sendChat(s)}
                        className="block w-full text-left text-[11px] text-white/40 hover:text-white/70 px-3 py-2 rounded-lg transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed max-w-[85%]"
                    style={{
                      background: m.role === 'user' ? 'linear-gradient(135deg, #0c6da4, #3a9bc4)' : 'rgba(255,255,255,0.07)',
                      color: '#fff',
                      border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {m.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < m.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="shrink-0 px-3 pb-3">
              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Tell me what to do..."
                  rows={1}
                  className="flex-1 bg-transparent text-white text-[13px] placeholder:text-white/25 focus:outline-none resize-none"
                  style={{ minHeight: 20, maxHeight: 80 }}
                />
                <button
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
