import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { fetchCalendarEvents, isConnected } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — Returns available time slots for a given date.
 * Checks Google Calendar + MNA schedule for conflicts.
 *
 * ?date=2026-04-15
 * ?ownerEmail=mn@mothernatureagency.com (defaults to mn@)
 * ?duration=30 (minutes, defaults to 30)
 *
 * Returns: { slots: [{ start: "09:00", end: "09:30", available: true }, ...] }
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const date = req.nextUrl.searchParams.get('date');
  const ownerEmail = req.nextUrl.searchParams.get('ownerEmail') || 'mn@mothernatureagency.com';
  const duration = parseInt(req.nextUrl.searchParams.get('duration') || '30', 10);

  if (!date) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Get owner's timezone preference
  const { rows: prefRows } = await query(
    'SELECT timezone FROM user_preferences WHERE user_email = $1',
    [ownerEmail]
  );
  const timezone = prefRows[0]?.timezone || 'America/Chicago';

  // Business hours: 9am - 5pm
  const startHour = 9;
  const endHour = 17;

  // Generate all possible slots
  const allSlots: { start: string; end: string }[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += duration) {
      const endMin = min + duration;
      const endH = hour + Math.floor(endMin / 60);
      const endM = endMin % 60;
      if (endH > endHour || (endH === endHour && endM > 0)) break;

      allSlots.push({
        start: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      });
    }
  }

  // Fetch existing events from MNA schedule
  const { rows: mnaEvents } = await query(
    `SELECT start_time, end_time FROM schedule_events
     WHERE user_email = $1 AND event_date = $2 AND completed = false AND start_time IS NOT NULL`,
    [ownerEmail, date]
  );

  // Fetch Google Calendar events if connected
  let gcalEvents: { start: string; end: string }[] = [];
  try {
    const connected = await isConnected(ownerEmail);
    if (connected) {
      const raw = await fetchCalendarEvents(ownerEmail, date, date);
      gcalEvents = raw
        .filter((e: any) => e.start?.dateTime) // skip all-day events
        .map((e: any) => ({
          start: e.start.dateTime.slice(11, 16),
          end: e.end.dateTime.slice(11, 16),
        }));
    }
  } catch {}

  // Combine all busy times
  const busyTimes = [
    ...mnaEvents.map((e: any) => ({ start: e.start_time, end: e.end_time || addMinutes(e.start_time, 60) })),
    ...gcalEvents,
  ];

  // Check each slot against busy times
  const slots = allSlots.map(slot => {
    const conflict = busyTimes.some(busy => {
      return slot.start < busy.end && slot.end > busy.start;
    });
    return { ...slot, available: !conflict };
  });

  return NextResponse.json({ slots, date, timezone, duration });
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}
