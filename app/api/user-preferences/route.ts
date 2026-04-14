import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — fetch user preferences (timezone, etc.)
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
    // Return defaults
    return NextResponse.json({
      preferences: {
        user_email: email,
        timezone: 'America/Chicago',
      },
    });
  }

  return NextResponse.json({ preferences: rows[0] });
}

// PATCH — update user preferences
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { email, timezone } = body;

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  if (!timezone) return NextResponse.json({ error: 'timezone required' }, { status: 400 });

  // Upsert
  const { rows } = await query(
    `INSERT INTO user_preferences (user_email, timezone, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_email) DO UPDATE SET timezone = $2, updated_at = now()
     RETURNING *`,
    [email, timezone]
  );

  return NextResponse.json({ preferences: rows[0] });
}
