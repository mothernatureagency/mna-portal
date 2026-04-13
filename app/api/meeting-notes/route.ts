import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/meeting-notes?clientId=prime-iv
 *       — staff: all notes for the client
 * GET /api/meeting-notes?clientId=prime-iv&visible=1
 *       — client portal: only client_visible=true notes
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const onlyVisible = req.nextUrl.searchParams.get('visible') === '1';
  const visibleClause = onlyVisible ? ' and client_visible = true' : '';

  const { rows } = await query(
    `select * from meeting_notes where client_id = $1${visibleClause} order by meeting_date desc, created_at desc`,
    [clientId],
  );
  return NextResponse.json({ notes: rows });
}

/**
 * POST /api/meeting-notes
 * Create a new meeting note.
 * Body: { clientId, meetingDate, title?, summary?, attendees?, actionItems? }
 *
 * Also auto-creates client_requests tasks from actionItems if provided.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { clientId, meetingDate, title, summary, attendees, actionItems } = body || {};
  if (!clientId || !meetingDate) {
    return NextResponse.json({ error: 'clientId and meetingDate required' }, { status: 400 });
  }

  const { rows } = await query(
    `insert into meeting_notes (client_id, meeting_date, title, summary, attendees, action_items)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [clientId, meetingDate, title || null, summary || null, attendees || null, actionItems ? JSON.stringify(actionItems) : null],
  );

  // Auto-create tasks from action items
  const tasksCreated: any[] = [];
  if (Array.isArray(actionItems)) {
    for (const item of actionItems) {
      if (!item.title) continue;
      const assignee = item.assignee || 'team';
      const targetClientId = assignee === 'client' ? clientId : clientId;
      const description = `From ${meetingDate} call${assignee === 'client' ? ' — waiting on client' : ' — internal task'}`;
      const { rows: taskRows } = await query(
        `insert into client_requests (client_id, title, description, assigned_to) values ($1, $2, $3, $4) returning *`,
        [targetClientId, item.title, description, item.assignedTo || null],
      );
      tasksCreated.push(taskRows[0]);
    }
  }

  return NextResponse.json({ note: rows[0], tasksCreated });
}

/**
 * PATCH /api/meeting-notes
 * Update a meeting note.
 */
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];

  for (const key of ['title', 'summary', 'attendees', 'meeting_date']) {
    if (body[key] !== undefined) {
      values.push(body[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (body.action_items !== undefined) {
    values.push(JSON.stringify(body.action_items));
    fields.push(`action_items = $${values.length}::jsonb`);
  }
  if (body.client_visible !== undefined) {
    values.push(body.client_visible);
    fields.push(`client_visible = $${values.length}`);
  }

  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update meeting_notes set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ note: rows[0] });
}

/**
 * DELETE /api/meeting-notes?id=...
 */
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from meeting_notes where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
