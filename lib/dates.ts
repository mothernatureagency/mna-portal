/**
 * Date utilities — safe local-timezone helpers.
 *
 * `new Date('2026-04-15')` is parsed as UTC midnight, which in US time zones
 * shifts back to April 14 when formatted with toLocaleDateString(). These
 * helpers avoid that by always working in local time.
 */

/** Format a Date as YYYY-MM-DD using local time (no UTC shift). */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as YYYY-MM-DD in local time. */
export function todayLocal(): string {
  return localDateStr(new Date());
}

/**
 * Parse a YYYY-MM-DD string into a Date in local time.
 * Appends T12:00:00 to avoid the UTC-midnight shift.
 */
export function parseLocalDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/**
 * Format a YYYY-MM-DD string for display (e.g. "Wed, Apr 15").
 * Safe from timezone shift.
 */
export function fmtDateShort(iso: string): string {
  try {
    return parseLocalDate(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Format a YYYY-MM-DD string for display (e.g. "Wednesday, April 15").
 * Safe from timezone shift.
 */
export function fmtDateLong(iso: string): string {
  try {
    return parseLocalDate(iso).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
