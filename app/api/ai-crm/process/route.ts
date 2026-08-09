import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { pollLocationsForInbound, processDueMessages } from '@/lib/ai-crm/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Worker endpoint (Vercel cron + manual):
 *  1. Processes pending messages whose grouping delay has elapsed
 *     (catches anything the webhook couldn't finish inline).
 *  2. Polling fallback — scans locations with polling_enabled for new
 *     inbound messages when webhooks aren't available on the Revive plan.
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
  const skipPoll = req.nextUrl.searchParams.get('poll') === '0';
  const polled = skipPoll ? { ingested: 0 } : await pollLocationsForInbound();
  const processed = await processDueMessages(10);
  return NextResponse.json({ ok: true, polled: polled.ingested, processed });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
