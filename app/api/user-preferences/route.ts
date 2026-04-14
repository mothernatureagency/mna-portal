import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_AVAILABILITY = {
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  startTime: '09:00',
  endTime: '17:00',
  slotDuration: 30,
  slotInterval: 'hour', // 'hour' = :00 only, 'half' = :00 and :30
  bufferMinutes: 0,
  maxPerDay: 0, // 0 = unlimited
};

// GET — fetch user preferences (timezone, availability, etc.)
// ?email=mn@mothernatureagency.com
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const { rows } = await query(
    'SELECT * FROM user_preferences WHERE user_email = $1',
    [email]
  );

  if (rows.length === 0) {
    return NextResponse.json({
      preferences: {
        user_email: email,
        timezone: 'America/Chicago',
        availability: DEFAULT_AVAILABILITY,
      },
    });
  }

  // Merge saved availability with defaults (in case new fields were added)
  const saved = rows[0];
  const avail = typeof saved.availability === 'string' ? JSON.parse(saved.availability) : (saved.availability || {});
  saved.availability = { ...DEFAULT_AVAILABILITY, ...avail };

  return NextResponse.json({ preferences: saved });
}

// PATCH — update user preferences
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { email, timezone, availability } = body;

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Build dynamic upsert
  const setClauses: string[] = ['updated_at = now()'];
  const values: any[] = [email];

  if (timezone) {
    values.push(timezone);
    setClauses.push(`timezone = $${values.length}`);
  }
  if (availability) {
    values.push(JSON.stringify(availability));
    setClauses.push(`availability = $${values.length}`);
  }

  // Build insert columns/values
  const insertCols = ['user_email'];
  const insertVals = ['$1'];
  if (timezone) { insertCols.push('timezone'); insertVals.push(`$${values.indexOf(timezone) + 1}`); }
  if (availability) { insertCols.push('availability'); insertVals.push(`$${values.indexOf(JSON.stringify(availability)) + 1}`); }

  const { rows } = await query(
    `INSERT INTO user_preferences (${insertCols.join(', ')})
     VALUES (${insertVals.join(', ')})
     ON CONFLICT (user_email) DO UPDATE SET ${setClauses.join(', ')}
     RETURNING *`,
    values
  );

  return NextResponse.json({ preferences: rows[0] });
}
