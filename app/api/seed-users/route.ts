import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { secret, username, password, role } = await req.json();

    if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await query<{ id: string; username: string; role: string }>(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3
       RETURNING id, username, role`,
      [username.toLowerCase().trim(), hashedPassword, role || 'admin']
    );

    return NextResponse.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('seed-users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
