// Shared helpers for the Schedule calendar (day / week / month views + task list).

export type ScheduleEvent = {
  id: string;
  user_email?: string;
  client_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  priority: string;
  completed: boolean;
  attendees: string | string[] | null;
  meeting_mode?: string | null;
  location: string | null;
  meet_link?: string | null;
  recurrence?: string | null;
  recurrence_end?: string | null;
  recurring_parent_id?: string | null;
  color?: string | null;
  htmlLink?: string;
};

export type ViewMode = 'day' | 'week' | 'month';
export type ColorBy = 'type' | 'client' | 'priority';

// Named swatches that read well on the dark teal glass background.
export const PALETTE: { key: string; label: string; hex: string }[] = [
  { key: 'sky', label: 'Sky', hex: '#38bdf8' },
  { key: 'blue', label: 'Blue', hex: '#60a5fa' },
  { key: 'indigo', label: 'Indigo', hex: '#818cf8' },
  { key: 'violet', label: 'Violet', hex: '#a78bfa' },
  { key: 'pink', label: 'Pink', hex: '#f472b6' },
  { key: 'rose', label: 'Rose', hex: '#fb7185' },
  { key: 'red', label: 'Red', hex: '#ef4444' },
  { key: 'orange', label: 'Orange', hex: '#fb923c' },
  { key: 'amber', label: 'Amber', hex: '#fbbf24' },
  { key: 'lime', label: 'Lime', hex: '#a3e635' },
  { key: 'emerald', label: 'Emerald', hex: '#34d399' },
  { key: 'teal', label: 'Teal', hex: '#2dd4bf' },
  { key: 'slate', label: 'Slate', hex: '#94a3b8' },
];

export const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', icon: 'groups', hex: '#a78bfa' },
  { value: 'call', label: 'Call', icon: 'call', hex: '#38bdf8' },
  { value: 'task', label: 'Task', icon: 'task_alt', hex: '#34d399' },
  { value: 'deadline', label: 'Deadline', icon: 'alarm', hex: '#fb7185' },
  { value: 'review', label: 'Review', icon: 'rate_review', hex: '#fbbf24' },
  { value: 'personal', label: 'Personal', icon: 'person', hex: '#f472b6' },
  { value: 'blocked', label: 'Blocked', icon: 'block', hex: '#ef4444' },
  { value: 'google', label: 'Google Calendar', icon: 'event', hex: '#60a5fa' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low', hex: '#94a3b8' },
  { value: 'normal', label: 'Normal', hex: '#38bdf8' },
  { value: 'high', label: 'High', hex: '#fb7185' },
];

export function typeMeta(t: string) {
  return EVENT_TYPES.find((x) => x.value === t) || EVENT_TYPES[2];
}

function hashIndex(s: string, n: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

export function clientHex(clientId: string | null) {
  if (!clientId) return '#94a3b8';
  const usable = PALETTE.filter((p) => p.key !== 'slate' && p.key !== 'red');
  return usable[hashIndex(clientId, usable.length)].hex;
}

/** The legend key an event falls under for the current colour mode. */
export function legendKey(ev: ScheduleEvent, colorBy: ColorBy) {
  if (colorBy === 'client') return ev.client_id || '__none';
  if (colorBy === 'priority') return ev.priority || 'normal';
  return ev.event_type;
}

/** An event's own colour wins; otherwise colour by the selected mode. */
export function eventHex(ev: ScheduleEvent, colorBy: ColorBy) {
  if (ev.color) return PALETTE.find((p) => p.key === ev.color)?.hex || ev.color;
  if (colorBy === 'client') return clientHex(ev.client_id);
  if (colorBy === 'priority') return (PRIORITIES.find((p) => p.value === ev.priority) || PRIORITIES[1]).hex;
  return typeMeta(ev.event_type).hex;
}

export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ─── Dates (ISO yyyy-mm-dd, local time; noon avoids DST edge cases) ───

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromISO(iso: string) {
  return new Date(`${iso}T12:00:00`);
}
export function todayStr() {
  return toISO(new Date());
}
export function addDays(iso: string, n: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function addMonths(iso: string, n: number) {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}
export function startOfWeek(iso: string) {
  const d = fromISO(iso);
  return addDays(iso, -d.getDay());
}
export function monthGrid(iso: string) {
  const d = fromISO(iso);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** The date span a view needs loaded. */
export function viewRange(view: ViewMode, iso: string): [string, string] {
  if (view === 'day') return [iso, iso];
  if (view === 'week') {
    const s = startOfWeek(iso);
    return [s, addDays(s, 6)];
  }
  const g = monthGrid(iso);
  return [g[0], g[g.length - 1]];
}

export function fmtTime(t: string | null | undefined) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, '0')}${ampm}` : `${hr}${ampm}`;
}
export function fmtHour(h: number) {
  if (h === 0) return '12 AM';
  if (h === 12) return 'Noon';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
export function timeToMin(t: string | null | undefined) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function minToTime(min: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** No start time, or a whole-day block (00:00–23:59) — shown in the all-day row. */
export function isAllDay(ev: ScheduleEvent) {
  if (!ev.start_time) return true;
  return ev.start_time.startsWith('00:00') && (ev.end_time || '').startsWith('23:59');
}

export function rangeTitle(view: ViewMode, iso: string) {
  const d = fromISO(iso);
  if (view === 'day') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (view === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const [s, e] = viewRange('week', iso);
  const sd = fromISO(s), ed = fromISO(e);
  const sameMonth = sd.getMonth() === ed.getMonth();
  const left = sd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const right = ed.toLocaleDateString(undefined, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} – ${right}`;
}

export type Placed = { ev: ScheduleEvent; start: number; end: number; col: number; cols: number };

/** Lay timed events out side by side where they overlap. */
export function layoutDay(events: ScheduleEvent[]): Placed[] {
  const items = events
    .map((ev) => {
      const start = timeToMin(ev.start_time);
      const rawEnd = ev.end_time ? timeToMin(ev.end_time) : start + 30;
      return { ev, start, end: Math.max(rawEnd, start + 20), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => { c.cols = cols; });
    out.push(...cluster);
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

export function attendeesText(a: ScheduleEvent['attendees']) {
  if (!a) return '';
  return Array.isArray(a) ? a.join(', ') : a;
}
