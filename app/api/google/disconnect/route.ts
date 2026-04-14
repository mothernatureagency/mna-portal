import { NextRequest, NextResponse } from 'next/server';
import { disconnect } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  await disconnect(email);
  return NextResponse.json({ ok: true });
}
