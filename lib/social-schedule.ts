/**
 * Smart posting-time logic for the social autoposter.
 *
 * Auto-posts go out at proven best-time windows in each location's LOCAL
 * timezone. When a location has several posts on the same day, they stagger
 * across the day's windows instead of stacking at one minute.
 */

// Best local-time posting windows (24h), in preference order. The Nth same-day
// post for a location takes the Nth window; we then post them chronologically.
export const SMART_SLOTS: [number, number][] = [
  [11, 30], // late morning
  [13, 0],  // lunch
  [17, 30], // commute / early evening
  [19, 30], // prime evening
  [9, 0],   // early morning
  [15, 0],  // mid-afternoon
];

// Known per-client timezones (Prime IV locations + friends). Anything not
// listed falls back to Central, and an explicit override (client_kv 'timezone')
// always wins.
const CLIENT_TZ: Record<string, string> = {
  'prime-iv': 'America/Chicago',           // Niceville, FL (Central panhandle)
  'prime-iv-pinecrest': 'America/New_York', // Pinecrest, FL (Eastern)
  'prime-iv-high-street': 'America/Phoenix', // Phoenix, AZ (no DST)
  'prime-iv-holland-mi': 'America/Detroit',  // Holland, MI (Eastern)
  'prime-iv-papillion-ne': 'America/Chicago', // Papillion, NE (Central)
  'vortex': 'America/Chicago',              // Vortex Spring, FL (Central panhandle)
};

export function clientTimezone(clientId: string, override?: string | null): string {
  return (override && override.trim()) || CLIENT_TZ[clientId] || 'America/Chicago';
}

// Offset (ms) of a timezone at a given instant: (local wall clock) − (UTC).
function tzOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +(p.minute), +p.second);
  return asUTC - at.getTime();
}

// Convert "HH:MM local time on <dateISO> in <tz>" to the exact UTC instant.
export function localSlotToUtc(dateISO: string, hh: number, mm: number, tz: string): Date {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, hh, mm);
  const off = tzOffsetMs(tz, new Date(guess));
  return new Date(guess - off);
}

// Given a post's date + its index among the location's same-day posts, return
// the UTC instant it should publish at.
export function slotTimeUtc(dateISO: string, indexOnDay: number, tz: string): Date {
  const [hh, mm] = SMART_SLOTS[Math.min(indexOnDay, SMART_SLOTS.length - 1)];
  return localSlotToUtc(dateISO, hh, mm, tz);
}
