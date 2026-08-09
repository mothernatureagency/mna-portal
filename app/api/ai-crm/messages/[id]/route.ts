import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getLocationByGhlId, locationToken } from '@/lib/ai-crm/locations';
import { sendMessage } from '@/lib/ai-crm/ghl';
import { audit } from '@/lib/ai-crm/engine';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Human actions on an AI message. Session-authenticated via middleware.
 *
 * POST /api/ai-crm/messages/:id
 *   { action: "approve" }                          → send suggested/edited reply
 *   { action: "edit", text: "..." }                → save edited reply (doesn't send)
 *   { action: "send_custom", text: "..." }         → send custom text instead
 *   { action: "reject" }                           → discard, no send
 *   { action: "retry" }                            → requeue a failed message
 */

async function actorEmail(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email || 'staff';
  } catch {
    return 'staff';
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const { id } = params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action: string = body?.action;
  const actor = await actorEmail();

  const { rows } = await query<any>(`select * from ai_messages where id = $1`, [id]);
  const msg = rows[0];
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'edit') {
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    await query(`update ai_messages set final_response = $2, edited_by = $3, updated_at = now() where id = $1`, [id, text, actor]);
    await audit({ ghlLocationId: msg.ghl_location_id, messageId: id, event: 'response_edited', detail: { text }, actor });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    await query(`update ai_messages set status = 'rejected', edited_by = $2, updated_at = now() where id = $1`, [id, actor]);
    await audit({ ghlLocationId: msg.ghl_location_id, messageId: id, event: 'response_rejected', actor });
    return NextResponse.json({ ok: true });
  }

  if (action === 'retry') {
    if (msg.status !== 'failed') return NextResponse.json({ error: 'Only failed messages can be retried' }, { status: 400 });
    await query(`update ai_messages set status = 'pending', error = null, process_after = now(), updated_at = now() where id = $1`, [id]);
    await audit({ ghlLocationId: msg.ghl_location_id, messageId: id, event: 'retry_queued', actor });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' || action === 'send_custom') {
    if (['auto_sent', 'sent_manual'].includes(msg.status)) {
      return NextResponse.json({ error: 'Already sent' }, { status: 409 });
    }
    const text = action === 'send_custom'
      ? String(body?.text || '').trim()
      : String(body?.text || msg.final_response || msg.suggested_response || '').trim();
    if (!text) return NextResponse.json({ error: 'Nothing to send' }, { status: 400 });
    if (!msg.contact_id) return NextResponse.json({ error: 'Message has no contact' }, { status: 400 });

    const loc = await getLocationByGhlId(msg.ghl_location_id);
    const token = loc ? locationToken(loc) : null;
    if (!token) return NextResponse.json({ error: 'Location token not configured' }, { status: 400 });

    try {
      const sent = await sendMessage(token, { contactId: msg.contact_id, message: text, type: 'SMS' });
      await query(
        `update ai_messages set status = 'sent_manual', final_response = $2, sent_at = now(),
                ghl_message_id = $3, edited_by = $4, updated_at = now() where id = $1`,
        [id, text, sent.messageId || null, actor],
      );
      await audit({
        ghlLocationId: msg.ghl_location_id, messageId: id,
        event: action === 'approve' ? 'approved_and_sent' : 'custom_sent',
        detail: { text, ghl_message_id: sent.messageId }, actor,
      });
      return NextResponse.json({ ok: true, sent: true });
    } catch (e: any) {
      const err = String(e?.message || e).slice(0, 500);
      await query(`update ai_messages set status = 'failed', error = $2, updated_at = now() where id = $1`, [id, err]);
      await audit({ ghlLocationId: msg.ghl_location_id, messageId: id, event: 'send_failed', detail: { error: err }, actor });
      return NextResponse.json({ error: err }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
