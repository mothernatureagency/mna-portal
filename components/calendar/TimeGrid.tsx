'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  ScheduleEvent, ColorBy, eventHex, alpha, fromISO, fmtHour, fmtTime, isAllDay,
  layoutDay, minToTime, typeMeta, todayStr,
} from './calendarUtils';

const HOUR_PX = 56;
const SNAP = 15;

type Props = {
  days: string[];
  eventsByDate: Record<string, ScheduleEvent[]>;
  colorBy: ColorBy;
  onSelectEvent: (ev: ScheduleEvent) => void;
  onCreateAt: (date: string, start: string) => void;
  onMove: (ev: ScheduleEvent, date: string, start: string | null) => void;
  onToggleComplete: (ev: ScheduleEvent) => void;
  onOpenDay: (date: string) => void;
};

export default function TimeGrid({ days, eventsByDate, colorBy, onSelectEvent, onCreateAt, onMove, onToggleComplete, onOpenDay }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const today = todayStr();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Open scrolled to the working day (or just before the current time).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const showsToday = days.includes(today);
    const hour = showsToday ? Math.max(0, new Date().getHours() - 2) : 7;
    el.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const multi = days.length > 1;
  const cols = `56px repeat(${days.length}, minmax(${multi ? 110 : 0}px, 1fr))`;

  function minuteFromEvent(e: React.MouseEvent | React.DragEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.floor(((y / HOUR_PX) * 60) / SNAP) * SNAP;
  }

  function handleDrop(e: React.DragEvent, date: string, timed: boolean) {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData('application/x-mna-event');
    if (!raw) return;
    const ev: ScheduleEvent = JSON.parse(raw);
    if (!timed) { onMove(ev, date, null); return; }
    // Keep the spot the event was grabbed by under the pointer.
    const grab = Number(e.dataTransfer.getData('application/x-mna-grab') || 0);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pointerMin = ((e.clientY - rect.top) / HOUR_PX) * 60;
    onMove(ev, date, minToTime(Math.max(0, Math.round((pointerMin - grab) / SNAP) * SNAP)));
  }

  return (
    <div className="lg-surface overflow-hidden">
      <div className="overflow-x-auto lg-scroll">
        <div style={{ minWidth: multi ? 56 + days.length * 110 : undefined }}>
          {/* Day headers */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d) => {
              const dt = fromISO(d);
              const isT = d === today;
              return (
                <button key={d} onClick={() => onOpenDay(d)} className="py-3 flex flex-col items-center gap-1 hover:bg-white/5 transition-colors">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isT ? 'text-cyan-200' : 'text-white/45'}`}>
                    {dt.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-[17px] font-semibold ${isT ? 'text-white' : 'text-white/85'}`}
                    style={isT ? { background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)', boxShadow: '0 4px 14px rgba(74,184,206,0.45), inset 0 1px 0 rgba(255,255,255,0.4)' } : undefined}
                  >
                    {dt.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* All-day row */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: cols }}>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/35 flex items-start justify-end pr-2 pt-2">All day</div>
            {days.map((d) => {
              const allDay = (eventsByDate[d] || []).filter(isAllDay);
              return (
                <div
                  key={d}
                  className={`min-h-[38px] p-1 space-y-1 border-l border-white/[0.06] ${dragOver === `${d}-allday` ? 'bg-white/10' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(`${d}-allday`); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, d, false)}
                >
                  {allDay.map((ev) => (
                    <Chip key={ev.id} ev={ev} colorBy={colorBy} onClick={() => onSelectEvent(ev)} onToggle={() => onToggleComplete(ev)} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Timed grid */}
          <div ref={scrollRef} className="overflow-y-auto lg-scroll" style={{ height: 'min(68vh, 720px)' }}>
            <div className="grid relative" style={{ gridTemplateColumns: cols, height: 24 * HOUR_PX }}>
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 text-[10px] font-medium text-white/35 -translate-y-1/2" style={{ top: h * HOUR_PX }}>
                    {h === 0 ? '' : fmtHour(h)}
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const placed = layoutDay((eventsByDate[d] || []).filter((e) => !isAllDay(e)));
                const isT = d === today;
                return (
                  <div
                    key={d}
                    className={`relative border-l border-white/[0.06] ${isT ? 'bg-cyan-300/[0.03]' : ''} ${dragOver === d ? 'bg-white/[0.07]' : ''}`}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      const m = Math.floor(minuteFromEvent(e) / 30) * 30;
                      onCreateAt(d, minToTime(m));
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(e, d, true)}
                  >
                    {hours.map((h) => (
                      <React.Fragment key={h}>
                        <div className="absolute left-0 right-0 border-t border-white/[0.07] pointer-events-none" style={{ top: h * HOUR_PX }} />
                        <div className="absolute left-0 right-0 border-t border-dashed border-white/[0.03] pointer-events-none" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                      </React.Fragment>
                    ))}

                    {placed.map(({ ev, start, end, col, cols: n }) => {
                      const hex = eventHex(ev, colorBy);
                      const top = (start / 60) * HOUR_PX;
                      const height = Math.max(((end - start) / 60) * HOUR_PX - 2, 20);
                      const compact = height < 40;
                      const blocked = ev.event_type === 'blocked';
                      const draggable = ev.event_type !== 'google';
                      return (
                        <div
                          key={ev.id}
                          draggable={draggable}
                          onDragStart={(e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData('application/x-mna-event', JSON.stringify(ev));
                            e.dataTransfer.setData('application/x-mna-grab', String(((e.clientY - r.top) / HOUR_PX) * 60));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => onSelectEvent(ev)}
                          className={`lg-event absolute rounded-xl px-2 py-1 overflow-hidden cursor-pointer ${blocked ? 'lg-hatch' : ''} ${ev.completed ? 'opacity-45' : ''}`}
                          style={{
                            top: top + 1,
                            height,
                            left: `calc(${(col / n) * 100}% + 2px)`,
                            width: `calc(${100 / n}% - 4px)`,
                            background: blocked ? undefined : `linear-gradient(160deg, ${alpha(hex, 0.38)}, ${alpha(hex, 0.18)})`,
                            border: `1px solid ${alpha(hex, 0.55)}`,
                            borderLeft: `3px solid ${hex}`,
                          }}
                          title={`${ev.title} · ${fmtTime(ev.start_time)}${ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}`}
                        >
                          <div className={`flex items-start gap-1 ${compact ? 'items-center' : ''}`}>
                            {ev.event_type === 'task' || ev.event_type === 'deadline' ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleComplete(ev); }}
                                className="mt-[1px] w-3.5 h-3.5 shrink-0 rounded-[5px] border flex items-center justify-center"
                                style={{ borderColor: hex, background: ev.completed ? hex : 'transparent' }}
                              >
                                {ev.completed && <span className="material-symbols-outlined text-black/70" style={{ fontSize: 11 }}>check</span>}
                              </button>
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <div className={`text-[11px] font-semibold leading-tight truncate text-white ${ev.completed ? 'line-through' : ''}`}>
                                {ev.title}{compact && <span className="font-normal text-white/60"> · {fmtTime(ev.start_time)}</span>}
                              </div>
                              {!compact && (
                                <div className="text-[10px] text-white/65 truncate">
                                  {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                                  {ev.meet_link ? ' · Meet' : ev.location ? ` · ${ev.location}` : ''}
                                </div>
                              )}
                              {height > 70 && (
                                <div className="flex items-center gap-1 mt-0.5 text-[9px] text-white/55">
                                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{typeMeta(ev.event_type).icon}</span>
                                  {typeMeta(ev.event_type).label}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isT && (
                      <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: (nowMin / 60) * HOUR_PX }}>
                        <div className="relative h-[2px] bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]">
                          <div className="absolute -left-1 -top-[4px] w-2.5 h-2.5 rounded-full bg-rose-400" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Chip({ ev, colorBy, onClick, onToggle }: { ev: ScheduleEvent; colorBy: ColorBy; onClick: () => void; onToggle?: () => void }) {
  const hex = eventHex(ev, colorBy);
  const checkable = onToggle && (ev.event_type === 'task' || ev.event_type === 'deadline');
  return (
    <div
      draggable={ev.event_type !== 'google'}
      onDragStart={(e) => { e.dataTransfer.setData('application/x-mna-event', JSON.stringify(ev)); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`lg-event flex items-center gap-1.5 rounded-lg px-1.5 py-[3px] cursor-pointer ${ev.event_type === 'blocked' ? 'lg-hatch' : ''} ${ev.completed ? 'opacity-45' : ''}`}
      style={{
        background: ev.event_type === 'blocked' ? undefined : alpha(hex, 0.22),
        border: `1px solid ${alpha(hex, 0.4)}`,
      }}
      title={ev.title}
    >
      {checkable ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle!(); }}
          className="w-3 h-3 shrink-0 rounded-[4px] border flex items-center justify-center"
          style={{ borderColor: hex, background: ev.completed ? hex : 'transparent' }}
        >
          {ev.completed && <span className="material-symbols-outlined text-black/70" style={{ fontSize: 10 }}>check</span>}
        </button>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
      )}
      {ev.start_time && !isAllDay(ev) && <span className="text-[10px] text-white/55 shrink-0">{fmtTime(ev.start_time)}</span>}
      <span className={`text-[11px] font-medium text-white/90 truncate ${ev.completed ? 'line-through' : ''}`}>{ev.title}</span>
    </div>
  );
}
