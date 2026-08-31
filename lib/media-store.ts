// Server-only. Puts bytes in the public media bucket and hands back a direct
// URL — the kind social publishers can actually fetch.
//
// Google Drive share links are not that: they preview through Drive's
// thumbnail endpoint but a publisher can't pull the image from one, so
// anything destined for a real post has to be mirrored here first.

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const MEDIA_BUCKET = 'content-images';
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Storage is not configured');
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

/** Create the public bucket if it isn't there yet. Safe to call repeatedly. */
export async function ensureMediaBucket(client = admin()) {
  const { error } = await client.storage.createBucket(MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: MAX_MEDIA_BYTES,
  });
  if (error && !/already exists|resource already exists|duplicate/i.test(error.message)) {
    const { data: existing } = await client.storage.getBucket(MEDIA_BUCKET);
    if (!existing) throw new Error(`Storage bucket error: ${error.message}`);
  }
  return client;
}

/**
 * Upload bytes and return the public URL.
 *
 * `prefix` groups files by origin so the bucket stays readable
 * (e.g. 'posts' for direct uploads, 'drive' for mirrored Drive files).
 * Videos keep a "-video" marker in the name because the publish path sniffs
 * the URL to decide image vs video.
 */
export async function uploadPublicMedia(
  bytes: Uint8Array,
  contentType: string,
  opts: { prefix?: string; isVideo?: boolean } = {},
): Promise<string> {
  if (bytes.length > MAX_MEDIA_BYTES) {
    throw new Error(`That file is ${(bytes.length / 1024 / 1024).toFixed(1)}MB — max 20MB.`);
  }
  const client = await ensureMediaBucket();
  const ext = EXT_BY_TYPE[contentType] || (contentType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
  const isVideo = opts.isVideo ?? contentType.startsWith('video/');
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${opts.prefix || 'posts'}/${stamp}${isVideo ? '-video' : ''}.${ext}`;

  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
