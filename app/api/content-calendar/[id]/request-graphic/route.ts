import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/content-calendar/:id/request-graphic
// body: { note?: string, assignedTo?: string }
//
// Raises a "this post needs artwork" task against a content item. The task
// lives in client_requests so it shows up in the agenda alongside everything
// else, and carries content_item_id so the tracker can flag the post and close
// the task automatically once a photo is attached (see the PATCH handler).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();

  let note = '';
  let assignedTo: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.note === 'string') note = body.note.trim();
    if (typeof body?.assignedTo === 'string' && body.assignedTo.trim()) assignedTo = body.assignedTo.trim();
  } catch { /* no body is fine — the post's own details are enough */ }

  const { rows } = await query<any>(
    `select cc.*, p.client_name from content_calendar cc
       join projects p on p.id = cc.project_id
      where cc.id = $1`,
    [params.id],
  );
  const item = rows[0];
  if (!item) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Don't stack duplicates — re-requesting an already-open task just updates it.
  const { rows: openRows } = await query<any>(
    `select id from client_requests where content_item_id = $1 and status = 'open' limit 1`,
    [params.id],
  );

  const matched = clients.find((c) => c.name === item.client_name || c.shortName === item.client_name);
  const clientId = matched?.id || item.client_name || '';

  const title = `Graphic needed: ${item.title || 'Untitled post'}`;
  const context = [
    `${item.platform} · ${item.content_type || 'Post'} · posts ${item.post_date}`,
    item.caption ? `\nCaption:\n${item.caption}` : '',
    note ? `\nNotes:\n${note}` : '',
  ].filter(Boolean).join('\n');

  if (openRows[0]) {
    const { rows: updated } = await query<any>(
      `update client_requests set title = $1, description = $2, assigned_to = coalesce($3, assigned_to)
        where id = $4 returning *`,
      [title, context, assignedTo, openRows[0].id],
    );
    return NextResponse.json({ request: updated[0], updated: true });
  }

  const { rows: created } = await query<any>(
    `insert into client_requests (client_id, title, description, status, assigned_to, content_item_id)
     values ($1, $2, $3, 'open', $4, $5) returning *`,
    [clientId, title, context, assignedTo || 'team', params.id],
  );
  return NextResponse.json({ request: created[0], updated: false });
}

// DELETE /api/content-calendar/:id/request-graphic — cancel the open request.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  await query(
    `delete from client_requests where content_item_id = $1 and status = 'open'`,
    [params.id],
  );
  return NextResponse.json({ ok: true });
}
