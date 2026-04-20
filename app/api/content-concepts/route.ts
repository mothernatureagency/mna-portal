import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-client content concepts bucket.
 *
 * GET    /api/content-concepts?clientId=prime-iv
 * POST   /api/content-concepts            { clientId, title, body?, suggestedDate?, tags? }
 * PATCH  /api/content-concepts            { id, title?, body?, suggestedDate?, tags?, usedAt? }
 * DELETE /api/content-concepts?id=...
 */

export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const { rows } = await query(
    `select id, title, body, suggested_date, tags, used_at, created_at
       from content_concepts
      where client_id = $1
      order by suggested_date asc nulls last, created_at desc`,
    [clientId],
  );
  return NextResponse.json({ concepts: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, title, body, suggestedDate, tags } = b || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId and title required' }, { status: 400 });
  const { rows } = await query(
    `insert into content_concepts (client_id, title, body, suggested_date, tags)
     values ($1, $2, $3, $4, $5) returning *`,
    [clientId, title.trim(), body || null, suggestedDate || null, tags || null],
  );
  return NextResponse.json({ concept: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, title, body, suggestedDate, tags, usedAt } = b || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const fields: string[] = [];
  const values: any[] = [];
  if (title !== undefined)         { values.push(title); fields.push(`title = $${values.length}`); }
  if (body !== undefined)          { values.push(body); fields.push(`body = $${values.length}`); }
  if (suggestedDate !== undefined) { values.push(suggestedDate || null); fields.push(`suggested_date = $${values.length}`); }
  if (tags !== undefined)          { values.push(tags || null); fields.push(`tags = $${values.length}`); }
  if (usedAt !== undefined)        { values.push(usedAt || null); fields.push(`used_at = $${values.length}`); }
  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(id);
  const { rows } = await query(
    `update content_concepts set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  return NextResponse.json({ concept: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from content_concepts where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
