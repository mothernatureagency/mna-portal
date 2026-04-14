'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';

type ScheduleEvent = {
  id: string;
  user_email: string;
  client_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  priority: string;
  completed: boolean;
  reminder_sent: boolean;
  created_at: string;
};

const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', icon: 'groups', color: 'bg-violet-500/20 text-violet-300' },
  { value: 'call', label: 'Call', icon: 'call', color: 'bg-sky-500/20 text-sky-300' },
  { value: 'task', label: 'Task', icon: 'task_alt', color: 'bg-emerald-500/20 text-emerald-300' },
  { value: 'deadline', label: 'Deadline', icon: 'alarm', color: 'bg-rose-500/20 text-rose-300' },
  { value: 'review', label: 'Review', icon: 'rate_review', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'personal', label: 'Personal', icon: 'person', color: 'bg-white/10 text-white/60' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-white/40' },
  { value: 'normal', label: 'Normal', color: 'text-white/70' },
  { value: 'high', label: 'High', color: 'text-rose-300' },
];

function fmtDate(iso: string) {
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function fmtTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SchedulePage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const allClients = ctx?.allClients || [];

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_date: todayStr(), start_time: '09:00', end_time: '10:00',
    event_type: 'task', priority: 'normal', client_id: '',
  });

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setUserEmail(email);
      // Check Google Calendar connection
      if (email) {
        fetch(`/api/google/status?email=${encodeURIComponent(email)}`)
          .then(r => r.json())
          .then(d => setGcalConnected(d.connected))
          .catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    const from = viewMode === 'week' ? selectedDate : selectedDate;
    const to = viewMode === 'week' ? addDays(selectedDate, 6) : selectedDate;

    // Fetch MNA events
    const mnaFetch = fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []));

    // Fetch Google Calendar events if connected
    if (gcalConnected) {
      fetch(`/api/google/sync?email=${encodeURIComponent(userEmail)}&from=${from}&to=${to}`)
        .then(r => r.json())
        .then(d => setGoogleEvents(d.events || []))
        .catch(() => setGoogleEvents([]));
    }

    mnaFetch.finally(() => setLoading(false));
  }, [userEmail, selectedDate, viewMode, gcalConnected]);

  async function createEvent() {
    if (!newEvent.title || !newEvent.event_date) { alert('Title and date required'); return; }
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
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setEvents((prev) => [...prev, data.event].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
    setNewEvent({ title: '', description: '', event_date: selectedDate, start_time: '09:00', end_time: '10:00', event_type: 'task', priority: 'normal', client_id: '' });
    setShowAdd(false);
  }

  async function toggleComplete(id: string, completed: boolean) {
    const res = await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed }),
    });
    const data = await res.json();
    if (res.ok) setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...data.event } : e)));
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return;
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const today = todayStr();
  const isToday = selectedDate === today;

  // Week days for week view
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));
  }, [selectedDate]);

  // Group events by date for week view
  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    events.forEach((e) => {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    });
    return map;
  }, [events]);

  // Time slots for day view
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>calendar_month</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Schedule</h1>
          </div>
          <p className="text-white/60 mt-1">
            {fmtDate(selectedDate)} {isToday && <span className="text-emerald-300 font-semibold">· Today</span>}
            {' · '}{events.filter((e) => !e.completed).length} active events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${viewMode === 'day' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${viewMode === 'week' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              Week
            </button>
          </div>
          {/* Google Calendar connect */}
          {gcalConnected ? (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-emerald-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              Google Calendar
            </span>
          ) : (
            <button
              onClick={async () => {
                setGcalLoading(true);
                const res = await fetch(`/api/google/connect?email=${encodeURIComponent(userEmail)}`);
                const data = await res.json();
                if (data.url) window.location.href = data.url;
                setGcalLoading(false);
              }}
              disabled={gcalLoading || !userEmail}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-white/60 hover:text-white transition-colors disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_month</span>
              {gcalLoading ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          )}
          <button
            onClick={() => { setShowAdd(!showAdd); setNewEvent((n) => ({ ...n, event_date: selectedDate })); }}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            {showAdd ? 'Cancel' : '+ Add Event'}
          </button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'week' ? -7 : -1))} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/15">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <button onClick={() => setSelectedDate(today)} className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${isToday ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60 hover:bg-white/15'}`}>
          Today
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-[12px] px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white outline-none"
        />
        <button onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'week' ? 7 : 1))} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/15">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      {/* Add event form */}
      {showAdd && (
        <div className="glass-card p-5 space-y-3">
          <div className="text-[13px] font-bold text-white mb-1">New Event</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Event title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 col-span-1 md:col-span-2" />
            <input type="date" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input type="time" value={newEvent.start_time} onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
            <input type="time" value={newEvent.end_time} onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
            <select value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={newEvent.priority} onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={newEvent.client_id} onChange={(e) => setNewEvent({ ...newEvent, client_id: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
              <option value="">No client</option>
              {allClients.filter((c: any) => c.id !== 'mna').map((c: any) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
            </select>
          </div>
          <textarea placeholder="Description (optional)" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            rows={2} className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
          <button onClick={createEvent} className="text-[12px] font-bold px-5 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
            Create Event
          </button>
        </div>
      )}

      {loading && <div className="text-white/50 text-center py-8">Loading schedule...</div>}

      {/* Day view */}
      {!loading && viewMode === 'day' && (
        <div className="glass-card overflow-hidden">
          {events.length === 0 ? (
            <div className="p-8 text-center text-white/40">
              <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32 }}>event_available</span>
              No events for {fmtDate(selectedDate)}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {events.map((ev) => {
                const type = EVENT_TYPES.find((t) => t.value === ev.event_type) || EVENT_TYPES[2];
                const pri = PRIORITIES.find((p) => p.value === ev.priority) || PRIORITIES[1];
                const clientName = allClients.find((c: any) => c.id === ev.client_id)?.shortName;
                return (
                  <div key={ev.id} className={`flex items-start gap-3 p-4 transition-colors hover:bg-white/5 ${ev.completed ? 'opacity-50' : ''}`}>
                    {/* Checkbox */}
                    <button onClick={() => toggleComplete(ev.id, !ev.completed)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${ev.completed ? 'bg-emerald-500/30 border-emerald-400' : 'border-white/30 hover:border-white/50'}`}>
                      {ev.completed && <span className="material-symbols-outlined text-emerald-300" style={{ fontSize: 14 }}>check</span>}
                    </button>

                    {/* Time */}
                    <div className="w-20 shrink-0 text-right">
                      {ev.start_time ? (
                        <>
                          <div className="text-[12px] font-bold text-white">{fmtTime(ev.start_time)}</div>
                          {ev.end_time && <div className="text-[10px] text-white/40">{fmtTime(ev.end_time)}</div>}
                        </>
                      ) : (
                        <div className="text-[11px] text-white/30 italic">All day</div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${ev.completed ? 'line-through text-white/40' : pri.color} text-[13px] font-semibold`}>{ev.title}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${type.color}`}>
                          <span className="material-symbols-outlined mr-0.5" style={{ fontSize: 10, verticalAlign: 'middle' }}>{type.icon}</span>
                          {type.label}
                        </span>
                        {ev.priority === 'high' && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">High</span>}
                        {clientName && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">{clientName}</span>}
                      </div>
                      {ev.description && <div className="text-[11px] text-white/40 mt-0.5">{ev.description}</div>}
                    </div>

                    {/* Delete */}
                    <button onClick={() => deleteEvent(ev.id)} className="text-white/20 hover:text-rose-300 transition-colors shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Week view */}
      {!loading && viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayEvents = eventsByDate[day] || [];
            const isT = day === today;
            return (
              <div key={day} className={`glass-card p-3 min-h-[200px] ${isT ? 'ring-1 ring-emerald-400/30' : ''}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isT ? 'text-emerald-300' : 'text-white/40'}`}>
                  {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                  <span className="ml-1 text-[13px]">{new Date(`${day}T12:00:00`).getDate()}</span>
                </div>
                {dayEvents.length === 0 && <div className="text-[10px] text-white/20 italic">No events</div>}
                {dayEvents.map((ev) => {
                  const type = EVENT_TYPES.find((t) => t.value === ev.event_type) || EVENT_TYPES[2];
                  return (
                    <div key={ev.id} className={`mb-1.5 rounded-lg p-2 border border-white/10 ${ev.completed ? 'opacity-40' : ''}`} style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleComplete(ev.id, !ev.completed)} className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${ev.completed ? 'bg-emerald-500/30 border-emerald-400' : 'border-white/30'}`}>
                          {ev.completed && <span className="material-symbols-outlined text-emerald-300" style={{ fontSize: 10 }}>check</span>}
                        </button>
                        <span className={`text-[10px] font-semibold truncate ${ev.completed ? 'line-through text-white/40' : 'text-white/80'}`}>{ev.title}</span>
                      </div>
                      {ev.start_time && <div className="text-[9px] text-white/40 mt-0.5 ml-5">{fmtTime(ev.start_time)}</div>}
                      <span className={`text-[7px] font-bold px-1 py-0.5 rounded ml-5 mt-0.5 inline-block ${type.color}`}>{type.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
