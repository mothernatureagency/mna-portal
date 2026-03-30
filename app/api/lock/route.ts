import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'mna_portal_auth';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: NextRequest) {
    const { password } = await req.json();

    if (!process.env.AUTH_PASS || password !== process.env.AUTH_PASS) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, 'authenticated', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: COOKIE_MAX_AGE,
          path: '/',
        });
    return res;
  }
