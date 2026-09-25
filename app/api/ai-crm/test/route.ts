import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { testMessage } from '@/lib/ai-crm/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Phase-0 dry run. Session-authenticated via middleware.
 * POST { ghlLocationId, message, contactName?, tags? }
 * Runs the message through safety rules + Claude against the location's
 * knowledge base — nothing touches Revive, nothing is sent or queued.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { ghlLocationId, message, contactName, tags } = body || {};
  if (!ghlLocationId || !message) {
    return NextResponse.json({ error: 'ghlLocationId and message required' }, { status: 400 });
  }
  try {
    const result = await testMessage(String(ghlLocationId), String(message).slice(0, 1000), {
      contactName: contactName ? String(contactName) : undefined,
      tags: Array.isArray(tags) ? tags.map(String) : undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
