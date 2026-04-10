import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/send-weekly-email
 *
 * Saves an approved weekly email draft to client_kv.
 * Make.com polls this endpoint to find approved drafts, sends them via Gmail,
 * then marks them as sent.
 *
 * Body: { clientId, subject, body, status: "approved" }
 */
export async function POST(req: NextRequest) {
  await ensureSchema();

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { clientId, subject, body, status } = data || {};
  if (!clientId || !subject || !body) {
    return NextResponse.json({ error: 'clientId, subject, and body required' }, { status: 400 });
  }

  const draft = {
    subject,
    body,
    status: status || 'approved',
    approvedAt: new Date().toISOString(),
    sentAt: null,
  };

  await query(
    `INSERT INTO client_kv (client_id, key, value, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (client_id, key)
     DO UPDATE SET value = $3::jsonb, updated_at = now()`,
    [clientId, 'weekly_email_draft', JSON.stringify(draft)],
  );

  return NextResponse.json({ ok: true, draft });
}

/**
 * GET /api/send-weekly-email?clientId=prime-iv
 *
 * Returns the current draft for a client. Used by:
 * - Make.com to poll for approved drafts to send
 * - The email preview page to load saved drafts
 */
export async function GET(req: NextRequest) {
  await ensureSchema();

  const clientId = req.nextUrl.searchParams.get('clientId');

  // If no clientId, return all approved drafts (for Make to poll)
  if (!clientId) {
    const { rows } = await query(
      `SELECT client_id, value FROM client_kv
       WHERE key = 'weekly_email_draft'
         AND value->>'status' = 'approved'`,
      [],
    );
    return NextResponse.json({
      drafts: rows.map((r) => ({ clientId: r.client_id, ...r.value })),
    });
  }

  const { rows } = await query(
    `SELECT value FROM client_kv WHERE client_id = $1 AND key = 'weekly_email_draft'`,
    [clientId],
  );

  return NextResponse.json({ draft: rows[0]?.value || null });
}

/**
 * PATCH /api/send-weekly-email
 * body: { clientId, status: "sent" }
 *
 * Called by Make after successfully sending the email.
 * Marks the draft as sent so it doesn't get re-sent.
 */
export async function PATCH(req: NextRequest) {
  await ensureSchema();

  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { clientId } = data || {};
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  // Get current draft and mark as sent
  const { rows } = await query(
    `SELECT value FROM client_kv WHERE client_id = $1 AND key = 'weekly_email_draft'`,
    [clientId],
  );

  if (!rows[0]) return NextResponse.json({ error: 'No draft found' }, { status: 404 });

  const draft = rows[0].value;
  draft.status = 'sent';
  draft.sentAt = new Date().toISOString();

  await query(
    `UPDATE client_kv SET value = $1::jsonb, updated_at = now()
     WHERE client_id = $2 AND key = 'weekly_email_draft'`,
    [JSON.stringify(draft), clientId],
  );

  return NextResponse.json({ ok: true });
}
