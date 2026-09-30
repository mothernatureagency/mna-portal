'use client';
import React, { useEffect, useState } from 'react';
import {
  ScheduleEvent, EVENT_TYPES, PRIORITIES, PALETTE, typeMeta, fromISO, fmtTime, attendeesText, isAllDay,
} from './calendarUtils';

export type EventDraft = {
  id?: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string;
  priority: string;
  client_id: string;
  color: string;
  attendees: string;
  meeting_mode: 'none' | 'google_meet' | 'in_person';
  location: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end: string;
};

export function draftFrom(ev: ScheduleEvent): EventDraft {
  const allDay = isAllDay(ev);
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description || '',
    event_date: ev.event_date,
    start_time: allDay ? '09:00' : (ev.start_time || '09:00').slice(0, 5),
    end_time: allDay ? '10:00' : (ev.end_time || '').slice(0, 5),
    all_day: allDay,
    event_type: ev.event_type,
    priority: ev.priority || 'normal',
    client_id: ev.client_id || '',
    color: ev.color || '',
    attendees: attendeesText(ev.attendees),
    meeting_mode: (ev.meeting_mode as EventDraft['meeting_mode']) || 'none',
    location: ev.location || '',
    recurrence: (ev.recurrence as EventDraft['recurrence']) || 'none',
    recurrence_end: ev.recurrence_end || '',
  };
}

export function blankDraft(date: string, start = '09:00', overrides: Partial<EventDraft> = {}): EventDraft {
  const [h, m] = start.split(':').map(Number);
  const endH = Math.min(23, h + 1);
  return {
    title: '', description: '', event_date: date, start_time: start,
    end_time: `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    all_day: false, event_type: 'meeting', priority: 'normal', client_id: '', color: '',
    attendees: '', meeting_mode: 'google_meet', location: '', recurrence: 'none', recurrence_end: '',
    ...overrides,
  };
}

type Props = {
  open: boolean;
  draft: EventDraft | null;
  source: ScheduleEvent | null; // the event being viewed/edited, if any
  clients: { id: string; shortName: string }[];
  onClose: () => void;
  onSave: (d: EventDraft) => Promise<void>;
  onDelete: (ev: ScheduleEvent) => Promise<void>;
  onToggleComplete: (ev: ScheduleEvent) => void;
};

export default function EventModal({ open, draft, source, clients, onClose, onSave, onDelete, onToggleComplete }: Props) {
  const [d, setD] = useState<EventDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(draft), [draft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !d) return null;

  const isGoogle = source?.event_type === 'google';
  const isEdit = !!d.id;
  const set = (patch: Partial<EventDraft>) => setD({ ...d, ...patch });
  const typeHex = typeMeta(d.event_type).hex;
  const swatch = d.color ? PALETTE.find((p) => p.key === d.color)?.hex || typeHex : typeHex;

  async function save() {
    if (!d || !d.title.trim()) return;
    setSaving(true);
    try { await onSave(d); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="lg-surface relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto lg-scroll animate-in"
        style={{ background: 'linear-gradient(145deg, rgba(20,70,90,0.82), rgba(10,40,55,0.88))' }}
      >
        <div className="h-1.5 rounded-t-[26px]" style={{ background: `linear-gradient(90deg, ${swatch}, transparent)` }} />
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-white/60 text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: swatch }}>{typeMeta(d.event_type).icon}</span>
              {isGoogle ? 'Google Calendar' : isEdit ? 'Edit' : d.event_type === 'blocked' ? 'Block time' : 'New'}
            </div>
            <button onClick={onClose} className="lg-btn w-8 h-8 shrink-0" aria-label="Close">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>

          {isGoogle && source ? (
            <GoogleDetails ev={source} />
          ) : (
            <>
              <input
                autoFocus
                value={d.title}
                onChange={(e) => set({ title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                placeholder={d.event_type === 'blocked' ? 'Label (e.g. Lunch, Out of office)' : 'Add title'}
                className="w-full bg-transparent text-[22px] font-semibold text-white outline-none placeholder:text-white/30 border-b border-white/15 focus:border-white/40 pb-2"
              />

              {/* Type */}
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.filter((t) => t.value !== 'google').map((t) => {
                  const on = d.event_type === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => set({
                        event_type: t.value,
                        meeting_mode: t.value === 'meeting' || t.value === 'call' ? (d.meeting_mode === 'none' ? 'google_meet' : d.meeting_mode) : 'none',
                      })}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1"
                      style={on
                        ? { background: `${t.hex}33`, borderColor: `${t.hex}88`, color: '#fff', boxShadow: `0 0 12px ${t.hex}44` }
                        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13, color: t.hex }}>{t.icon}</span>
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* When */}
              <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr] gap-2 items-center">
                <input type="date" value={d.event_date} onChange={(e) => set({ event_date: e.target.value })} className="lg-input col-span-2 sm:col-span-1" />
                {!d.all_day && (
                  <>
                    <input type="time" value={d.start_time} onChange={(e) => set({ start_time: e.target.value })} className="lg-input" />
                    <input type="time" value={d.end_time} onChange={(e) => set({ end_time: e.target.value })} className="lg-input" />
                  </>
                )}
              </div>
              <label className="flex items-center gap-2 text-[12px] text-white/65 cursor-pointer w-fit">
                <input type="checkbox" checked={d.all_day} onChange={(e) => set({ all_day: e.target.checked })} className="rounded border-white/30 bg-white/5" />
                {d.event_type === 'blocked' ? 'Block the entire day' : 'All day / no set time'}
              </label>

              {/* Colour */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 mb-1.5">Color</div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => set({ color: '' })}
                    className={`h-7 px-2.5 rounded-full text-[10px] font-semibold border transition-all ${!d.color ? 'border-white/60 text-white' : 'border-white/15 text-white/50'}`}
                    style={{ background: `linear-gradient(135deg, ${typeHex}55, rgba(255,255,255,0.05))` }}
                    title="Use the color for this event's type/client/priority"
                  >
                    Auto
                  </button>
                  {PALETTE.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => set({ color: p.key })}
                      title={p.label}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${p.hex}ee, ${p.hex}99)`,
                        boxShadow: d.color === p.key ? `0 0 0 2px rgba(10,40,55,1), 0 0 0 4px ${p.hex}, 0 0 14px ${p.hex}` : 'inset 0 1px 0 rgba(255,255,255,0.4)',
                      }}
                    >
                      {d.color === p.key && <span className="material-symbols-outlined text-black/60" style={{ fontSize: 14 }}>check</span>}
                    </button>
                  ))}
                </div>
              </div>

              {d.event_type !== 'blocked' && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={d.priority} onChange={(e) => set({ priority: e.target.value })} className="lg-input">
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label} priority</option>)}
                  </select>
                  <select value={d.client_id} onChange={(e) => set({ client_id: e.target.value })} className="lg-input">
                    <option value="">No client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                  </select>
                </div>
              )}

              {(d.event_type === 'meeting' || d.event_type === 'call') && (
                <>
                  {!isEdit && (
                    <div className="grid grid-cols-2 gap-2">
                      {([['google_meet', 'videocam', 'Google Meet'], ['in_person', 'location_on', 'In person']] as const).map(([val, icon, label]) => (
                        <button
                          key={val}
                          onClick={() => set({ meeting_mode: val })}
                          className={`flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-2xl border transition-colors ${d.meeting_mode === val ? 'bg-white/15 border-white/35 text-white' : 'bg-white/[0.04] border-white/12 text-white/50 hover:text-white/80'}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>{label}
                        </button>
                      ))}
                    </div>
                  )}
                  {(d.meeting_mode === 'in_person' || d.location) && (
                    <input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Location" className="lg-input" />
                  )}
                  <input value={d.attendees} onChange={(e) => set({ attendees: e.target.value })} placeholder="Attendees (names or emails)" className="lg-input" />
                </>
              )}

              {!isEdit && d.event_type !== 'blocked' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 mr-1">Repeat</span>
                  {(['none', 'daily', 'weekly', 'biweekly', 'monthly'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => set({ recurrence: r })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${d.recurrence === r ? 'bg-white/15 border-white/35 text-white' : 'border-white/12 text-white/50 hover:text-white/80'}`}
                    >
                      {r === 'none' ? 'Never' : r === 'biweekly' ? 'Every 2 wks' : r[0].toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                  {d.recurrence !== 'none' && (
                    <input type="date" value={d.recurrence_end} onChange={(e) => set({ recurrence_end: e.target.value })} className="lg-input !w-auto !py-1 !text-[11px]" title="Repeat until (blank = 3 months)" />
                  )}
                </div>
              )}

              {d.event_type !== 'blocked' && (
                <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Notes" className="lg-input resize-none" />
              )}

              {source?.meet_link && (
                <a href={source.meet_link} target="_blank" rel="noopener noreferrer" className="lg-btn w-fit px-3 py-1.5 text-[12px] font-semibold !text-sky-200">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>Join Google Meet
                </a>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {source && (
                    <button
                      onClick={() => onDelete(source)}
                      className="lg-btn px-3 py-2 text-[12px] font-semibold !text-rose-200 hover:!bg-rose-500/20"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>Delete
                    </button>
                  )}
                  {source && source.event_type !== 'blocked' && (
                    <button onClick={() => onToggleComplete(source)} className="lg-btn px-3 py-2 text-[12px] font-semibold">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{source.completed ? 'undo' : 'check_circle'}</span>
                      {source.completed ? 'Reopen' : 'Done'}
                    </button>
                  )}
                </div>
                <button
                  onClick={save}
                  disabled={!d.title.trim() || saving}
                  className="px-5 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-40 transition-transform active:scale-95"
                  style={{ background: d.event_type === 'blocked' ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'linear-gradient(135deg, #0c6da4, #4ab8ce)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 18px rgba(12,109,164,0.4)' }}
                >
                  {saving ? 'Saving…' : isEdit ? 'Save' : d.event_type === 'blocked' ? 'Block time' : 'Create'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleDetails({ ev }: { ev: ScheduleEvent }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[22px] font-semibold text-white">{ev.title}</div>
      <div className="flex items-center gap-2 text-[13px] text-white/70">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
        {fromISO(ev.event_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        {ev.start_time && ` · ${fmtTime(ev.start_time)}${ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}`}
      </div>
      {ev.location && (
        <div className="flex items-center gap-2 text-[13px] text-white/70">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>{ev.location}
        </div>
      )}
      {attendeesText(ev.attendees) && (
        <div className="flex items-start gap-2 text-[12px] text-white/60">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>{attendeesText(ev.attendees)}
        </div>
      )}
      {ev.description && <div className="text-[12px] text-white/55 whitespace-pre-wrap line-clamp-6">{ev.description}</div>}
      {ev.htmlLink && (
        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="lg-btn w-fit px-3 py-1.5 text-[12px] font-semibold">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>Open in Google Calendar
        </a>
      )}
      <div className="text-[11px] text-white/35">Synced from Google — edit it there.</div>
    </div>
  );
}
