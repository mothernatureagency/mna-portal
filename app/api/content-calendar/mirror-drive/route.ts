import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { extractDriveFileId } from '@/lib/drive';
import { fetchDriveFileBytes } from '@/lib/google-drive';
import { uploadPublicMedia } from '@/lib/media-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Copy a Google Drive photo/video into public storage and return a direct URL.
 *
 * A Drive share link previews (through Drive's thumbnail endpoint) but social
 * publishers can't fetch media from one, so a post carrying a raw Drive link
 * would go out with no photo. Mirroring it here means the same URL both
 * previews and publishes.
 *
 * POST { driveUrl, postId? }
 * With postId, the mirrored URL replaces that Drive link on the post.
 * Returns { url, name, replaced }.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can attach media' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const driveUrl = (body?.driveUrl || '').toString().trim();
  const postId = (body?.postId || '').toString().trim();
  if (!driveUrl) return NextResponse.json({ error: 'driveUrl required' }, { status: 400 });

  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) {
    return NextResponse.json({
      error: "That doesn't look like a Drive file link. Use the file's share link (drive.google.com/file/d/…), not a folder.",
    }, { status: 400 });
  }

  let url: string;
  let name: string;
  try {
    const file = await fetchDriveFileBytes(user.email || null, fileId);
    name = file.name;
    const type = (file.mimeType || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/') && !type.startsWith('video/')) {
      return NextResponse.json({
        error: `"${file.name}" is a ${type || 'file'}, not a photo or video.`,
      }, { status: 400 });
    }
    url = await uploadPublicMedia(new Uint8Array(file.bytes), type, { prefix: 'drive' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not copy that file from Drive' }, { status: 400 });
  }

  // Swap the Drive link for the mirrored one wherever it sits on the post, so
  // an existing post gets fixed in place rather than gaining a duplicate.
  let replaced = false;
  if (postId) {
    const { rows } = await query<{ photo_urls: unknown; photo_drive_url: string | null }>(
      `select photo_urls, photo_drive_url from content_calendar where id = $1`, [postId],
    );
    if (rows[0]) {
      const current = Array.isArray(rows[0].photo_urls) && rows[0].photo_urls.length > 0
        ? (rows[0].photo_urls as string[]).filter((u) => typeof u === 'string')
        : [rows[0].photo_drive_url].filter((u): u is string => !!u);

      const sameFile = (u: string) => extractDriveFileId(u) === fileId;
      const next = current.some(sameFile)
        ? current.map((u) => (sameFile(u) ? url : u))
        : [...current, url];

      await query(
        `update content_calendar set photo_urls = $1::jsonb, photo_drive_url = $2 where id = $3`,
        [JSON.stringify(next), next[0] || null, postId],
      );
      replaced = current.some(sameFile);
    }
  }

  return NextResponse.json({ url, name, replaced });
}
