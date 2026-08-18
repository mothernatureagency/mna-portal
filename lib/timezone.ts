/**
 * Timezone utilities for MNA Portal.
 * Default is America/Chicago (CST/CDT).
 * Users can override to any IANA timezone.
 */

export const DEFAULT_TIMEZONE = 'America/Chicago';

// Common timezones for the team dropdown
export const TIMEZONE_OPTIONS = [
  { value: 'America/Chicago', label: 'Central Time (CST/CDT)', short: 'CT' },
  { value: 'America/New_York', label: 'Eastern Time (EST/EDT)', short: 'ET' },
  { value: 'America/Denver', label: 'Mountain Time (MST/MDT)', short: 'MT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST/PDT)', short: 'PT' },
  { value: 'America/Phoenix', label: 'Arizona (MST)', short: 'AZ' },
  { value: 'Europe/Berlin', label: 'Central European (CET/CEST)', short: 'CET' },
  { value: 'Europe/London', label: 'UK (GMT/BST)', short: 'GMT' },
  { value: 'UTC', label: 'UTC', short: 'UTC' },
];

/**
 * Get the current hour in a specific timezone.
 */
export function getHourInTimezone(tz: string): number {
  try {
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatted, 10);
  } catch {
    // Fallback to server time
    return new Date().getHours();
  }
}

/**
 * Get a time-of-day greeting based on timezone.
 */
export function getTimeGreeting(tz: string = DEFAULT_TIMEZONE): string {
  const hour = getHourInTimezone(tz);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get today's date string (YYYY-MM-DD) in a specific timezone.
 *
 * Intl throws `RangeError: Invalid time zone specified` for any string it does
 * not recognise, and `tz` here comes from a saved user preference — a stale or
 * hand-edited value would throw mid-render and take the page down. Every
 * formatter below falls back to local time instead, the same way
 * getHourInTimezone already did.
 */
export function getTodayInTimezone(tz: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // en-CA gives YYYY-MM-DD
  } catch {
    return new Date().toLocaleDateString('en-CA');
  }
}

/**
 * Get a formatted date display in a specific timezone.
 */
export function getDateDisplay(tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  };
  try {
    return new Date().toLocaleDateString('en-US', { ...opts, timeZone: tz });
  } catch {
    return new Date().toLocaleDateString('en-US', opts);
  }
}

/**
 * Get the current time display in a specific timezone.
 */
export function getTimeDisplay(tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  try {
    return new Date().toLocaleTimeString('en-US', { ...opts, timeZone: tz });
  } catch {
    return new Date().toLocaleTimeString('en-US', opts);
  }
}
