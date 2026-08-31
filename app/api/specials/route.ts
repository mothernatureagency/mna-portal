import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { queueEmailNotification, getClientNotificationEmail, STAFF_NOTIFY_EMAIL } from '@/lib/notifications';
import { clients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Monthly specials — the stage before the content calendar.
 *
 * MNA drafts the month's offers, pushes them to the client, and the client
 * approves / denies / asks for changes on each one. Content only gets planned
 * around what came back approved.
 *
 * GET    ?clientId=&month=YYYY-MM[&visible=1]  — list (visible=1 for the portal)
 * POST   { clientId, month, items: [...] }     — create one or many
 * PATCH  { id, ...fields }                     — edit / move through approval
 * DELETE ?id=                                  — remove (staff only)
 */

const EDITABLE = [
  'name', 'offer', 'description', 'starts_on', 'ends_on', 'terms',
  'sort_order', 'status', 'client_visible', 'client_comments', 'mna_comments',
] as const;

// What a client is allowed to change on someone else's record: the verdict and
// their own note. Everything else is staff-only.
const CLIENT_EDITABLE = new Set(['status', 'client_comments']);
const CLIENT_STATUSES = new Set(['approved', 'denied', 'changes_requested']);

async function whoami() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  return { email: user.email || '', role, isClient: role === 'client' };
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const me = await whoami();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ items: [] });
  const month = req.nextUrl.searchParams.get('month');
  // Clients only ever see what's been pushed to them, whatever the caller asks.
  const onlyVisible = req.nextUrl.searchParams.get('visible') === '1' || me.isClient;

  const where: string[] = ['client_id = $1'];
  const values: any[] = [clientId];
  if (month) { values.push(month); where.push(`month = $${values.length}`); }
  if (onlyVisible) where.push('client_visible = true');

  const { rows } = await query(
    `select * from monthly_specials
      where ${where.join(' and ')}
      order by month asc, sort_order asc, created_at asc`,
    values,
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const me = await whoami();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (me.isClient) return NextResponse.json({ error: 'Only staff can add specials' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const clientId = (body?.clientId || '').toString();
  const month = (body?.month || '').toString();
  if (!clientId || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'clientId and month (YYYY-MM) required' }, { status: 400 });
  }
  const items: any[] = Array.isArray(body?.items) ? body.items : [body?.item].filter(Boolean);
  if (items.length === 0) return NextResponse.json({ error: 'items required' }, { status: 400 });

  // New rows land after whatever is already there, keeping the month's order.
  const { rows: maxRows } = await query<{ max: number | null }>(
    `select max(sort_order) as max from monthly_specials where client_id = $1 and month = $2`,
    [clientId, month],
  );
  let next = (maxRows[0]?.max ?? -1) + 1;

  const inserted: any[] = [];
  for (const it of items) {
    const name = (it?.name || '').toString().trim();
    if (!name) continue;
    const { rows } = await query(
      `insert into monthly_specials
         (client_id, month, name, offer, description, starts_on, ends_on, terms, sort_order, status, mna_comments)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [
        clientId, month, name,
        it?.offer || null,
        it?.description || null,
        it?.starts_on || null,
        it?.ends_on || null,
        it?.terms || null,
        Number.isFinite(it?.sort_order) ? it.sort_order : next++,
        'drafting',
        it?.mna_comments || null,
      ],
    );
    inserted.push(rows[0]);
  }
  return NextResponse.json({ items: inserted, count: inserted.length });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const me = await whoami();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Bulk push: flip a whole month to the client in one call.
  if (body?.pushMonth) {
    if (me.isClient) return NextResponse.json({ error: 'Only staff can push specials' }, { status: 403 });
    const clientId = (body?.clientId || '').toString();
    const month = (body?.month || '').toString();
    if (!clientId || !month) return NextResponse.json({ error: 'clientId and month required' }, { status: 400 });
    const { rows } = await query(
      `update monthly_specials
          set client_visible = true,
              status = case when status = 'drafting' then 'pending_review' else status end
        where client_id = $1 and month = $2 and (client_visible = false or status = 'drafting')
        returning *`,
      [clientId, month],
    );
    if (rows.length > 0) await notifyClientOfReview(clientId, month, rows.length);
    return NextResponse.json({ items: rows, pushed: rows.length });
  }

  const id = body?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    if (me.isClient && !CLIENT_EDITABLE.has(key)) continue;
    if (me.isClient && key === 'status' && !CLIENT_STATUSES.has(String(body[key]))) continue;
    values.push(body[key]);
    fields.push(`${key} = $${values.length}`);
  }
  if (body.status === 'approved') fields.push('approved_at = now()');
  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query<any>(
    `update monthly_specials set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  const updated = rows[0];
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Notifications never break the write.
  try {
    if (me.isClient && ['approved', 'denied', 'changes_requested'].includes(String(body.status))) {
      const label = String(body.status).replace('_', ' ');
      await queueEmailNotification({
        to: STAFF_NOTIFY_EMAIL,
        subject: `Special ${label}: ${updated.name} — ${clientLabel(updated.client_id)}`,
        body: [
          `${clientLabel(updated.client_id)} marked a ${updated.month} special as ${label}.`,
          '',
          `Special: ${updated.name}${updated.offer ? ` — ${updated.offer}` : ''}`,
          updated.client_comments ? `Their note: ${updated.client_comments}` : '',
          '',
          'Review: https://portal.mothernatureagency.com/specials',
        ].filter(Boolean).join('\n'),
        eventType: 'special_reviewed',
        clientId: updated.client_id,
        relatedId: updated.id,
      });
    } else if (!me.isClient && body.client_visible === true) {
      await notifyClientOfReview(updated.client_id, updated.month, 1);
    }
  } catch (err) {
    console.error('[specials] notification enqueue failed', err);
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const me = await whoami();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (me.isClient) return NextResponse.json({ error: 'Only staff can delete specials' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from monthly_specials where id = $1', [id]);
  return NextResponse.json({ ok: true });
}

function clientLabel(clientId: string): string {
  return clients.find((c) => c.id === clientId)?.name || clientId;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function notifyClientOfReview(clientId: string, month: string, count: number) {
  const to = await getClientNotificationEmail(clientId);
  if (!to) return;
  await queueEmailNotification({
    to,
    subject: `Your ${monthLabel(month)} specials are ready to review`,
    body: [
      `We've drafted ${count} special${count === 1 ? '' : 's'} for ${monthLabel(month)}.`,
      '',
      'Have a look and approve the ones you want, or tell us what to change. Once they\'re settled we build the month\'s content around them.',
      '',
      'Review here: https://portal.mothernatureagency.com/client/specials',
      '',
      '— Mother Nature Agency',
    ].join('\n'),
    eventType: 'specials_ready',
    clientId,
    relatedId: month,
  });
}
