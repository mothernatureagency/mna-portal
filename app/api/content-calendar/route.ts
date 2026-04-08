import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getPlaybook } from '@/lib/agents/playbooks';

export const runtime = 'nodejs';

async function getOrCreateProject(clientName: string): Promise<string> {
  const existing = await query<{ id: string }>(
    'select id from projects where client_name = $1 limit 1',
    [clientName]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await query<{ id: string }>(
    'insert into projects (name, client_name) values ($1, $2) returning id',
    [`${clientName} Content`, clientName]
  );
  return created.rows[0].id;
}

function dayOffsetDate(startDate: string, day: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (day - 1));
  return d.toISOString().slice(0, 10);
}

// PATCH — update a single content item.
// Supports caption, status, client_approval_status, client_comments, mna_comments.
// When client_approval_status transitions to 'approved', approved_at is stamped.
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, caption, status, client_approval_status, client_comments, mna_comments } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const fields: string[] = [];
  const values: any[] = [];
  if (caption !== undefined) { values.push(caption); fields.push(`caption = $${values.length}`); }
  if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
  if (client_approval_status !== undefined) {
    values.push(client_approval_status);
    fields.push(`client_approval_status = $${values.length}`);
    if (client_approval_status === 'approved') {
      fields.push(`approved_at = now()`);
    }
  }
  if (client_comments !== undefined) { values.push(client_comments); fields.push(`client_comments = $${values.length}`); }
  if (mna_comments !== undefined) { values.push(mna_comments); fields.push(`mna_comments = $${values.length}`); }
  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(id);
  const { rows } = await query(
    `update content_calendar set ${fields.join(', ')} where id = $${values.length} returning *`,
    values
  );
  return NextResponse.json({ item: rows[0] });
}

// GET — list content for a client
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientName = req.nextUrl.searchParams.get('client');
  if (!clientName) return NextResponse.json({ items: [] });
  const { rows } = await query(
    `select cc.* from content_calendar cc
       join projects p on p.id = cc.project_id
      where p.client_name = $1
      order by cc.post_date asc, cc.created_at asc`,
    [clientName]
  );
  return NextResponse.json({ items: rows });
}

// POST — bulk insert content items
// body: { clientName, items: [{ post_date, platform, content_type, title, status?, assigned_role? }] }
//   OR: { clientName, playbookId, startDate }  ← applies a playbook
export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const clientName: string = body?.clientName;
  if (!clientName) return NextResponse.json({ error: 'clientName required' }, { status: 400 });

  type SeedItem = {
    post_date: string;
    platform: string;
    content_type?: string;
    title?: string;
    status?: string;
    assigned_role?: string;
    caption?: string;
  };
  let items: SeedItem[] = [];

  if (body?.playbookId) {
    const pb = getPlaybook(body.playbookId);
    if (!pb) return NextResponse.json({ error: 'Unknown playbook' }, { status: 404 });
    const startDate: string = body?.startDate || new Date().toISOString().slice(0, 10);
    items = pb.items.map((it) => ({
      post_date: dayOffsetDate(startDate, it.day),
      platform: it.platform,
      content_type: it.content_type,
      title: `[${it.phase}] ${it.title} — Hook: ${it.hook} | CTA: ${it.cta}`,
      status: 'Draft',
      assigned_role: 'Social Media Manager',
      caption: it.caption, // pre written caption goes straight into content_calendar.caption
    }));
  } else if (Array.isArray(body?.items)) {
    items = body.items;
  } else {
    return NextResponse.json({ error: 'items or playbookId required' }, { status: 400 });
  }

  const projectId = await getOrCreateProject(clientName);
  const inserted: any[] = [];
  for (const it of items) {
    if (!it.post_date || !it.platform) continue;
    const { rows } = await query(
      `insert into content_calendar (project_id, post_date, platform, content_type, title, status, assigned_role, caption, client_approval_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        projectId,
        it.post_date,
        it.platform,
        it.content_type || null,
        it.title || null,
        it.status || 'Draft',
        it.assigned_role || null,
        it.caption || null,
        // If caption is pre written, it is ready for client review. Otherwise pending MNA draft.
        it.caption ? 'pending_review' : 'drafting',
      ]
    );
    inserted.push(rows[0]);
  }
  return NextResponse.json({ inserted, count: inserted.length });
}
