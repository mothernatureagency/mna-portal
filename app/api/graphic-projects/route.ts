import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Graphic Lab projects CRUD. Deliberately shaped like /api/video-projects so
 * the two labs stay learnable as one thing.
 *
 * GET    /api/graphic-projects?clientId=prime-iv  → list
 * GET    /api/graphic-projects?id=...             → single (includes html)
 * POST   /api/graphic-projects  body: { clientId, title, format?, topic?, headline?, subhead?, cta?, contentItemId? }
 * PATCH  /api/graphic-projects  body: { id, ...anyField }
 * DELETE /api/graphic-projects?id=...
 */

const JSON_FIELDS = ['assets', 'versions'];

export async function GET(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  const clientId = req.nextUrl.searchParams.get('clientId');
  const contentItemId = req.nextUrl.searchParams.get('contentItemId');

  if (id) {
    const { rows } = await query('select * from graphic_projects where id = $1', [id]);
    return NextResponse.json({ project: rows[0] || null });
  }
  if (contentItemId) {
    const { rows } = await query(
      `select * from graphic_projects where content_item_id = $1 order by updated_at desc limit 1`,
      [contentItemId],
    );
    return NextResponse.json({ project: rows[0] || null });
  }
  if (!clientId) return NextResponse.json({ error: 'clientId or id required' }, { status: 400 });

  // The artboard HTML runs to tens of KB — the list view never needs it.
  const { rows } = await query(
    `select id, client_id, title, format, topic, status, image_url, content_item_id,
            (html is not null) as has_artboard, updated_at, created_at
       from graphic_projects where client_id = $1 order by updated_at desc`,
    [clientId],
  );
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, title, format, topic, headline, subhead, cta, brief, contentItemId } = b || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId + title required' }, { status: 400 });

  const { rows } = await query(
    `insert into graphic_projects (client_id, title, format, topic, headline, subhead, cta, brief, content_item_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [
      clientId, String(title).trim(), format || 'ig-square', topic || null,
      headline || null, subhead || null, cta || null, brief || null,
      contentItemId || null,
    ],
  );
  return NextResponse.json({ project: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id } = b || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patchable = [
    'title', 'format', 'topic', 'brief', 'headline', 'subhead', 'cta',
    'assets', 'html', 'versions', 'image_url', 'content_item_id', 'status',
  ];
  const fields: string[] = [];
  const values: any[] = [];
  for (const k of patchable) {
    if (b[k] === undefined) continue;
    const isJson = JSON_FIELDS.includes(k);
    values.push(isJson ? JSON.stringify(b[k]) : b[k]);
    fields.push(isJson ? `${k} = $${values.length}::jsonb` : `${k} = $${values.length}`);
  }
  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  fields.push('updated_at = now()');
  values.push(id);

  const { rows } = await query(
    `update graphic_projects set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  if (!rows[0]) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ project: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from graphic_projects where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
