import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { uploadPublicMedia } from '@/lib/media-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Upload a font file for a brand kit.
 *
 * Browsers hand back an empty or unreliable File.type for font files, so the
 * content type comes from the extension rather than what the browser claims.
 * The file lands in the public media bucket, which serves it with the CORS
 * headers that @font-face and the artboard rasteriser both need.
 *
 * POST multipart/form-data: { file }
 * -> { url, family }   family is a guess from the filename; the UI lets it be edited.
 */

const MAX_BYTES = 5 * 1024 * 1024;

const TYPE_BY_EXT: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can upload fonts' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const contentType = TYPE_BY_EXT[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Fonts must be .woff2, .woff, .ttf or .otf' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `That font is ${(file.size / 1024 / 1024).toFixed(1)}MB - max 5MB.` }, { status: 413 });
  }

  // "AcmeGrotesk-Bold.woff2" -> "AcmeGrotesk Bold"; the UI lets this be corrected.
  const family = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadPublicMedia(bytes, contentType, { prefix: 'fonts', isVideo: false });
    return NextResponse.json({ url, family });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Font upload failed' }, { status: 500 });
  }
}
