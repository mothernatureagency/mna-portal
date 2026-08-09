import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { ingestInboundMessage, processMessage } from '@/lib/ai-crm/engine';
import { getLocationByGhlId } from '@/lib/ai-crm/locations';
import { safeEqual } from '@/lib/ai-crm/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow the in-request grouping delay + processing to finish.
export const maxDuration = 60;

/**
 * Inbound message webhook for Revive / GoHighLevel.
 *
 * In each subaccount (or via a Revive/GHL workflow "Webhook" action on
 * Customer Replied / Inbound Message), point the webhook at:
 *
 *   POST https://<portal>/api/ai-crm/webhook?key=<secret>
 *
 * The key must match the location's webhook_secret (set in the portal's
 * location settings) or the global AI_CRM_WEBHOOK_SECRET env var.
 *
 * Expected payload (native GHL "InboundMessage" event or a workflow webhook
 * with equivalent fields):
 *   { type: "InboundMessage", locationId, contactId, conversationId,
 *     messageId | id, body, messageType, direction }
 *
 * Behavior: the message is recorded (idempotent on message id), then — if the
 * location's grouping delay fits in this request — we wait out the delay and
 * process inline. Longer delays are picked up by the /api/ai-crm/process cron.
 */

export async function POST(req: NextRequest) {
  await ensureSchema();
  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const locationId: string | undefined = data?.locationId || data?.location_id || data?.location?.id;
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  // Auth: per-location secret first, then global fallback.
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-webhook-key') || '';
  const loc = await getLocationByGhlId(locationId);
  const expected = loc?.webhook_secret || process.env.AI_CRM_WEBHOOK_SECRET || '';
  if (expected && !(key && safeEqual(key, expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!loc) return NextResponse.json({ error: 'Unknown location — add it in the portal first' }, { status: 404 });

  // Only inbound customer messages trigger the AI.
  const direction = (data?.direction || 'inbound').toLowerCase();
  const type = String(data?.type || '');
  if (direction !== 'inbound' || (type && !/inbound/i.test(type) && type !== 'SMS')) {
    return NextResponse.json({ ok: true, skipped: 'not an inbound message' });
  }

  const externalMessageId: string | undefined = data?.messageId || data?.message?.id || data?.id;
  if (!externalMessageId) return NextResponse.json({ error: 'message id required' }, { status: 400 });

  const { id, duplicate } = await ingestInboundMessage({
    ghlLocationId: locationId,
    externalMessageId: String(externalMessageId),
    conversationId: data?.conversationId || null,
    contactId: data?.contactId || null,
    body: typeof data?.body === 'string' ? data.body : null,
    channel: data?.messageType || 'SMS',
    source: 'webhook',
  });
  if (duplicate) return NextResponse.json({ ok: true, duplicate: true });

  // If the grouping delay fits within this function's budget, handle it now.
  const delay = Math.max(0, Number(loc.response_delay_seconds || 0));
  if (delay <= 45 && id) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay * 1000));
    const outcome = await processMessage(id);
    return NextResponse.json({ ok: true, id, outcome });
  }
  return NextResponse.json({ ok: true, id, queued: true });
}
