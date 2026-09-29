import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getPortalAuth } from '@/lib/portal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/content-calendar/[id]/duplicate
 * body: { post_date? }  — defaults to the original's date
 *
 * Copies a post so staff can tweak a variant (different channel, edited copy,
 * new date) without touching the original. The copy always starts life as a
 * fresh draft: pending review, not client-visible, auto-post off, and no
 * publish state — so a duplicate can never accidentally re-post. A PDM brand
 * post duplicates as a normal editable post (the copy is ours to edit, not
 * corporate's reference).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (auth.role === 'client') return NextResponse.json({ error: 'Only staff can duplicate posts' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const postDate: string | null = typeof body?.post_date === 'string' && body.post_date ? body.post_date : null;

  const { rows } = await query<any>(`select * from content_calendar where id = $1`, [params.id]);
  const src = rows[0];
  if (!src) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const title = src.title
    ? (/\(copy\)\s*$/i.test(src.title) ? src.title : `${src.title} (copy)`)
    : 'Untitled post (copy)';
  const assignedRole = src.assigned_role === 'PDM (Brand)' ? 'Social Media Manager' : src.assigned_role;

  const { rows: created } = await query<any>(
    `insert into content_calendar
       (project_id, post_date, platform, content_type, title, caption,
        photo_drive_url, photo_urls, assigned_role,
        status, client_approval_status, client_visible, auto_post)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', 'pending_review', false, false)
     returning *`,
    [
      src.project_id,
      postDate || src.post_date,
      src.platform,
      src.content_type,
      title,
      src.caption,
      src.photo_drive_url,
      src.photo_urls ? JSON.stringify(src.photo_urls) : null,
      assignedRole,
    ],
  );
  return NextResponse.json({ item: created[0] });
}
