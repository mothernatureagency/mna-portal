import { query } from './db';
import { DEFAULT_TIMEZONE } from './timezone';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  : 'https://portal.mothernatureagency.com/api/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Generate the OAuth URL for the user to authorize Google Calendar access.
 */
export function getAuthUrl(userEmail: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userEmail,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

/**
 * Refresh an expired access token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}

/**
 * Get a valid access token for the user, refreshing if needed.
 */
export async function getAccessToken(userEmail: string): Promise<string | null> {
  const { rows } = await query(
    'SELECT * FROM google_tokens WHERE user_email = $1',
    [userEmail]
  );
  if (rows.length === 0) return null;

  const token = rows[0];
  const expiry = new Date(token.token_expiry);

  // If token expires within 5 minutes, refresh
  if (expiry.getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(token.refresh_token);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

      await query(
        'UPDATE google_tokens SET access_token = $1, token_expiry = $2 WHERE user_email = $3',
        [refreshed.access_token, newExpiry.toISOString(), userEmail]
      );
      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return token.access_token;
}

/**
 * Check if a user has Google Calendar connected.
 */
export async function isConnected(userEmail: string): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM google_tokens WHERE user_email = $1',
    [userEmail]
  );
  return rows.length > 0;
}

/**
 * Get a user's preferred timezone from the database.
 */
async function getUserTimezone(userEmail: string): Promise<string> {
  try {
    const { rows } = await query(
      'SELECT timezone FROM user_preferences WHERE user_email = $1',
      [userEmail]
    );
    return rows[0]?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Create a Google Calendar event.
 */
export async function createCalendarEvent(
  userEmail: string,
  event: {
    title: string;
    description?: string;
    date: string;       // YYYY-MM-DD
    startTime?: string; // HH:MM
    endTime?: string;   // HH:MM
    eventType?: string;
  }
): Promise<{ success: boolean; googleEventId?: string; htmlLink?: string; error?: string }> {
  const accessToken = await getAccessToken(userEmail);
  if (!accessToken) return { success: false, error: 'Google Calendar not connected' };

  const { rows } = await query(
    'SELECT calendar_id FROM google_tokens WHERE user_email = $1',
    [userEmail]
  );
  const calendarId = rows[0]?.calendar_id || 'primary';

  // Use the user's preferred timezone for calendar events
  const tz = await getUserTimezone(userEmail);

  // Build the event body
  let body: any = {
    summary: event.title,
    description: event.description || '',
  };

  if (event.startTime && event.endTime) {
    // Timed event
    body.start = {
      dateTime: `${event.date}T${event.startTime}:00`,
      timeZone: tz,
    };
    body.end = {
      dateTime: `${event.date}T${event.endTime}:00`,
      timeZone: tz,
    };
  } else if (event.startTime) {
    // Start time only — assume 1 hour
    const [h, m] = event.startTime.split(':').map(Number);
    const endH = String(h + 1).padStart(2, '0');
    const endM = String(m).padStart(2, '0');
    body.start = {
      dateTime: `${event.date}T${event.startTime}:00`,
      timeZone: tz,
    };
    body.end = {
      dateTime: `${event.date}T${endH}:${endM}:00`,
      timeZone: tz,
    };
  } else {
    // All-day event
    body.start = { date: event.date };
    body.end = { date: event.date };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Google API error: ${err}` };
    }

    const data = await res.json();
    return { success: true, googleEventId: data.id, htmlLink: data.htmlLink };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch events from Google Calendar for a date range.
 */
export async function fetchCalendarEvents(
  userEmail: string,
  from: string,
  to: string
): Promise<any[]> {
  const accessToken = await getAccessToken(userEmail);
  if (!accessToken) return [];

  const { rows } = await query(
    'SELECT calendar_id FROM google_tokens WHERE user_email = $1',
    [userEmail]
  );
  const calendarId = rows[0]?.calendar_id || 'primary';

  try {
    const params = new URLSearchParams({
      timeMin: `${from}T00:00:00Z`,
      timeMax: `${to}T23:59:59Z`,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

/**
 * Disconnect Google Calendar.
 */
export async function disconnect(userEmail: string): Promise<void> {
  await query('DELETE FROM google_tokens WHERE user_email = $1', [userEmail]);
}
