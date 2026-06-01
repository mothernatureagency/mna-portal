import { NextResponse } from 'next/server';
import { fetchPageSnapshot } from '@/lib/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — the connected Page's own follower / published-post counts.
// Returns { available: false } when META_PAGE_ID isn't configured or the
// token lacks Page scopes, so the Competitor Benchmark stays fully manual.
export async function GET() {
  try {
    const snap = await fetchPageSnapshot();
    if (!snap) return NextResponse.json({ available: false });
    return NextResponse.json({ available: true, ...snap });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message || 'Meta page fetch failed' });
  }
}
