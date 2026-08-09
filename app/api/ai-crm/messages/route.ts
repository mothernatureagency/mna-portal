import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI Conversations feed for the dashboard. Session-authenticated.
 *
 * GET /api/ai-crm/messages?location=&status=&category=&minConfidence=&from=&to=&q=&limit=
 * GET /api/ai-crm/messages?id=<uuid>  → single message + audit trail
 */

export async function GET(req: NextRequest) {
  await ensureSchema();
  const p = req.nextUrl.searchParams;

  const id = p.get('id');
  if (id) {
    const { rows } = await query(`select * from ai_messages where id = $1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: logs } = await query(
      `select event, detail, actor, created_at from ai_audit_logs where message_id = $1 order by created_at asc`,
      [id],
    );
    const { rows: thread } = await query(
      `select id, inbound_body, suggested_response, final_response, status, confidence, category, created_at, sent_at
         from ai_messages
        where ghl_location_id = $1 and contact_id = $2
        order by created_at asc limit 50`,
      [rows[0].ghl_location_id, rows[0].contact_id],
    );
    return NextResponse.json({ message: rows[0], audit: logs, thread });
  }

  const where: string[] = [];
  const vals: unknown[] = [];
  const add = (clause: string, v: unknown) => { vals.push(v); where.push(clause.replace('?', `$${vals.length}`)); };

  if (p.get('location')) add(`m.ghl_location_id = ?`, p.get('location'));
  if (p.get('status')) add(`m.status = ?`, p.get('status'));
  if (p.get('category')) add(`m.category = ?`, p.get('category'));
  if (p.get('minConfidence')) add(`m.confidence >= ?`, Number(p.get('minConfidence')));
  if (p.get('from')) add(`m.created_at >= ?`, p.get('from'));
  if (p.get('to')) add(`m.created_at <= ?::date + interval '1 day'`, p.get('to'));
  if (p.get('q')) {
    vals.push(p.get('q'));
    const i = vals.length;
    where.push(`(m.contact_name ilike '%' || $${i} || '%' or m.contact_phone ilike '%' || $${i} || '%')`);
  }

  const limit = Math.min(200, Number(p.get('limit') || 100));
  const sql = `
    select m.*, l.name as location_name,
           s.human_takeover, s.ai_paused as contact_ai_paused, s.opted_out
      from ai_messages m
      left join ghl_locations l on l.ghl_location_id = m.ghl_location_id
      left join ai_conversation_state s
        on s.ghl_location_id = m.ghl_location_id and s.contact_id = m.contact_id
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by m.created_at desc
     limit ${limit}`;
  const { rows } = await query(sql, vals);

  const { rows: counts } = await query(
    `select status, count(*)::int as n from ai_messages group by status`,
  );
  return NextResponse.json({ messages: rows, counts });
}
