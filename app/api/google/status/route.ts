import { NextRequest, NextResponse } from 'next/server';
import { isConnected, disconnect } from '@/lib/google-calendar';
import { ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET — Check if Google Calendar is connected for a user.
 * ?email=user@email.com
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ connected: false });

  const connected = await isConnected(email);
  return NextResponse.json({ connected });
}

/**
 * DELETE — Disconnect Google Calendar.
 * ?email=user@email.com
 */
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  await disconnect(email);
  return NextResponse.json({ ok: true });
}
