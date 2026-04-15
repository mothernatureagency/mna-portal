import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 *   ?pending=1  → list all pending emails for Make.com to send
 *   ?clientId=x → list notifications for a client (all statuses)
 *   (no params) → list recent notifications (staff debug)
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const pending = req.nextUrl.searchParams.get('pending') === '1';
  const clientId = req.nextUrl.searchParams.get('clientId');

  if (pending) {
    const { rows } = await query(
      `select id, to_email, from_email, subject, body, event_type, client_id, related_id, created_at
         from email_notifications
        where status = 'pending'
        order by created_at asc
        limit 50`,
    );
    return NextResponse.json({ notifications: rows });
  }

  if (clientId) {
    const { rows } = await query(
      `select * from email_notifications where client_id = $1 order by created_at desc limit 100`,
      [clientId],
    );
    return NextResponse.json({ notifications: rows });
  }

  const { rows } = await query(
    `select * from email_notifications order by created_at desc limit 50`,
  );
  return NextResponse.json({ notifications: rows });
}

/**
 * POST /api/notifications
 * Manually enqueue a notification.
 * body: { to, subject, body, eventType?, clientId?, relatedId? }
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { to, subject, body, eventType, clientId, relatedId } = data || {};
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject, body required' }, { status: 400 });
  }
  const { rows } = await query(
    `insert into email_notifications (to_email, subject, body, event_type, client_id, related_id)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [to, subject, body, eventType || null, clientId || null, relatedId || null],
  );
  return NextResponse.json({ notification: rows[0] });
}

/**
 * PATCH /api/notifications
 * Make.com calls this after sending: { id, status: 'sent' | 'failed' }
 */
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let data: any;
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, status } = data || {};
  if (!id || !status) return NextResponse.json({ error: 'id, status required' }, { status: 400 });
  const sentAt = status === 'sent' ? new Date().toISOString() : null;
  await query(
    `update email_notifications set status = $1, sent_at = $2 where id = $3`,
    [status, sentAt, id],
  );
  return NextResponse.json({ ok: true });
}
