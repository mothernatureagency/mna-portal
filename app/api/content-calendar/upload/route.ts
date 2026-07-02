import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'content-images';
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Upload an image and attach it to a content_calendar post.
 *
 * Lets staff drag-and-drop an image straight onto a post instead of pasting
 * a Google Drive link. The file is stored in a public Supabase Storage
 * bucket and its public URL is saved to content_calendar.photo_drive_url
 * (the same field Drive links use, so all the existing preview/rendering
 * paths keep working).
 *
 * POST multipart/form-data: { file: <image>, postId?: string }
 * Returns: { url }
 */
export async function POST(req: NextRequest) {
  await ensureSchema();

  // Auth — staff only (clients can't attach media).
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can upload media' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 }); }

  const file = form.get('file');
  const postId = (form.get('postId') as string) || '';
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is too large (max 20MB)' }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Storage is not configured' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Ensure the public bucket exists (idempotent — ignore "already exists").
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (bucketErr && !/already exists|resource already exists|duplicate/i.test(bucketErr.message)) {
    // Non-fatal only if the bucket genuinely already exists; otherwise surface.
    const { data: existing } = await admin.storage.getBucket(BUCKET);
    if (!existing) return NextResponse.json({ error: `Storage bucket error: ${bucketErr.message}` }, { status: 500 });
  }

  const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  // Attach to the post if one was named.
  if (postId) {
    try {
      await query(`update content_calendar set photo_drive_url = $1 where id = $2`, [url, postId]);
    } catch (e: any) {
      // Upload succeeded; surface the attach failure but still return the URL.
      return NextResponse.json({ url, warning: `Saved image but could not attach: ${e?.message || e}` });
    }
  }

  return NextResponse.json({ url });
}
