'use client';
import React, { useState } from 'react';
import { ScheduleEvent, ColorBy, fromISO, monthGrid, todayStr, isAllDay, eventHex } from './calendarUtils';
import { Chip } from './TimeGrid';

type Props = {
  anchor: string;
  eventsByDate: Record<string, ScheduleEvent[]>;
  colorBy: ColorBy;
  onSelectEvent: (ev: ScheduleEvent) => void;
  onCreateOn: (date: string) => void;
  onMove: (ev: ScheduleEvent, date: string) => void;
  onToggleComplete: (ev: ScheduleEvent) => void;
  onOpenDay: (date: string) => void;
};

const MAX_VISIBLE = 3;

export default function MonthGrid({ anchor, eventsByDate, colorBy, onSelectEvent, onCreateOn, onMove, onToggleComplete, onOpenDay }: Props) {
  const days = monthGrid(anchor);
  const month = fromISO(anchor).getMonth();
  const today = todayStr();
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="lg-surface overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            {fromISO(d).toLocaleDateString(undefined, { weekday: 'short' })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const dt = fromISO(d);
          const inMonth = dt.getMonth() === month;
          const isT = d === today;
          const list = [...(eventsByDate[d] || [])].sort((a, b) => {
            const ad = isAllDay(a) ? 0 : 1, bd = isAllDay(b) ? 0 : 1;
            return ad - bd || (a.start_time || '').localeCompare(b.start_time || '');
          });
          const extra = list.length - MAX_VISIBLE;
          const openTasks = list.filter((e) => (e.event_type === 'task' || e.event_type === 'deadline') && !e.completed).length;
          return (
            <div
              key={d}
              onClick={() => onCreateOn(d)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const raw = e.dataTransfer.getData('application/x-mna-event');
                if (raw) onMove(JSON.parse(raw), d);
              }}
              className={`min-h-[118px] p-1.5 flex flex-col gap-1 cursor-pointer transition-colors
                ${i % 7 ? 'border-l border-white/[0.06]' : ''} ${i >= 7 ? 'border-t border-white/[0.06]' : ''}
                ${inMonth ? '' : 'bg-black/[0.08]'} ${dragOver === d ? 'bg-white/10' : 'hover:bg-white/[0.04]'}`}
            >
              <div className="flex items-center justify-between px-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenDay(d); }}
                  className={`w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center transition-colors
                    ${isT ? 'text-white' : inMonth ? 'text-white/85 hover:bg-white/10' : 'text-white/30 hover:bg-white/10'}`}
                  style={isT ? { background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)', boxShadow: '0 3px 10px rgba(74,184,206,0.45), inset 0 1px 0 rgba(255,255,255,0.4)' } : undefined}
                >
                  {dt.getDate()}
                </button>
                {openTasks > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/20" title={`${openTasks} open task${openTasks > 1 ? 's' : ''}`}>
                    {openTasks} ✓
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-[3px] min-w-0">
                {list.slice(0, MAX_VISIBLE).map((ev) => (
                  <Chip key={ev.id} ev={ev} colorBy={colorBy} onClick={() => onSelectEvent(ev)} onToggle={() => onToggleComplete(ev)} />
                ))}
                {extra > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenDay(d); }}
                    className="text-left text-[10px] font-semibold text-white/55 hover:text-white px-1.5 flex items-center gap-1"
                  >
                    <span className="flex -space-x-0.5">
                      {list.slice(MAX_VISIBLE, MAX_VISIBLE + 4).map((ev) => (
                        <span key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ background: eventHex(ev, colorBy) }} />
                      ))}
                    </span>
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
