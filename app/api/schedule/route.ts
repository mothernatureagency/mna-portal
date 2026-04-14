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

// POST — create event
export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { email, clientId, title, description, eventDate, startTime, endTime, eventType, priority, attendees } = body;

  if (!email || !title || !eventDate) {
    return NextResponse.json({ error: 'email, title, and eventDate required' }, { status: 400 });
  }

  // Resolve attendees from names/emails
  const resolvedAttendees = attendees ? resolveAttendees(attendees) : [];
  const attendeesStr = resolvedAttendees.length > 0
    ? resolvedAttendees.map(a => a.name || a.email).join(', ')
    : (attendees || null);

  const { rows } = await query(
    `insert into schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
    [email, clientId || null, title, description || null, eventDate, startTime || null, endTime || null, eventType || 'task', priority || 'normal', attendeesStr]
  );

  // Push to Google Calendar if connected (with attendees for invites)
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
      });
    }
  } catch (err) {
    // Don't fail the request if Google sync fails
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
  const patchable = ['title', 'description', 'event_date', 'start_time', 'end_time', 'event_type', 'priority', 'completed', 'client_id', 'reminder_sent', 'attendees'];

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

// DELETE — remove event
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from schedule_events where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
