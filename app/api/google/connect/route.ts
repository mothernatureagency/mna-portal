import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

/**
 * GET — Returns the Google OAuth authorization URL.
 * ?email=user@email.com
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const url = getAuthUrl(email);
  return NextResponse.json({ url });
}
