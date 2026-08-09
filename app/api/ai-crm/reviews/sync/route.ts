import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { GhlLocation } from '@/lib/ai-crm/locations';
import { processPendingReviews, syncLocationReviews } from '@/lib/ai-crm/reviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Google Reviews sync + processing (Vercel cron, daily, or manual trigger
 * from the dashboard). For every location with a GBP mapping: pull new
 * reviews, then generate/auto-post/queue replies per the rating rules.
 *
 * Auth: Vercel cron header, or x-sync-key / ?key= matching SYNC_SECRET.
 */

function authed(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true; // dev
  const key = req.headers.get('x-sync-key') || req.nextUrl.searchParams.get('key');
  return key === secret;
}

async function run(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const only = req.nextUrl.searchParams.get('location');
  const { rows: locs } = await query<GhlLocation>(
    `select * from ghl_locations
      where gbp_account_id is not null and gbp_location_id is not null
        ${only ? 'and ghl_location_id = $1' : ''}`,
    only ? [only] : [],
  );
  const report: Record<string, unknown> = {};
  for (const loc of locs) {
    const synced = await syncLocationReviews(loc);
    const processed = await processPendingReviews(loc);
    report[loc.ghl_location_id] = { synced: synced.inserted, ...processed };
  }
  return NextResponse.json({ ok: true, locations: report });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
