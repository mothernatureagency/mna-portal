'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useClient } from '@/context/ClientContext';
import { clients as allClientsList } from '@/lib/clients';
import { getTimeGreeting, getDateDisplay, getTodayInTimezone, DEFAULT_TIMEZONE } from '@/lib/timezone';
import { getDisplayName } from '@/lib/display-names';
import { VoiceButton } from '@/components/ai/VoiceButton';
import { speak } from '@/lib/voice';

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
  attendees?: string | null;
  meeting_mode?: string | null;
  location?: string | null;
  meet_link?: string | null;
  recurrence?: string | null;
  recurrence_end?: string | null;
  recurring_parent_id?: string | null;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type CalView = 'month' | 'week' | 'day';

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  meeting: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', icon: 'groups' },
  call: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', icon: 'call' },
  task: { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af', icon: 'check_circle' },
  deadline: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', icon: 'flag' },
  review: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', icon: 'rate_review' },
  personal: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', icon: 'person' },
  blocked: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', icon: 'block' },
  google: { bg: 'rgba(191,219,254,0.15)', text: '#bfdbfe', icon: 'event' },
};

const EVENT_TYPE_OPTIONS = [
  { value: 'meeting', label: 'Meeting', icon: 'groups' },
  { value: 'call', label: 'Call', icon: 'call' },
  { value: 'task', label: 'Task', icon: 'task_alt' },
  { value: 'deadline', label: 'Deadline', icon: 'alarm' },
  { value: 'review', label: 'Review', icon: 'rate_review' },
  { value: 'personal', label: 'Personal', icon: 'person' },
];

function fmtTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function datePlusDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

function fmtDateShort(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDateFull(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Get Monday of the week containing `iso`
function getWeekStart(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-CA');
}

export default function PersonalDashboard() {
  const { setActiveClientId, allClients } = useClient();
  const clientCtx = useClient() as any;
  const activeClient = clientCtx?.activeClient;
  const gradientFrom = activeClient?.branding?.gradientFrom || '#0c6da4';
  const gradientTo = activeClient?.branding?.gradientTo || '#4ab8ce';

  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [allEvents, setAllEvents] = useState<ScheduleEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<ScheduleEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [userTimezone, setUserTimezone] = useState(DEFAULT_TIMEZONE);

  // Calendar state
  const [calView, setCalView] = useState<CalView>('month');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Add event form
  const [showAdd, setShowAdd] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showWeekendMenu, setShowWeekendMenu] = useState(false);
  const weekendMenuRef = useRef<HTMLDivElement>(null);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_date: '', start_time: '09:00', end_time: '10:00',
    event_type: 'task', priority: 'normal', client_id: '', attendees: '',
    meeting_mode: 'none' as string, location: '',
    recurrence: 'none' as string, recurrence_end: '',
  });
  const [blockForm, setBlockForm] = useState({
    date: '', start_time: '09:00', end_time: '17:00', title: 'Blocked', allDay: false,
  });

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const today = getTodayInTimezone(userTimezone);
  const timeGreeting = getTimeGreeting(userTimezone);
  const dateDisplay = getDateDisplay(userTimezone);

  // Close weekend menu on click outside
  useEffect(() => {
    if (!showWeekendMenu) return;
    function handleClick(e: MouseEvent) {
      if (weekendMenuRef.current && !weekendMenuRef.current.contains(e.target as Node)) {
        setShowWeekendMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showWeekendMenu]);

  // ── Initial load ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || 'mn@mothernatureagency.com';
      setUserEmail(email);
      setUserName(getDisplayName(email));

      fetch(`/api/user-preferences?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.preferences?.timezone) setUserTimezone(data.preferences.timezone);
        })
        .catch(() => {});

      fetch(`/api/google/status?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(data => setGcalConnected(!!data.connected))
        .catch(() => {});
    });
  }, []);

  // ── Fetch range of events based on view ──
  const fetchRange = useMemo(() => {
    if (calView === 'month') {
      const start = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      const end = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${lastDay}`;
      return { start, end };
    }
    if (calView === 'week') {
      const weekStart = selectedDate ? getWeekStart(selectedDate) : getWeekStart(today);
      return { start: weekStart, end: datePlusDays(weekStart, 6) };
    }
    // day
    const day = selectedDate || today;
    return { start: day, end: day };
  }, [calView, calMonth, calYear, selectedDate, today]);

  useEffect(() => {
    if (!userEmail) return;
    const { start, end } = fetchRange;

    fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${start}&to=${end}`)
      .then(r => r.json())
      .then(data => setAllEvents(data.events || []))
      .catch(() => {});

    if (gcalConnected) {
      fetch(`/api/google/sync?email=${encodeURIComponent(userEmail)}&from=${start}&to=${end}`)
        .then(r => r.json())
        .then(data => setGoogleEvents((data.events || []).map((e: any) => ({
          ...e,
          event_date: e.date || e.event_date,
          event_type: 'google',
          completed: false,
          priority: 'normal',
        }))))
        .catch(() => setGoogleEvents([]));
    }
  }, [userEmail, fetchRange, gcalConnected]);

  function refreshEvents() {
    if (!userEmail) return;
    const { start, end } = fetchRange;
    fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${start}&to=${end}`)
      .then(r => r.json())
      .then(data => setAllEvents(data.events || []))
      .catch(() => {});
  }

  // ── Combined events ──
  const combinedEvents = useMemo(() => [...allEvents, ...googleEvents], [allEvents, googleEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    combinedEvents.forEach(e => {
      const d = (e as any).date || e.event_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    // Sort each day by start_time
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
    return map;
  }, [combinedEvents]);

  // ── Actions ──
  async function createEvent() {
    if (!newEvent.title || !newEvent.event_date) return;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        clientId: newEvent.client_id || null,
        title: newEvent.title,
        description: newEvent.description || null,
        eventDate: newEvent.event_date,
        startTime: newEvent.start_time || null,
        endTime: newEvent.end_time || null,
        eventType: newEvent.event_type,
        priority: newEvent.priority,
        attendees: newEvent.attendees || null,
        meetingMode: newEvent.meeting_mode,
        location: newEvent.location || null,
        recurrence: newEvent.recurrence,
        recurrenceEnd: newEvent.recurrence_end || null,
      }),
    });
    if (res.ok) {
      refreshEvents();
      setShowAdd(false);
      setNewEvent({ title: '', description: '', event_date: selectedDate || today, start_time: '09:00', end_time: '10:00', event_type: 'task', priority: 'normal', client_id: '', attendees: '', meeting_mode: 'none', location: '', recurrence: 'none', recurrence_end: '' });
    }
  }

  async function blockTime() {
    const startTime = blockForm.allDay ? '00:00' : blockForm.start_time;
    const endTime = blockForm.allDay ? '23:59' : blockForm.end_time;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        title: blockForm.title || 'Blocked',
        eventDate: blockForm.date,
        startTime, endTime,
        eventType: 'blocked',
        priority: 'normal',
        meetingMode: 'none',
      }),
    });
    if (res.ok) {
      refreshEvents();
      setShowBlock(false);
      setBlockForm({ date: selectedDate || today, start_time: '09:00', end_time: '17:00', title: 'Blocked', allDay: false });
    }
  }

  // ── Weekend blocking ──
  // Find the next upcoming Friday (or current Friday if today is Fri)
  function getNextFriday(from?: string) {
    const d = from ? new Date(`${from}T12:00:00`) : new Date();
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysUntilFri = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
    d.setDate(d.getDate() + (daysUntilFri === 0 && dayOfWeek === 5 ? 0 : daysUntilFri));
    return d.toLocaleDateString('en-CA');
  }

  async function blockWeekend(mode: 'allday-fri' | '12pm-fri' | '5pm-fri') {
    const fri = getNextFriday(selectedDate || today);
    const sat = datePlusDays(fri, 1);
    const sun = datePlusDays(fri, 2);
    const mon = datePlusDays(fri, 3);

    const blocks: { date: string; start: string; end: string; title: string }[] = [];

    if (mode === 'allday-fri') {
      blocks.push({ date: fri, start: '00:00', end: '23:59', title: 'Weekend — Off' });
    } else if (mode === '12pm-fri') {
      blocks.push({ date: fri, start: '12:00', end: '23:59', title: 'Weekend — Off (from 12 PM)' });
    } else {
      blocks.push({ date: fri, start: '17:00', end: '23:59', title: 'Weekend — Off (from 5 PM)' });
    }
    blocks.push({ date: sat, start: '00:00', end: '23:59', title: 'Weekend — Off' });
    blocks.push({ date: sun, start: '00:00', end: '23:59', title: 'Weekend — Off' });
    blocks.push({ date: mon, start: '00:00', end: '09:00', title: 'Weekend — Off (until 9 AM)' });

    for (const b of blocks) {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          title: b.title,
          eventDate: b.date,
          startTime: b.start,
          endTime: b.end,
          eventType: 'blocked',
          priority: 'normal',
          meetingMode: 'none',
        }),
      });
    }
    refreshEvents();
    setShowWeekendMenu(false);
  }

  async function unlockWeekend() {
    // Find and delete all "Weekend — Off" blocked events for the upcoming Fri–Mon
    const fri = getNextFriday(selectedDate || today);
    const mon = datePlusDays(fri, 3);

    // Get all events in range
    const res = await fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${fri}&to=${mon}`);
    const data = await res.json();
    const weekendBlocks = (data.events || []).filter(
      (e: any) => e.event_type === 'blocked' && e.title?.startsWith('Weekend')
    );

    for (const ev of weekendBlocks) {
      await fetch(`/api/schedule?id=${ev.id}`, { method: 'DELETE' });
    }
    refreshEvents();
    setShowWeekendMenu(false);
  }

  // Check if upcoming weekend is blocked
  const weekendBlocked = useMemo(() => {
    const fri = getNextFriday(selectedDate || today);
    const sat = datePlusDays(fri, 1);
    const sun = datePlusDays(fri, 2);
    const weekendDates = [fri, sat, sun];
    return weekendDates.some(d => {
      const dayEv = eventsByDate[d] || [];
      return dayEv.some(e => e.event_type === 'blocked' && e.title?.startsWith('Weekend'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsByDate, selectedDate, today]);

  async function toggleComplete(id: string, done: boolean) {
    await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: done }),
    });
    setAllEvents(prev => prev.map(e => e.id === id ? { ...e, completed: done } : e));
  }

  async function deleteEvent(ev: ScheduleEvent) {
    const isRecurring = (ev.recurrence && ev.recurrence !== 'none') || ev.recurring_parent_id;
    let deleteSeries = false;
    if (isRecurring) {
      const choice = confirm('Delete entire recurring series? (OK = whole series, Cancel = just this one)');
      if (choice) deleteSeries = true;
      else if (!confirm('Delete just this occurrence?')) return;
    } else {
      if (!confirm('Delete this event?')) return;
    }
    const parentId = ev.recurring_parent_id || ev.id;
    const qs = deleteSeries ? `?id=${parentId}&series=true` : `?id=${ev.id}`;
    await fetch(`/api/schedule${qs}`, { method: 'DELETE' });
    if (deleteSeries) {
      setAllEvents(prev => prev.filter(e => e.id !== parentId && e.recurring_parent_id !== parentId));
    } else {
      setAllEvents(prev => prev.filter(e => e.id !== ev.id));
    }
  }

  // ── Chat ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function sendChat(text?: string, opts?: { spokenInput?: boolean }) {
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
        body: JSON.stringify({ email: userEmail, messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      const reply = data.reply || 'Something went wrong.';
      setChatMessages([...newMessages, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
      // If the user spoke, speak the reply back.
      if (opts?.spokenInput) {
        const spoken = String(reply).replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
        if (spoken) speak(spoken);
      }
    } catch {
      setChatMessages([...newMessages, { id: crypto.randomUUID(), role: 'assistant', content: 'Sorry, I had trouble connecting.' }]);
    } finally {
      setChatLoading(false);
      refreshEvents();
    }
  }

  // ── Navigation helpers ──
  function goToday() {
    setSelectedDate(today);
    setCalMonth(new Date().getMonth());
    setCalYear(new Date().getFullYear());
  }

  function navPrev() {
    if (calView === 'month') {
      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
      else setCalMonth(m => m - 1);
    } else if (calView === 'week') {
      setSelectedDate(d => datePlusDays(d || today, -7));
    } else {
      setSelectedDate(d => datePlusDays(d || today, -1));
    }
  }

  function navNext() {
    if (calView === 'month') {
      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
      else setCalMonth(m => m + 1);
    } else if (calView === 'week') {
      setSelectedDate(d => datePlusDays(d || today, 7));
    } else {
      setSelectedDate(d => datePlusDays(d || today, 1));
    }
  }

  // ── Derived data ──
  const isToday = (selectedDate || '') === today;
  const clientCards = allClients.filter((c: any) => c.id !== 'mna');

  const weekDays = useMemo(() => {
    const ws = selectedDate ? getWeekStart(selectedDate) : getWeekStart(today);
    return Array.from({ length: 7 }, (_, i) => datePlusDays(ws, i));
  }, [selectedDate, today]);

  const viewTitle = useMemo(() => {
    if (calView === 'month') return new Date(calYear, calMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (calView === 'week') return `${fmtDateShort(weekDays[0])} — ${fmtDateShort(weekDays[6])}`;
    return fmtDateFull(selectedDate || today);
  }, [calView, calMonth, calYear, weekDays, selectedDate, today]);

  // ── Event Card ──
  function EventCard({ event, compact }: { event: ScheduleEvent; compact?: boolean }) {
    const style = EVENT_COLORS[event.event_type] || EVENT_COLORS.task;
    const clientName = event.client_id ? allClientsList.find(c => c.id === event.client_id)?.shortName : null;
    const isGoogle = event.event_type === 'google';
    const isBlocked = event.event_type === 'blocked';

    if (compact) {
      return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold truncate ${isBlocked ? 'bg-red-500/15 text-red-300' : ''}`}
          style={!isBlocked ? { background: style.bg, color: style.text } : undefined}>
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{style.icon}</span>
          <span className="truncate">{event.title}</span>
          {event.start_time && <span className="text-[9px] opacity-70 shrink-0">{fmtTime(event.start_time)}</span>}
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors hover:bg-white/5 group ${isBlocked ? 'bg-red-500/5 border-l-2 border-l-red-500/40' : ''} ${event.completed ? 'opacity-40' : ''}`}>
        {isBlocked ? (
          <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-red-500/20">
            <span className="material-symbols-outlined text-red-400" style={{ fontSize: 14 }}>block</span>
          </span>
        ) : isGoogle ? (
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: '#bfdbfe' }}>event</span>
        ) : (
          <button
            onClick={() => toggleComplete(event.id, !event.completed)}
            className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
            style={{ borderColor: style.text + '40', background: event.completed ? style.bg : 'transparent' }}
          >
            {event.completed && <span className="material-symbols-outlined text-emerald-300" style={{ fontSize: 14 }}>check</span>}
          </button>
        )}
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: style.text }}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${event.completed ? 'line-through text-white/40' : 'text-white'}`}>
              {event.priority === 'high' && <span className="text-amber-400 mr-1">!</span>}
              {event.title}
            </span>
            {clientName && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold" style={{ background: style.bg, color: style.text }}>
                {clientName}
              </span>
            )}
            {event.recurrence && event.recurrence !== 'none' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                <span className="material-symbols-outlined mr-0.5" style={{ fontSize: 10, verticalAlign: 'middle' }}>repeat</span>
                {event.recurrence}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            {event.start_time && <span>{fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ''}</span>}
            {(event as any).attendees && <span className="truncate">· {(event as any).attendees}</span>}
          </div>
          {(event as any).meet_link && (
            <a href={(event as any).meet_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-blue-400 hover:text-blue-300">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>videocam</span>
              Join Meet
            </a>
          )}
          {(event as any).location && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-white/40">
              <span className="material-symbols-outlined text-amber-400/60" style={{ fontSize: 12 }}>location_on</span>
              {(event as any).location}
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: style.bg, color: style.text }}>
          {isGoogle ? 'Google' : event.event_type}
        </span>
        {isGoogle && (event as any).htmlLink && (
          <a href={(event as any).htmlLink} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          </a>
        )}
        {!isGoogle && (
          <button onClick={() => deleteEvent(event)} className="text-white/0 group-hover:text-white/30 hover:!text-rose-400 transition-colors shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
      </div>
    );
  }

  // ── DayColumn for week view ──
  function DayColumn({ date }: { date: string }) {
    const dayEv = eventsByDate[date] || [];
    const isT = date === today;
    const isSel = date === selectedDate;
    return (
      <div
        className={`rounded-xl p-2.5 min-h-[180px] cursor-pointer transition-all ${isSel ? 'ring-1 ring-cyan-400/40' : ''}`}
        style={{ background: isT ? 'rgba(74,184,206,0.06)' : 'rgba(255,255,255,0.03)', border: isT ? '1px solid rgba(74,184,206,0.15)' : '1px solid rgba(255,255,255,0.05)' }}
        onClick={() => { setSelectedDate(date); setCalView('day'); }}
      >
        <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isT ? 'text-cyan-400' : 'text-white/40'}`}>
          {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
          <span className="ml-1 text-[14px] font-black">{new Date(`${date}T12:00:00`).getDate()}</span>
        </div>
        <div className="space-y-1">
          {dayEv.filter(e => !e.completed).slice(0, 5).map(e => <EventCard key={e.id} event={e} compact />)}
          {dayEv.filter(e => !e.completed).length > 5 && (
            <div className="text-[9px] text-white/30 text-center">+{dayEv.filter(e => !e.completed).length - 5} more</div>
          )}
          {dayEv.filter(e => !e.completed).length === 0 && (
            <div className="text-[9px] text-white/20 italic text-center mt-4">No events</div>
          )}
        </div>
      </div>
    );
  }

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
      </div>

      {/* ── Unified Calendar ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Calendar header with view toggle */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 20 }}>calendar_month</span>
            <span className="text-[15px] font-bold text-white">{viewTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {(['month', 'week', 'day'] as CalView[]).map(v => (
                <button
                  key={v}
                  onClick={() => {
                    setCalView(v);
                    if (v === 'day' && !selectedDate) setSelectedDate(today);
                    if (v === 'week' && !selectedDate) setSelectedDate(today);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all capitalize ${
                    calView === v ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={calView === v ? { background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` } : undefined}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Nav */}
            <div className="flex items-center gap-1">
              <button onClick={navPrev} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <button onClick={goToday} className="text-[11px] font-semibold text-white/40 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                Today
              </button>
              <button onClick={navNext} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() => {
                setShowBlock(!showBlock); setShowAdd(false);
                setBlockForm(b => ({ ...b, date: selectedDate || today }));
              }}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                showBlock ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-white/50 hover:text-white/70'
              }`}
              style={!showBlock ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>block</span>
              {showBlock ? 'Cancel' : 'Block'}
            </button>

            {/* Weekend block/unlock */}
            <div className="relative" ref={weekendMenuRef}>
              <button
                onClick={() => setShowWeekendMenu(!showWeekendMenu)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  weekendBlocked
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-white/50 hover:text-white/70'
                }`}
                style={!weekendBlocked ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>weekend</span>
                Weekend
                {weekendBlocked && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>}
              </button>

              {showWeekendMenu && (
                <div className="absolute top-full right-0 mt-1.5 z-50 w-64 rounded-xl overflow-hidden shadow-2xl"
                  style={{ background: '#0f1f2e', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[12px] font-bold text-white">Block Weekend</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Prevents bookings Fri → Mon 9 AM</div>
                  </div>
                  <div className="py-1">
                    <button onClick={() => blockWeekend('5pm-fri')}
                      className="w-full text-left px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/8 hover:text-white transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 16 }}>schedule</span>
                      <div>
                        <div className="font-semibold">From 5:00 PM Friday</div>
                        <div className="text-[10px] text-white/40">Until Monday 9 AM</div>
                      </div>
                    </button>
                    <button onClick={() => blockWeekend('12pm-fri')}
                      className="w-full text-left px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/8 hover:text-white transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-400" style={{ fontSize: 16 }}>schedule</span>
                      <div>
                        <div className="font-semibold">From 12:00 PM Friday</div>
                        <div className="text-[10px] text-white/40">Half-day Friday → Monday 9 AM</div>
                      </div>
                    </button>
                    <button onClick={() => blockWeekend('allday-fri')}
                      className="w-full text-left px-4 py-2.5 text-[12px] text-white/70 hover:bg-white/8 hover:text-white transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-400" style={{ fontSize: 16 }}>event_busy</span>
                      <div>
                        <div className="font-semibold">All Day Friday</div>
                        <div className="text-[10px] text-white/40">Full 3-day weekend → Monday 9 AM</div>
                      </div>
                    </button>
                  </div>
                  {weekendBlocked && (
                    <div className="py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={unlockWeekend}
                        className="w-full text-left px-4 py-2.5 text-[12px] text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_open</span>
                        <div>
                          <div className="font-semibold">Unlock Weekend</div>
                          <div className="text-[10px] text-white/40">Remove all weekend blocks</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowAdd(!showAdd); setShowBlock(false);
                setNewEvent(n => ({ ...n, event_date: selectedDate || today }));
              }}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white flex items-center gap-1"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showAdd ? 'close' : 'add'}</span>
              {showAdd ? 'Cancel' : 'Add Event'}
            </button>

            {/* Google Calendar badge */}
            {gcalConnected && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-emerald-400" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                Google
              </span>
            )}
          </div>
        </div>

        {/* ── Block time form ── */}
        {showBlock && (
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.03)' }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400" style={{ fontSize: 16 }}>block</span>
              <span className="text-[12px] font-bold text-white">Block Time Off</span>
              <span className="text-[10px] text-white/30">— prevents bookings during this time</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <input type="text" placeholder="Label (e.g. Lunch)" value={blockForm.title}
                onChange={e => setBlockForm({ ...blockForm, title: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
              <input type="date" value={blockForm.date}
                onChange={e => setBlockForm({ ...blockForm, date: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
              {!blockForm.allDay && (
                <>
                  <input type="time" value={blockForm.start_time} onChange={e => setBlockForm({ ...blockForm, start_time: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                  <input type="time" value={blockForm.end_time} onChange={e => setBlockForm({ ...blockForm, end_time: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                </>
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={blockForm.allDay} onChange={e => setBlockForm({ ...blockForm, allDay: e.target.checked })}
                    className="rounded border-white/30 bg-white/5" />
                  <span className="text-[11px] text-white/50">All day</span>
                </label>
                <button onClick={blockTime} className="text-[11px] font-bold px-4 py-2 rounded-lg text-white bg-red-500/80 hover:bg-red-500 transition-colors">
                  Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add event form ── */}
        {showAdd && (
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,109,164,0.04)' }}>
            <div className="text-[12px] font-bold text-white">New Event</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Event title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 col-span-1 md:col-span-2" />
              <input type="date" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input type="time" value={newEvent.start_time} onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
              <input type="time" value={newEvent.end_time} onChange={e => setNewEvent({ ...newEvent, end_time: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
              <select value={newEvent.event_type} onChange={e => {
                const t = e.target.value;
                const mode = (t === 'meeting' || t === 'call') ? 'google_meet' : 'none';
                setNewEvent({ ...newEvent, event_type: t, meeting_mode: mode });
              }}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none">
                {EVENT_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={newEvent.priority} onChange={e => setNewEvent({ ...newEvent, priority: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <select value={newEvent.client_id} onChange={e => setNewEvent({ ...newEvent, client_id: e.target.value })}
                className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none">
                <option value="">No client</option>
                {allClients.filter((c: any) => c.id !== 'mna').map((c: any) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
              </select>
            </div>
            {(newEvent.event_type === 'meeting' || newEvent.event_type === 'call') && (
              <div className="flex gap-2">
                <button onClick={() => setNewEvent({ ...newEvent, meeting_mode: 'google_meet' })}
                  className={`flex-1 flex items-center justify-center gap-2 text-[11px] font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    newEvent.meeting_mode === 'google_meet' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/15 text-white/50'
                  }`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>videocam</span> Google Meet
                </button>
                <button onClick={() => setNewEvent({ ...newEvent, meeting_mode: 'in_person' })}
                  className={`flex-1 flex items-center justify-center gap-2 text-[11px] font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    newEvent.meeting_mode === 'in_person' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/15 text-white/50'
                  }`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span> In-Person
                </button>
              </div>
            )}
            {newEvent.meeting_mode === 'in_person' && (
              <input type="text" placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                className="w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            )}
            <input type="text" placeholder="Attendees (e.g. Justin, Sable)" value={newEvent.attendees} onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
              className="w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            {/* Recurrence */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[10px] text-white/30 font-semibold">Repeat:</span>
              {['none', 'daily', 'weekly', 'biweekly', 'monthly'].map(r => (
                <button key={r} onClick={() => setNewEvent({ ...newEvent, recurrence: r })}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors capitalize ${
                    newEvent.recurrence === r ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/15 text-white/40'
                  }`}>
                  {r === 'none' ? 'None' : r === 'biweekly' ? 'Every 2 Wks' : r}
                </button>
              ))}
              {newEvent.recurrence !== 'none' && (
                <input type="date" value={newEvent.recurrence_end} onChange={e => setNewEvent({ ...newEvent, recurrence_end: e.target.value })}
                  placeholder="Until"
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
              )}
            </div>
            <textarea placeholder="Description (optional)" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
              rows={2} className="w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            <button onClick={createEvent} className="text-[12px] font-bold px-5 py-2 rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
              Create Event
            </button>
          </div>
        )}

        {/* ════════════════ MONTH VIEW ════════════════ */}
        {calView === 'month' && (() => {
          const firstDay = new Date(calYear, calMonth, 1).getDay();
          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          const todayNum = today === `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
            ? new Date().getDate() : -1;

          return (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 px-4 pt-3 pb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-white/25 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 px-4 pb-3 gap-0.5">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = eventsByDate[dayStr] || [];
                  const active = dayEvents.filter(e => !e.completed);
                  const isTd = day === todayNum;
                  const isSel = dayStr === selectedDate;
                  const hasPersonal = active.some(e => e.event_type === 'personal');
                  const hasBusiness = active.some(e => e.event_type !== 'personal' && e.event_type !== 'google' && e.event_type !== 'blocked');
                  const hasGoogle = active.some(e => e.event_type === 'google');
                  const hasBlocked = active.some(e => e.event_type === 'blocked');

                  return (
                    <button
                      key={day}
                      onClick={() => { setSelectedDate(isSel ? null : dayStr); }}
                      onDoubleClick={() => { setSelectedDate(dayStr); setCalView('day'); }}
                      className="relative flex flex-col items-center py-1.5 rounded-lg transition-all hover:bg-white/5"
                      style={{
                        background: isSel ? 'rgba(12,109,164,0.25)' : isTd ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: isTd ? '1px solid rgba(74,184,206,0.3)' : '1px solid transparent',
                      }}
                    >
                      <span className={`text-[12px] font-semibold ${isTd ? 'text-cyan-400' : isSel ? 'text-white' : 'text-white/60'}`}>
                        {day}
                      </span>
                      {active.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {hasBlocked && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                          {hasPersonal && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          {hasBusiness && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                          {hasGoogle && <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day detail */}
              {selectedDate && (() => {
                const dayEv = (eventsByDate[selectedDate] || []).filter(e => !e.completed);
                return (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/30">
                        {fmtDateFull(selectedDate)}
                      </div>
                      <button onClick={() => { setCalView('day'); }}
                        className="text-[10px] font-semibold text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
                        Day view <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
                      </button>
                    </div>
                    {dayEv.length > 0 ? (
                      <div className="space-y-1">{dayEv.map(e => <EventCard key={e.id} event={e} />)}</div>
                    ) : (
                      <div className="text-white/25 text-[12px] text-center py-3">No events</div>
                    )}
                  </div>
                );
              })()}

              {/* Legend */}
              <div className="flex items-center gap-4 px-5 pb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[10px] text-white/30">Blocked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-white/30">Personal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-[10px] text-white/30">Business</span>
                </div>
                {gcalConnected && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-300" />
                    <span className="text-[10px] text-white/30">Google Calendar</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ════════════════ WEEK VIEW ════════════════ */}
        {calView === 'week' && (
          <div className="grid grid-cols-7 gap-2 p-4">
            {weekDays.map(d => <DayColumn key={d} date={d} />)}
          </div>
        )}

        {/* ════════════════ DAY VIEW ════════════════ */}
        {calView === 'day' && (() => {
          const dayStr = selectedDate || today;
          const dayEv = (eventsByDate[dayStr] || []);
          const active = dayEv.filter(e => !e.completed);
          const completed = dayEv.filter(e => e.completed);
          return (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px] font-bold text-white">{fmtDateFull(dayStr)}</span>
                {dayStr === today && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Today</span>}
                <span className="text-[11px] text-white/30 ml-auto">{active.length} active{completed.length > 0 ? `, ${completed.length} done` : ''}</span>
              </div>
              {active.length > 0 ? (
                <div className="space-y-1 mb-4">{active.map(e => <EventCard key={e.id} event={e} />)}</div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-white/10 mb-2" style={{ fontSize: 32 }}>event_available</span>
                  <div className="text-white/25 text-[12px]">No events scheduled</div>
                </div>
              )}
              {completed.length > 0 && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/20 mb-2">Completed</div>
                  <div className="space-y-1">{completed.map(e => <EventCard key={e.id} event={e} />)}</div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Two-column layout: Quick Info + Assistant ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT: Quick info (3 cols) */}
        <div className="lg:col-span-3 space-y-5">

          {/* Tomorrow Preview */}
          {(() => {
            const tmrw = datePlusDays(today, 1);
            const tmrwEv = (eventsByDate[tmrw] || []).filter(e => !e.completed);
            if (tmrwEv.length === 0) return null;
            return (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white/30" style={{ fontSize: 16 }}>upcoming</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/30">Tomorrow ({tmrwEv.length})</span>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {tmrwEv.slice(0, 4).map(e => <EventCard key={e.id} event={e} />)}
                  {tmrwEv.length > 4 && <div className="text-white/25 text-[11px] text-center py-2">+{tmrwEv.length - 4} more</div>}
                </div>
              </div>
            );
          })()}

          {/* Quick Client Cards */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/25 mb-3 px-1">Your Clients</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {clientCards.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setActiveClientId(c.id)}
                  className="rounded-xl px-4 py-3.5 text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = c.branding.gradientFrom + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-[11px] mb-2"
                    style={{ background: `linear-gradient(135deg, ${c.branding.gradientFrom}, ${c.branding.gradientTo})` }}>
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
          <div className="rounded-2xl flex flex-col"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', height: 'calc(100vh - 180px)', minHeight: 500 }}>
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
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
                    {["What's on my schedule?", "Add a task for tomorrow", "Block off Friday afternoon"].map(s => (
                      <button key={s} onClick={() => sendChat(s)}
                        className="block w-full text-left text-[11px] text-white/40 hover:text-white/70 px-3 py-2 rounded-lg transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed max-w-[85%]"
                    style={{
                      background: m.role === 'user' ? `linear-gradient(135deg, ${gradientFrom}, #3a9bc4)` : 'rgba(255,255,255,0.07)',
                      color: '#fff',
                      border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                    {m.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>{line}{i < m.content.split('\n').length - 1 && <br />}</React.Fragment>
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
              <div className="flex items-end gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <VoiceButton
                  className="!w-8 !h-8"
                  onTranscript={(t) => sendChat(t, { spokenInput: true })}
                />
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Tell me what to do or tap the mic..."
                  rows={1}
                  className="flex-1 bg-transparent text-white text-[13px] placeholder:text-white/25 focus:outline-none resize-none"
                  style={{ minHeight: 20, maxHeight: 80 }}
                />
                <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-30"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
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
