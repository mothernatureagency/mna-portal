import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list campaigns for a client
// ?clientId=prime-iv            — all campaigns (staff)
// ?clientId=prime-iv&visible=1  — only client_visible=true (client portal)
// ?status=approved              — filter by status (used by Make polling)
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  const onlyVisible = req.nextUrl.searchParams.get('visible') === '1';
  const statusFilter = req.nextUrl.searchParams.get('status');

  let where = '';
  const params: any[] = [];

  if (clientId && clientId !== 'mna') {
    params.push(clientId);
    where += ` where c.client_id = $${params.length}`;
  }
  if (onlyVisible) {
    where += where ? ' and' : ' where';
    where += ' c.client_visible = true';
  }
  if (statusFilter) {
    params.push(statusFilter);
    where += where ? ' and' : ' where';
    where += ` c.status = $${params.length}`;
  }

  const { rows } = await query(
    `select c.*, m.recipients, m.delivered, m.bounced, m.opened, m.clicked,
            m.unsubscribed, m.open_rate, m.click_rate
     from campaigns c
     left join campaign_metrics m on m.campaign_id = c.id
     ${where}
     order by c.scheduled_date desc, c.created_at desc`,
    params
  );
  return NextResponse.json({ campaigns: rows });
}

// POST — create a new campaign
export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { clientId, campaignType, name, subject, body: campaignBody, scheduledDate, scheduledTime, audienceSegment, audienceCount } = body || {};
  if (!clientId || !campaignType || !name || !scheduledDate) {
    return NextResponse.json({ error: 'clientId, campaignType, name, and scheduledDate are required' }, { status: 400 });
  }

  const { rows } = await query(
    `insert into campaigns (client_id, campaign_type, name, subject, body, scheduled_date, scheduled_time, audience_segment, audience_count)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [clientId, campaignType, name, subject || null, campaignBody || null, scheduledDate, scheduledTime || null, audienceSegment || null, audienceCount || null]
  );
  return NextResponse.json({ campaign: rows[0] }, { status: 201 });
}

// PATCH — update a campaign
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];

  const patchable = ['name', 'campaign_type', 'subject', 'body', 'scheduled_date', 'scheduled_time', 'audience_segment', 'audience_count', 'client_comments', 'mna_comments', 'revive_campaign_id', 'client_id'];
  for (const key of patchable) {
    const val = body[key];
    if (val !== undefined) {
      values.push(val);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (body.status !== undefined) {
    values.push(body.status);
    fields.push(`status = $${values.length}`);
    if (body.status === 'approved') {
      fields.push('approved_at = now()');
    }
    if (body.status === 'sent') {
      fields.push('sent_at = now()');
    }
  }

  if (body.client_visible !== undefined) {
    values.push(body.client_visible);
    fields.push(`client_visible = $${values.length}`);
    // Auto-promote drafting → pending_review when pushed to client
    if (body.client_visible === true && body.status === undefined) {
      fields.push(`status = CASE WHEN status = 'drafting' THEN 'pending_review' ELSE status END`);
    }
  }

  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update campaigns set ${fields.join(', ')} where id = $${values.length} returning *`,
    values
  );
  if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ campaign: rows[0] });
}

// DELETE — remove a campaign
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from campaigns where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
