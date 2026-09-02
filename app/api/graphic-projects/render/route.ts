import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { uploadPublicMedia } from '@/lib/media-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Save a rasterised artboard.
 *
 * The browser rasterises the artboard (it is the only place the fonts, the
 * layout and the images all exist at once) and posts the PNG here as a data
 * URL. We put it in the public media bucket, hang it off the project, and —
 * if the graphic was made for a calendar post — attach it to that post, which
 * closes the open "needs a graphic" task the same way a manual upload does.
 *
 * POST /api/graphic-projects/render
 * body: { projectId, dataUrl, postId?, attach?: boolean }
 * → { url }
 */

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  await ensureSchema();

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { projectId, dataUrl, postId, attach } = b || {};
  if (!projectId || !dataUrl) return NextResponse.json({ error: 'projectId + dataUrl required' }, { status: 400 });

  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl));
  if (!m) return NextResponse.json({ error: 'dataUrl must be a base64 png/jpeg/webp' }, { status: 400 });

  const contentType = m[1];
  const bytes = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length) return NextResponse.json({ error: 'The render came back empty' }, { status: 400 });
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: `That render is ${(bytes.length / 1024 / 1024).toFixed(1)}MB — max 20MB. Try a smaller export scale.` }, { status: 413 });
  }

  let url: string;
  try {
    url = await uploadPublicMedia(new Uint8Array(bytes), contentType, { prefix: 'graphics' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save the render' }, { status: 500 });
  }

  const { rows } = await query<any>(
    `update graphic_projects
        set image_url = $1, status = case when status in ('drafting','designed') then 'rendered' else status end, updated_at = now()
      where id = $2 returning *`,
    [url, projectId],
  );
  const project = rows[0];
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Push it onto the calendar post, if this graphic belongs to one.
  const target = postId || project.content_item_id;
  let attached = false;
  if (attach !== false && target) {
    try {
      const { rows: postRows } = await query<any>('select photo_urls from content_calendar where id = $1', [target]);
      if (postRows[0]) {
        const existing: string[] = Array.isArray(postRows[0].photo_urls) ? postRows[0].photo_urls : [];
        // The freshly made graphic becomes the cover; anything already there
        // (a shot from the client, an earlier render) keeps its place behind it.
        const next = [url, ...existing.filter((u) => u && u !== url)];
        await query(
          `update content_calendar set photo_urls = $1::jsonb, photo_drive_url = $2 where id = $3`,
          [JSON.stringify(next), url, target],
        );
        await query(
          `update client_requests set status = 'done', completed_at = now()
            where content_item_id = $1 and status = 'open'`,
          [target],
        );
        attached = true;
      }
    } catch { /* the render is saved either way — don't lose it over an attach */ }
  }

  return NextResponse.json({ url, attached, project });
}
