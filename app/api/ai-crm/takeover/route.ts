import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { audit, setConversationState } from '@/lib/ai-crm/engine';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual AI control. Session-authenticated via middleware.
 *
 * POST /api/ai-crm/takeover
 *   { ghlLocationId, contactId, action: "takeover", hours? }  → human-managed (optional cooldown)
 *   { ghlLocationId, contactId, action: "release" }           → AI may resume
 *   { ghlLocationId, contactId, action: "pause" | "resume" }  → pause AI for this contact
 *   { ghlLocationId, action: "pause_location" | "resume_location" } → whole location
 */

export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { ghlLocationId, contactId, action } = body || {};
  if (!ghlLocationId || !action) return NextResponse.json({ error: 'ghlLocationId and action required' }, { status: 400 });

  let actor = 'staff';
  try {
    const { data } = await createClient().auth.getUser();
    actor = data.user?.email || 'staff';
  } catch {}

  if (action === 'pause_location' || action === 'resume_location') {
    await query(`update ghl_locations set ai_paused = $2, updated_at = now() where ghl_location_id = $1`, [
      ghlLocationId,
      action === 'pause_location',
    ]);
    await audit({ ghlLocationId, event: action, actor });
    return NextResponse.json({ ok: true });
  }

  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 });

  if (action === 'takeover') {
    const hours = Number(body?.hours || 0);
    await setConversationState(ghlLocationId, contactId, {
      human_takeover: true,
      takeover_until: hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
    });
  } else if (action === 'release') {
    await setConversationState(ghlLocationId, contactId, { human_takeover: false, takeover_until: null, ai_paused: false });
  } else if (action === 'pause') {
    await setConversationState(ghlLocationId, contactId, { ai_paused: true });
  } else if (action === 'resume') {
    await setConversationState(ghlLocationId, contactId, { ai_paused: false, human_takeover: false, takeover_until: null });
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  await audit({ ghlLocationId, event: `contact_${action}`, detail: { contactId }, actor });
  return NextResponse.json({ ok: true });
}
