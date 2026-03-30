import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

const COOKIE_NAME = 'mna_portal_auth';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const { rows } = await query<{ id: string; username: string; password_hash: string; role: string }>(
    'select id, username, password_hash, role from users where username = $1 limit 1',
    [username.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Store username + role in cookie value as JSON
  const cookieValue = JSON.stringify({ username: user.username, role: user.role, id: user.id });

  const res = NextResponse.json({ ok: true, username: user.username, role: user.role });
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
