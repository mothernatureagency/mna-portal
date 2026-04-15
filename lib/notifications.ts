import { query } from './db';

/**
 * Queue an outbound email notification for Make.com to pick up.
 * Make polls /api/notifications?pending=1 and sends via Gmail, then PATCHes status='sent'.
 */
export async function queueEmailNotification(params: {
  to: string;
  subject: string;
  body: string;
  eventType?: string;
  clientId?: string;
  relatedId?: string;
}) {
  const { to, subject, body, eventType, clientId, relatedId } = params;
  if (!to || !subject || !body) return null;
  const { rows } = await query(
    `insert into email_notifications (to_email, subject, body, event_type, client_id, related_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [to, subject, body, eventType || null, clientId || null, relatedId || null],
  );
  return rows[0]?.id || null;
}

/**
 * Look up the primary client-facing email for a client id.
 * Falls back to null if no contact is on file.
 */
export async function getClientNotificationEmail(clientId: string): Promise<string | null> {
  const { rows } = await query<{ email: string }>(
    `select email from contacts
       where client_id = $1 and contact_group = 'client'
       order by case when role = 'Owner' then 0 else 1 end, created_at asc
       limit 1`,
    [clientId],
  );
  return rows[0]?.email || null;
}

export const STAFF_NOTIFY_EMAIL = 'mn@mothernatureagency.com';
