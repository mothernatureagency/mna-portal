import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'content-images';
const MAX_BYTES = 300 * 1024 * 1024; // 300MB — room for video

/**
 * Issue a signed upload URL so the browser can send media (image OR video)
 * straight to Supabase Storage, bypassing the serverless request-body limit
 * that would choke on real video files. Returns the signed URL to PUT to plus
 * the final public URL the caller saves to content_calendar.photo_drive_url.
 *
 * POST { filename, contentType } → { signedUrl, publicUrl, path }
 */
export async function POST(req: NextRequest) {
  await ensureSchema();

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can upload media' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const filename = (body?.filename || '').toString();
  const contentType = (body?.contentType || '').toString();
  if (!/^image\/|^video\//.test(contentType)) {
    return NextResponse.json({ error: 'Only image or video files are supported' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Storage is not configured' }, { status: 500 });
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Ensure the public bucket exists with a large enough limit (idempotent).
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  if (bucketErr && !/already exists|resource already exists|duplicate/i.test(bucketErr.message)) {
    const { data: existing } = await admin.storage.getBucket(BUCKET);
    if (!existing) return NextResponse.json({ error: `Storage bucket error: ${bucketErr.message}` }, { status: 500 });
  }

  const extFromName = (filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const extFromType = (contentType.split('/')[1] || '').replace(/[^a-z0-9]/gi, '').slice(0, 5);
  const ext = extFromName || extFromType || (contentType.startsWith('video/') ? 'mp4' : 'png');
  const kind = contentType.startsWith('video/') ? 'video' : 'img';
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${kind}.${ext}`;

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: `Could not create upload URL: ${error?.message || 'unknown'}` }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl: pub.publicUrl });
}
