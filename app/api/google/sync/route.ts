import { NextRequest, NextResponse } from 'next/server';
import { fetchCalendarEvents } from '@/lib/google-calendar';
import { ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET — Fetch Google Calendar events for a date range.
 * ?email=user@email.com&from=2026-04-13&to=2026-04-19
 *
 * Returns raw Google Calendar events. The frontend merges them
 * with MNA schedule events for display.
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  if (!email || !from || !to) {
    return NextResponse.json({ error: 'email, from, and to required' }, { status: 400 });
  }

  const events = await fetchCalendarEvents(email, from, to);

  // Normalize to a simpler format
  const normalized = events.map((e: any) => ({
    id: e.id,
    title: e.summary || '(No title)',
    description: e.description || null,
    date: e.start?.date || e.start?.dateTime?.slice(0, 10) || from,
    start_time: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null,
    end_time: e.end?.dateTime ? e.end.dateTime.slice(11, 16) : null,
    event_type: 'google',
    source: 'google_calendar',
    htmlLink: e.htmlLink,
    location: e.location || null,
    attendees: (e.attendees || []).map((a: any) => a.email),
  }));

  return NextResponse.json({ events: normalized });
}
