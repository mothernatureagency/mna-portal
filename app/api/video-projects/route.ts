import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Video Lab projects CRUD.
 *
 * GET    /api/video-projects?clientId=prime-iv   → list
 * GET    /api/video-projects?id=...              → single
 * POST   /api/video-projects  body: { clientId, title, platform?, duration?, topic? }
 * PATCH  /api/video-projects  body: { id, ...anyField }
 * DELETE /api/video-projects?id=...
 */

export async function GET(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (id) {
    const { rows } = await query('select * from video_projects where id = $1', [id]);
    return NextResponse.json({ project: rows[0] || null });
  }
  if (!clientId) return NextResponse.json({ error: 'clientId or id required' }, { status: 400 });
  const { rows } = await query(
    `select id, client_id, title, platform, duration_sec, topic, status, updated_at, created_at
       from video_projects where client_id = $1 order by updated_at desc`,
    [clientId],
  );
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, title, platform, duration, topic } = b || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId + title required' }, { status: 400 });
  const { rows } = await query(
    `insert into video_projects (client_id, title, platform, duration_sec, topic)
     values ($1, $2, $3, $4, $5) returning *`,
    [clientId, title.trim(), platform || 'tiktok', Number(duration) || 30, topic || null],
  );
  return NextResponse.json({ project: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id } = b || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const patchable = ['title', 'platform', 'duration_sec', 'topic', 'script', 'shot_list', 'clips', 'references_list', 'voiceover_url', 'voiceover_voice', 'status'];
  const fields: string[] = [];
  const values: any[] = [];
  for (const k of patchable) {
    if (b[k] !== undefined) {
      values.push(
        ['shot_list', 'clips', 'references_list'].includes(k)
          ? JSON.stringify(b[k])
          : b[k],
      );
      fields.push(
        ['shot_list', 'clips', 'references_list'].includes(k)
          ? `${k} = $${values.length}::jsonb`
          : `${k} = $${values.length}`,
      );
    }
  }
  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await query(
    `update video_projects set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  return NextResponse.json({ project: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from video_projects where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
