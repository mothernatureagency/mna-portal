'use client';
import React, { useMemo, useState } from 'react';
import { ScheduleEvent, ColorBy, eventHex, fromISO, todayStr, addDays, fmtTime } from './calendarUtils';

type Props = {
  tasks: ScheduleEvent[];
  colorBy: ColorBy;
  clientName: (id: string | null) => string | undefined;
  onToggle: (ev: ScheduleEvent) => void;
  onSelect: (ev: ScheduleEvent) => void;
  onQuickAdd: (title: string, date: string, priority: string) => Promise<void>;
};

export default function TaskList({ tasks, colorBy, clientName, onToggle, onSelect, onQuickAdd }: Props) {
  const today = todayStr();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [high, setHigh] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    const byDate = (a: ScheduleEvent, b: ScheduleEvent) =>
      a.event_date.localeCompare(b.event_date) ||
      (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0) ||
      (a.start_time || '99').localeCompare(b.start_time || '99');
    const weekEnd = addDays(today, 7);
    return [
      { key: 'overdue', label: 'Overdue', tone: 'text-rose-300', items: open.filter((t) => t.event_date < today).sort(byDate) },
      { key: 'today', label: 'Today', tone: 'text-cyan-200', items: open.filter((t) => t.event_date === today).sort(byDate) },
      { key: 'week', label: 'Next 7 days', tone: 'text-white/60', items: open.filter((t) => t.event_date > today && t.event_date <= weekEnd).sort(byDate) },
      { key: 'later', label: 'Later', tone: 'text-white/45', items: open.filter((t) => t.event_date > weekEnd).sort(byDate) },
    ];
  }, [tasks, today]);

  const done = useMemo(() => tasks.filter((t) => t.completed).sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 15), [tasks]);
  const todayTotal = tasks.filter((t) => t.event_date === today).length;
  const todayDone = tasks.filter((t) => t.event_date === today && t.completed).length;
  const pct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onQuickAdd(title.trim(), date, high ? 'high' : 'normal');
      setTitle('');
      setHigh(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lg-surface p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-200" style={{ fontSize: 20 }}>checklist</span>
          <h2 className="text-[15px] font-bold text-white">Task List</h2>
        </div>
        <ProgressRing pct={pct} label={`${todayDone}/${todayTotal}`} />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="lg-input flex-1"
          />
          <button type="submit" disabled={!title.trim() || saving} className="lg-btn w-9 h-9 shrink-0 disabled:opacity-40" title="Add task">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="lg-input !py-1.5 !text-[11px] flex-1" />
          <button
            type="button"
            onClick={() => setHigh(!high)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${high ? 'bg-rose-400/20 border-rose-300/40 text-rose-200' : 'border-white/15 text-white/50 hover:text-white/80'}`}
          >
            <span className="material-symbols-outlined mr-0.5" style={{ fontSize: 12, verticalAlign: 'middle' }}>flag</span>
            High
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto lg-scroll -mr-2 pr-2">
        {groups.every((g) => g.items.length === 0) && (
          <div className="text-center py-6 text-white/40 text-[12px]">
            <span className="material-symbols-outlined block mb-1 text-emerald-200/60" style={{ fontSize: 28 }}>task_alt</span>
            All caught up
          </div>
        )}
        {groups.map((g) => g.items.length > 0 && (
          <div key={g.key}>
            <div className={`text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 flex items-center gap-1.5 ${g.tone}`}>
              {g.label}
              <span className="px-1.5 rounded-full bg-white/10 text-white/60 text-[9px]">{g.items.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {g.items.map((t) => (
                <TaskRow key={t.id} t={t} colorBy={colorBy} clientName={clientName(t.client_id)} showDate={g.key !== 'today'} onToggle={onToggle} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}

        {done.length > 0 && (
          <div>
            <button onClick={() => setShowDone(!showDone)} className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 hover:text-white/70 flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showDone ? 'expand_less' : 'expand_more'}</span>
              Completed ({done.length})
            </button>
            {showDone && (
              <div className="flex flex-col gap-1 mt-1.5">
                {done.map((t) => (
                  <TaskRow key={t.id} t={t} colorBy={colorBy} clientName={clientName(t.client_id)} showDate onToggle={onToggle} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ t, colorBy, clientName, showDate, onToggle, onSelect }: {
  t: ScheduleEvent; colorBy: ColorBy; clientName?: string; showDate: boolean;
  onToggle: (ev: ScheduleEvent) => void; onSelect: (ev: ScheduleEvent) => void;
}) {
  const hex = eventHex(t, colorBy);
  return (
    <div
      onClick={() => onSelect(t)}
      className="group flex items-start gap-2.5 px-2.5 py-2 rounded-2xl cursor-pointer transition-colors hover:bg-white/[0.07]"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(t); }}
        className="mt-[1px] w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110"
        style={{ borderColor: hex, background: t.completed ? hex : 'transparent', boxShadow: t.completed ? `0 0 10px ${hex}` : undefined }}
        aria-label={t.completed ? 'Mark not done' : 'Mark done'}
      >
        {t.completed && <span className="material-symbols-outlined text-black/70" style={{ fontSize: 13 }}>check</span>}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[12.5px] font-medium leading-snug ${t.completed ? 'line-through text-white/40' : 'text-white/90'}`}>{t.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-white/45">
          {showDate && <span>{fromISO(t.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
          {t.start_time && <span>{fmtTime(t.start_time)}</span>}
          {t.event_type === 'deadline' && <span className="text-rose-300 font-semibold">Deadline</span>}
          {t.priority === 'high' && <span className="text-rose-300 font-semibold flex items-center"><span className="material-symbols-outlined" style={{ fontSize: 11 }}>flag</span>High</span>}
          {clientName && <span className="px-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>{clientName}</span>}
        </div>
      </div>
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: hex, opacity: 0.8 }} />
    </div>
  );
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2" title="Today's tasks done">
      <span className="text-[10px] text-white/50 font-semibold">Today {label}</span>
      <svg width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle
          cx="19" cy="19" r={r} fill="none" stroke="url(#lgRing)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          transform="rotate(-90 19 19)" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <defs>
          <linearGradient id="lgRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ab8ce" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <text x="19" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{pct}%</text>
      </svg>
    </div>
  );
}
