import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createCalendarEvent, isConnected } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — Create a booking (authenticated or public).
 * Creates a schedule event + Google Calendar event with Meet link.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const {
    requesterEmail, requesterName, ownerEmail,
    clientId, title, description,
    date, startTime, endTime,
    meetingMode,
  } = body;

  const owner = ownerEmail || 'mn@mothernatureagency.com';

  if (!requesterEmail || !requesterName || !date || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'requesterEmail, requesterName, date, startTime, and endTime required' },
      { status: 400 }
    );
  }

  const meetingTitle = title || `Meeting with ${requesterName}`;
  const mode = meetingMode || 'google_meet';

  // 1. Create schedule event for the owner
  const { rows: eventRows } = await query(
    `INSERT INTO schedule_events (user_email, client_id, title, description, event_date, start_time, end_time, event_type, priority, attendees, meeting_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'meeting', 'normal', $8, $9) RETURNING *`,
    [owner, clientId || null, meetingTitle, description || null, date, startTime, endTime, requesterName, mode]
  );
  const scheduleEvent = eventRows[0];

  // 2. Push to Google Calendar with attendee
  let meetLink = null;
  let googleEventId = null;
  try {
    const connected = await isConnected(owner);
    if (connected) {
      const gcal = await createCalendarEvent(owner, {
        title: meetingTitle,
        description: description || `Booked by ${requesterName} (${requesterEmail})`,
        date,
        startTime,
        endTime,
        eventType: 'meeting',
        attendees: [{ name: requesterName, email: requesterEmail }],
        meetingMode: mode as any,
      });
      meetLink = gcal.meetLink || null;
      googleEventId = gcal.googleEventId || null;

      // Update schedule event with meet link
      if (meetLink) {
        await query('UPDATE schedule_events SET meet_link = $1 WHERE id = $2', [meetLink, scheduleEvent.id]);
      }
    }
  } catch (err) {
    console.error('Google Calendar booking error:', err);
  }

  // 3. Insert booking request record
  const { rows: bookingRows } = await query(
    `INSERT INTO booking_requests (requester_email, requester_name, owner_email, client_id, title, description, requested_date, requested_start_time, requested_end_time, meeting_mode, status, schedule_event_id, google_event_id, meet_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11, $12, $13) RETURNING *`,
    [requesterEmail, requesterName, owner, clientId || null, meetingTitle, description || null, date, startTime, endTime, mode, scheduleEvent.id, googleEventId, meetLink]
  );

  return NextResponse.json({
    booking: bookingRows[0],
    meetLink,
    confirmed: true,
  }, { status: 201 });
}

// GET — list bookings
export async function GET(req: NextRequest) {
  await ensureSchema();
  const ownerEmail = req.nextUrl.searchParams.get('ownerEmail') || 'mn@mothernatureagency.com';
  const status = req.nextUrl.searchParams.get('status');

  let where = 'owner_email = $1';
  const params: any[] = [ownerEmail];

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT * FROM booking_requests WHERE ${where} ORDER BY requested_date DESC, requested_start_time ASC`,
    params
  );
  return NextResponse.json({ bookings: rows });
}
