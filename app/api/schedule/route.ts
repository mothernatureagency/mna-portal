import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createCalendarEvent, isConnected } from '@/lib/google-calendar';
import { resolveAttendees } from '@/lib/contacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list schedule events
// ?email=user@email.com  — filter by user
// ?date=2026-04-13       — filter by specific date
// ?from=2026-04-13&to=2026-04-19 — date range
// ?clientId=prime-iv      — filter by client
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email');
  const date = req.nextUrl.searchParams.get('date');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const clientId = req.nextUrl.searchParams.get('clientId');

  let where = '';
  const params: any[] = [];

  if (email) {
    params.push(email);
    where += ` where user_email = $${params.length}`;
  }
  if (date) {
    params.push(date);
    where += where ? ' and' : ' where';
    where += ` event_date = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += where ? ' and' : ' where';
    where += ` event_date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += where ? ' and' : ' where';
    where += ` event_date <= $${params.length}`;
  }
  if (clientId) {
    params.push(clientId);
    where += where ? ' and' : ' where';
    where += ` (client_id = $${params.length} or client_id is null)`;
  }

  const { rows } = await query(
    `select * from schedule_events${where} order by event_date asc, start_time asc nulls last`,
    params
  );
  return NextResponse.json({ events: rows });
}

// Helper: generate recurring dates from a start date
function generateRecurrenceDates(startDate: string, recurrence: string, endDate?: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  const maxEnd = endDate ? new Date(`${endDate}T12:00:00`) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); // default 3 months

  const intervalMap: Record<string, { unit: 'day' | 'week' | 'month'; step: number }> = {
    daily: { unit: 'day', step: 1 },
    weekly: { unit: 'week', step: 1 },
    biweekly: { unit: 'week', step: 2 },
    monthly: { unit: 'month', step: 1 },
  };

  const interval = intervalMap[recurrence];
  if (!interval) return dates;

  let current = new Date(start);
  // Skip the first date (parent already covers it)
  while (true) {
    if (interval.unit === 'day') current.setDate(current.getDate() + interval.step);
    else if (interval.unit === 'week') current.setDate(current.getDate() + interval.step * 7);
    else if (interval.unit === 'month') current.setMonth(current.getMonth() + interval.step);

    if (current > maxEnd) break;
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

// POST — create event
export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { email, clientId, title, description, eventDate, startTime, endTime, eventType, priority, attendees, meetingMode, location, recurrence, recurrenceEnd } = body;

  if (!email || !title || !eventDate) {
    return NextResponse.json({ error: 'email, title, and eventDate required' }, { status: 400 });
  }

  // Resolve attendees from names/emails
  const resolvedAttendees = attendees ? await resolveAttendees(attendees) : [];
  const attendeesStr = resolvedAttendees.length > 0
    ? resolvedAttendees.map(a => a.name || a.email).join(', ')
    : (attendees || null);

  const rec = recurrence || 'none';
  const recEnd = recurrenceEnd || null;

  // Create the parent event
  const { rows } = await query(
    `insert into schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees, meeting_mode, location, recurrence, recurrence_end)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning *`,
    [email, clientId || null, title, description || null, eventDate, startTime || null, endTime || null, eventType || 'task', priority || 'normal', attendeesStr, meetingMode || 'none', location || null, rec, recEnd]
  );

  const parentId = rows[0].id;

  // Generate recurring child events in the DB
  if (rec !== 'none') {
    const futureDates = generateRecurrenceDates(eventDate, rec, recEnd);
    for (const d of futureDates) {
      await query(
        `insert into schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees, meeting_mode, location, recurrence, recurring_parent_id, meet_link)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [email, clientId || null, title, description || null, d, startTime || null, endTime || null, eventType || 'task', priority || 'normal', attendeesStr, meetingMode || 'none', location || null, rec, parentId, null]
      );
    }
  }

  // Push to Google Calendar if connected (with attendees + meeting mode + recurrence)
  let googleEvent = null;
  try {
    const connected = await isConnected(email);
    if (connected) {
      googleEvent = await createCalendarEvent(email, {
        title,
        description: description || undefined,
        date: eventDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        eventType: eventType || 'task',
        attendees: resolvedAttendees.filter(a => a.email),
        meetingMode: meetingMode || 'none',
        location: location || undefined,
        recurrence: rec,
        recurrenceEnd: recEnd || undefined,
      });

      // Store the Meet link if one was generated
      if (googleEvent?.meetLink) {
        await query(
          'UPDATE schedule_events SET meet_link = $1 WHERE id = $2',
          [googleEvent.meetLink, parentId]
        );
        rows[0].meet_link = googleEvent.meetLink;
        // Also update child events with the same meet link
        if (rec !== 'none') {
          await query(
            'UPDATE schedule_events SET meet_link = $1 WHERE recurring_parent_id = $2',
            [googleEvent.meetLink, parentId]
          );
        }
      }
    }
  } catch (err) {
    console.error('Google Calendar sync error:', err);
  }

  return NextResponse.json({ event: rows[0], googleEvent }, { status: 201 });
}

// PATCH — update event
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];
  const patchable = ['title', 'description', 'event_date', 'start_time', 'end_time', 'event_type', 'priority', 'completed', 'client_id', 'reminder_sent', 'attendees', 'meeting_mode', 'location', 'meet_link', 'recurrence', 'recurrence_end'];

  for (const key of patchable) {
    if (body[key] !== undefined) {
      values.push(body[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update schedule_events set ${fields.join(', ')} where id = $${values.length} returning *`,
    values
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ event: rows[0] });
}

// DELETE — remove event (or entire recurring series)
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  const series = req.nextUrl.searchParams.get('series'); // 'true' to delete all in series
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (series === 'true') {
    // Delete all children + the parent
    await query('delete from schedule_events where recurring_parent_id = $1 or id = $1', [id]);
  } else {
    await query('delete from schedule_events where id = $1', [id]);
  }
  return NextResponse.json({ ok: true });
}
