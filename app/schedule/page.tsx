'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';
import TimeGrid from '@/components/calendar/TimeGrid';
import MonthGrid from '@/components/calendar/MonthGrid';
import TaskList from '@/components/calendar/TaskList';
import EventModal, { EventDraft, blankDraft, draftFrom } from '@/components/calendar/EventModal';
import {
  ScheduleEvent, ViewMode, ColorBy, EVENT_TYPES, PRIORITIES, addDays, addMonths, clientHex, legendKey,
  rangeTitle, startOfWeek, timeToMin, minToTime, todayStr, viewRange, isAllDay,
} from '@/components/calendar/calendarUtils';

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

// The task list looks this far either side of today, so overdue items stay visible.
const TASK_LOOKBACK = 60;
const TASK_LOOKAHEAD = 60;

function isTask(ev: ScheduleEvent) {
  return ev.event_type === 'task' || ev.event_type === 'deadline';
}

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch { return fallback; }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
}

export default function SchedulePage() {
  const ctx = useClient() as any;
  const allClients: { id: string; shortName: string }[] = (ctx?.allClients || []).filter((c: any) => c.id !== 'mna');

  const [userEmail, setUserEmail] = useState('');
  const [view, setView] = useState<ViewMode>('week');
  const [colorBy, setColorBy] = useState<ColorBy>('type');
  const [anchor, setAnchor] = useState(todayStr());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<ScheduleEvent[]>([]);
  const [tasks, setTasks] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hideDone, setHideDone] = useState(false);

  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);

  const [modalDraft, setModalDraft] = useState<EventDraft | null>(null);
  const [modalSource, setModalSource] = useState<ScheduleEvent | null>(null);

  // Restore view + colour preferences.
  useEffect(() => {
    setView(readPref('mna.schedule.view', ['day', 'week', 'month'] as const, 'week'));
    setColorBy(readPref('mna.schedule.colorBy', ['type', 'client', 'priority'] as const, 'type'));
  }, []);
  useEffect(() => { writePref('mna.schedule.view', view); }, [view]);
  useEffect(() => { writePref('mna.schedule.colorBy', colorBy); setHidden(new Set()); }, [colorBy]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setUserEmail(email);
      if (email) {
        fetch(`/api/google/status?email=${encodeURIComponent(email)}`)
          .then((r) => r.json())
          .then((d) => setGcalConnected(!!d.connected))
          .catch(() => {});
      }
    });
  }, []);

  const [from, to] = viewRange(view, anchor);

  // Calendar range
  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setEvents(d.events || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    if (gcalConnected) {
      fetch(`/api/google/sync?email=${encodeURIComponent(userEmail)}&from=${from}&to=${to}`)
        .then((r) => r.json())
        // /api/google/sync returns `date`; the calendar groups by `event_date`.
        .then((d) => {
          if (cancelled) return;
          setGoogleEvents((d.events || []).map((e: any) => ({
            ...e,
            event_date: e.date || e.event_date,
            event_type: 'google',
            priority: 'normal',
            client_id: null,
            completed: false,
          })));
        })
        .catch(() => { if (!cancelled) setGoogleEvents([]); });
    } else {
      setGoogleEvents([]);
    }
    return () => { cancelled = true; };
  }, [userEmail, from, to, gcalConnected, reloadKey]);

  // Task list range
  useEffect(() => {
    if (!userEmail) return;
    const t = todayStr();
    fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${addDays(t, -TASK_LOOKBACK)}&to=${addDays(t, TASK_LOOKAHEAD)}`)
      .then((r) => r.json())
      .then((d) => setTasks((d.events || []).filter(isTask)))
      .catch(() => {});
  }, [userEmail, reloadKey]);

  const clientName = useCallback((id: string | null) => allClients.find((c) => c.id === id)?.shortName, [allClients]);

  // ─── Mutations (optimistic across both lists) ───
  function applyLocal(id: string, patch: Partial<ScheduleEvent>) {
    const up = (list: ScheduleEvent[]) => list.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEvents(up);
    setTasks((prev) => {
      const next = up(prev);
      const ev = next.find((e) => e.id === id);
      return ev && !isTask(ev) ? next.filter((e) => e.id !== id) : next;
    });
  }

  async function patchEvent(ev: ScheduleEvent, patch: Record<string, any>) {
    const before = { ...ev };
    applyLocal(ev.id, patch);
    const res = await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ev.id, ...patch }),
    });
    if (!res.ok) {
      applyLocal(ev.id, before);
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not update the event');
      return null;
    }
    const data = await res.json();
    applyLocal(ev.id, data.event);
    return data.event as ScheduleEvent;
  }

  function toggleComplete(ev: ScheduleEvent) {
    if (ev.event_type === 'google' || ev.event_type === 'blocked') return;
    patchEvent(ev, { completed: !ev.completed });
    if (modalSource?.id === ev.id) setModalSource({ ...ev, completed: !ev.completed });
  }

  function moveEvent(ev: ScheduleEvent, date: string, start: string | null) {
    if (ev.event_type === 'google') return;
    const patch: Record<string, any> = { event_date: date };
    if (start && !isAllDay(ev)) {
      const dur = ev.end_time ? timeToMin(ev.end_time) - timeToMin(ev.start_time) : 60;
      patch.start_time = start;
      patch.end_time = minToTime(timeToMin(start) + Math.max(dur, 15));
    }
    if (date === ev.event_date && patch.start_time === ev.start_time) return;
    patchEvent(ev, patch);
  }

  async function quickAddTask(title: string, date: string, priority: string) {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, title, eventDate: date, eventType: 'task', priority, meetingMode: 'none' }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setTasks((prev) => [...prev, data.event]);
    if (data.event.event_date >= from && data.event.event_date <= to) setEvents((prev) => [...prev, data.event]);
  }

  async function saveDraft(d: EventDraft) {
    const blocked = d.event_type === 'blocked';
    const startTime = d.all_day ? (blocked ? '00:00' : null) : d.start_time || null;
    const endTime = d.all_day ? (blocked ? '23:59' : null) : d.end_time || null;

    if (d.id && modalSource) {
      const updated = await patchEvent(modalSource, {
        title: d.title.trim(),
        description: d.description || null,
        event_date: d.event_date,
        start_time: startTime,
        end_time: endTime,
        event_type: d.event_type,
        priority: d.priority,
        client_id: d.client_id || null,
        color: d.color || null,
        attendees: d.attendees || null,
        location: d.location || null,
      });
      if (updated) closeModal();
      return;
    }

    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        clientId: d.client_id || null,
        title: d.title.trim(),
        description: d.description || null,
        eventDate: d.event_date,
        startTime,
        endTime,
        eventType: d.event_type,
        priority: blocked ? 'normal' : d.priority,
        attendees: d.attendees || null,
        meetingMode: d.meeting_mode,
        location: d.location || null,
        recurrence: d.recurrence,
        recurrenceEnd: d.recurrence_end || null,
        color: d.color || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    closeModal();
    // Recurring series create rows server-side — reload rather than guess them.
    setReloadKey((k) => k + 1);
  }

  async function deleteEvent(ev: ScheduleEvent) {
    const isRecurring = (ev.recurrence && ev.recurrence !== 'none') || ev.recurring_parent_id;
    let series = false;
    if (isRecurring) {
      if (confirm('Delete the entire recurring series?\n\nOK = whole series · Cancel = choose just this one')) series = true;
      else if (!confirm('Delete just this occurrence?')) return;
    } else if (!confirm(`Delete “${ev.title}”?`)) return;

    const parentId = ev.recurring_parent_id || ev.id;
    const res = await fetch(`/api/schedule?id=${series ? parentId : ev.id}${series ? '&series=true' : ''}`, { method: 'DELETE' });
    if (!res.ok) { alert('Could not delete the event'); return; }
    const keep = (e: ScheduleEvent) => (series ? e.id !== parentId && e.recurring_parent_id !== parentId : e.id !== ev.id);
    setEvents((prev) => prev.filter(keep));
    setTasks((prev) => prev.filter(keep));
    closeModal();
  }

  // ─── Modal helpers ───
  function openCreate(date: string, start = '09:00', overrides: Partial<EventDraft> = {}) {
    setModalSource(null);
    setModalDraft(blankDraft(date, start, overrides));
  }
  function openEvent(ev: ScheduleEvent) {
    setModalSource(ev);
    setModalDraft(draftFrom(ev));
  }
  const closeModal = useCallback(() => { setModalDraft(null); setModalSource(null); }, []);

  // ─── Navigation ───
  const step = useCallback((dir: 1 | -1) => {
    setAnchor((a) => (view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : addMonths(a, dir)));
  }, [view]);
  const openDay = (d: string) => { setAnchor(d); setView('day'); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (modalDraft || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'd') setView('day');
      else if (k === 'w') setView('week');
      else if (k === 'm') setView('month');
      else if (k === 't') setAnchor(todayStr());
      else if (k === 'n') openCreate(anchor);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ─── Derived ───
  const legend = useMemo(() => {
    if (colorBy === 'priority') return PRIORITIES.map((p) => ({ key: p.value, label: p.label, hex: p.hex }));
    if (colorBy === 'client') {
      const ids = Array.from(new Set([...events, ...googleEvents].map((e) => e.client_id || '__none')));
      return ids.map((id) => ({
        key: id,
        label: id === '__none' ? 'No client' : clientName(id) || id,
        hex: id === '__none' ? clientHex(null) : clientHex(id),
      }));
    }
    const present = new Set([...events, ...googleEvents].map((e) => e.event_type));
    return EVENT_TYPES.filter((t) => present.has(t.value) || ['meeting', 'call', 'task', 'deadline'].includes(t.value))
      .map((t) => ({ key: t.value, label: t.label, hex: t.hex }));
  }, [colorBy, events, googleEvents, clientName]);

  const visible = useMemo(
    () => [...events, ...googleEvents].filter((e) => !hidden.has(legendKey(e, colorBy)) && !(hideDone && e.completed)),
    [events, googleEvents, hidden, colorBy, hideDone],
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    for (const e of visible) {
      if (!e?.event_date) continue;
      (map[e.event_date] ||= []).push(e);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    return map;
  }, [visible]);

  const today = todayStr();
  const todays = [...events, ...googleEvents].filter((e) => e.event_date === today);
  const nextUp = todays
    .filter((e) => !e.completed && e.start_time && !isAllDay(e) && timeToMin(e.end_time || e.start_time) >= new Date().getHours() * 60 + new Date().getMinutes())
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))[0];
  const overdueCount = tasks.filter((t) => !t.completed && t.event_date < today).length;

  const days = view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const inRange = today >= from && today <= to;

  async function connectGoogle() {
    setGcalLoading(true);
    try {
      const res = await fetch(`/api/google/connect?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setGcalLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06))', border: '1px solid rgba(255,255,255,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px rgba(0,0,0,0.2)' }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>calendar_month</span>
            </span>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight leading-none">Schedule</h1>
              <p className="text-white/55 text-[13px] mt-1.5 flex items-center gap-2 flex-wrap">
                <span>{todays.length} today</span>
                {nextUp && (
                  <span className="text-cyan-200">· Next: <b className="font-semibold">{nextUp.title}</b> at {nextUp.start_time?.slice(0, 5)}</span>
                )}
                {overdueCount > 0 && <span className="text-rose-300 font-semibold">· {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {gcalConnected ? (
            <button
              onClick={connectGoogle}
              disabled={gcalLoading || !userEmail}
              title="Google Calendar is connected — click to reconnect / grant Drive access"
              className="lg-btn px-3 py-2 text-[11px] font-semibold !text-emerald-200 disabled:opacity-40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
              {gcalLoading ? 'Connecting…' : 'Google synced'}
            </button>
          ) : (
            <button onClick={connectGoogle} disabled={gcalLoading || !userEmail} className="lg-btn px-3 py-2 text-[11px] font-semibold disabled:opacity-40">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_link</span>
              {gcalLoading ? 'Connecting…' : 'Connect Google Calendar'}
            </button>
          )}
          <button
            onClick={() => openCreate(anchor, '09:00', { event_type: 'blocked', title: 'Blocked', meeting_mode: 'none', end_time: '17:00' })}
            className="lg-btn px-3 py-2 text-[12px] font-semibold"
            title="Block time so clients can't book it"
          >
            <span className="material-symbols-outlined text-rose-300" style={{ fontSize: 16 }}>block</span>
            Block time
          </button>
          <button
            onClick={() => openCreate(anchor)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold text-white transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 18px rgba(12,109,164,0.45)' }}
            title="New event (N)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="lg-surface !rounded-full px-2 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setAnchor(todayStr())} className={`lg-btn px-3.5 py-1.5 text-[12px] font-semibold ${inRange ? '!text-cyan-100' : ''}`} title="Today (T)">
            Today
          </button>
          <button onClick={() => step(-1)} className="lg-btn w-8 h-8" aria-label="Previous" title="Previous (←)">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <button onClick={() => step(1)} className="lg-btn w-8 h-8" aria-label="Next" title="Next (→)">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
          <div className="relative ml-1">
            <div className="text-[16px] font-semibold text-white px-1 whitespace-nowrap">{rangeTitle(view, anchor)}</div>
            <input
              type="date"
              value={anchor}
              onChange={(e) => e.target.value && setAnchor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Jump to date"
            />
          </div>
          {loading && <span className="w-3.5 h-3.5 ml-1 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as ColorBy)}
            className="lg-input !w-auto !rounded-full !py-1.5 !text-[12px]"
            title="Color code by"
          >
            <option value="type">Color by type</option>
            <option value="client">Color by client</option>
            <option value="priority">Color by priority</option>
          </select>
          <div className="lg-segment" role="tablist">
            <span
              className="lg-segment-thumb"
              style={{ width: `calc((100% - 8px) / ${VIEWS.length})`, transform: `translateX(${VIEWS.findIndex((v) => v.value === view) * 100}%)` }}
            />
            {VIEWS.map((v) => (
              <button
                key={v.value}
                role="tab"
                aria-selected={view === v.value}
                onClick={() => setView(v.value)}
                className={`px-4 py-1.5 text-[12px] font-semibold transition-colors ${view === v.value ? 'text-white' : 'text-white/55 hover:text-white/80'}`}
                title={`${v.label} (${v.label[0]})`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colour legend / filters */}
      <div className="flex items-center gap-1.5 flex-wrap -mt-1">
        {legend.map((l) => {
          const off = hidden.has(l.key);
          return (
            <button
              key={l.key}
              onClick={() => setHidden((prev) => {
                const next = new Set(prev);
                if (next.has(l.key)) next.delete(l.key); else next.add(l.key);
                return next;
              })}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${off ? 'opacity-40 line-through' : ''}`}
              style={{ background: off ? 'transparent' : `${l.hex}1f`, borderColor: `${l.hex}55`, color: 'rgba(255,255,255,0.85)' }}
              title={off ? 'Show' : 'Hide'}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: l.hex, boxShadow: off ? 'none' : `0 0 6px ${l.hex}` }} />
              {l.label}
            </button>
          );
        })}
        <button
          onClick={() => setHideDone(!hideDone)}
          className={`ml-auto flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${hideDone ? 'bg-white/15 border-white/30 text-white' : 'border-white/12 text-white/50 hover:text-white/80'}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{hideDone ? 'visibility_off' : 'visibility'}</span>
          {hideDone ? 'Completed hidden' : 'Hide completed'}
        </button>
      </div>

      {/* Calendar + task list */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start">
        <div className="min-w-0">
          {view === 'month' ? (
            <MonthGrid
              anchor={anchor}
              eventsByDate={eventsByDate}
              colorBy={colorBy}
              onSelectEvent={openEvent}
              onCreateOn={(d) => openCreate(d)}
              onMove={(ev, d) => moveEvent(ev, d, null)}
              onToggleComplete={toggleComplete}
              onOpenDay={openDay}
            />
          ) : (
            <TimeGrid
              days={days}
              eventsByDate={eventsByDate}
              colorBy={colorBy}
              onSelectEvent={openEvent}
              onCreateAt={(d, start) => openCreate(d, start)}
              onMove={moveEvent}
              onToggleComplete={toggleComplete}
              onOpenDay={openDay}
            />
          )}
          <div className="text-[10px] text-white/30 mt-2 px-2 hidden md:block">
            Tip: click an empty slot to add · drag events to reschedule · keys D / W / M switch views, T jumps to today, N adds an event
          </div>
        </div>

        <TaskList
          tasks={tasks}
          colorBy={colorBy}
          clientName={clientName}
          onToggle={toggleComplete}
          onSelect={(t) => openEvent(t)}
          onQuickAdd={quickAddTask}
        />
      </div>

      <EventModal
        open={!!modalDraft}
        draft={modalDraft}
        source={modalSource}
        clients={allClients}
        onClose={closeModal}
        onSave={saveDraft}
        onDelete={deleteEvent}
        onToggleComplete={toggleComplete}
      />
    </div>
  );
}
