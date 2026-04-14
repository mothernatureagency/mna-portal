import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { fetchCalendarEvents, isConnected } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

/**
 * GET — Returns available time slots for a given date.
 * Reads availability settings from user_preferences.
 * Checks Google Calendar + MNA schedule for conflicts.
 *
 * ?date=2026-04-15
 * ?ownerEmail=mn@mothernatureagency.com (defaults to mn@)
 * ?duration=30 (minutes, defaults to owner's slotDuration)
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const date = req.nextUrl.searchParams.get('date');
  const ownerEmail = req.nextUrl.searchParams.get('ownerEmail') || 'mn@mothernatureagency.com';

  if (!date) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Load owner preferences (timezone + availability)
  const { rows: prefRows } = await query(
    'SELECT timezone, availability FROM user_preferences WHERE user_email = $1',
    [ownerEmail]
  );
  const timezone = prefRows[0]?.timezone || 'America/Chicago';
  const rawAvail = prefRows[0]?.availability;
  const avail = typeof rawAvail === 'string' ? JSON.parse(rawAvail) : (rawAvail || {});

  const days = avail.days || { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
  const startTime = avail.startTime || '09:00';
  const endTime = avail.endTime || '17:00';
  const slotDuration = parseInt(req.nextUrl.searchParams.get('duration') || String(avail.slotDuration || 30), 10);
  const slotInterval = avail.slotInterval || 'hour'; // 'hour' or 'half'
  const bufferMinutes = avail.bufferMinutes || 0;
  const maxPerDay = avail.maxPerDay || 0;

  // Check if the requested day is available
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const dayKey = DAY_MAP[dayOfWeek];
  if (!days[dayKey]) {
    return NextResponse.json({ slots: [], date, timezone, duration: slotDuration, dayOff: true });
  }

  // Parse start/end hours
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startTotalMin = startH * 60 + startM;
  const endTotalMin = endH * 60 + endM;

  // Generate slots based on interval setting
  const allSlots: { start: string; end: string }[] = [];
  const step = slotInterval === 'half' ? 30 : 60; // :00 and :30 vs :00 only

  for (let min = startTotalMin; min < endTotalMin; min += step) {
    // Snap to :00 or :30
    const slotStartH = Math.floor(min / 60);
    const slotStartM = min % 60;
    if (slotStartM !== 0 && slotStartM !== 30) continue;

    const slotEndMin = min + slotDuration;
    if (slotEndMin > endTotalMin) continue;

    const slotEndH = Math.floor(slotEndMin / 60);
    const slotEndM = slotEndMin % 60;

    allSlots.push({
      start: `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`,
      end: `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`,
    });
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
        .filter((e: any) => e.start?.dateTime)
        .map((e: any) => ({
          start: e.start.dateTime.slice(11, 16),
          end: e.end.dateTime.slice(11, 16),
        }));
    }
  } catch {}

  // Combine all busy times (with buffer)
  const busyTimes = [
    ...mnaEvents.map((e: any) => ({
      start: addMinutes(e.start_time, -bufferMinutes),
      end: addMinutes(e.end_time || addMinutes(e.start_time, 60), bufferMinutes),
    })),
    ...gcalEvents.map(e => ({
      start: addMinutes(e.start, -bufferMinutes),
      end: addMinutes(e.end, bufferMinutes),
    })),
  ];

  // Check each slot against busy times
  let slots = allSlots.map(slot => {
    const conflict = busyTimes.some(busy => {
      return slot.start < busy.end && slot.end > busy.start;
    });
    return { ...slot, available: !conflict };
  });

  // Enforce max bookings per day
  if (maxPerDay > 0) {
    // Count existing bookings for this date
    const { rows: bookingRows } = await query(
      `SELECT count(*) as cnt FROM booking_requests WHERE owner_email = $1 AND requested_date = $2 AND status != 'cancelled'`,
      [ownerEmail, date]
    );
    const existingBookings = parseInt(bookingRows[0]?.cnt || '0', 10);
    if (existingBookings >= maxPerDay) {
      slots = slots.map(s => ({ ...s, available: false }));
    }
  }

  return NextResponse.json({ slots, date, timezone, duration: slotDuration });
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + minutes));
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}
