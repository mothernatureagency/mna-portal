import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * HeyGen AI avatar video generation.
 *
 * GET /api/video-projects/avatar?mode=avatars  → list available avatars
 * GET /api/video-projects/avatar?mode=voices   → list available voices
 * GET /api/video-projects/avatar?mode=status&videoId=xxx → poll render status
 *
 * POST /api/video-projects/avatar/generate
 *   body: { script, avatarId, voiceId, backgroundUrl?, backgroundType?: 'image' | 'video' | 'color' }
 *   Returns: { videoId }  (poll status until video_url populates)
 *
 * Requires HEYGEN_API_KEY in Vercel env.
 *
 * Pricing note: HeyGen charges ~1 credit per 1 min of video. Starter is
 * $29/mo for 30 credits. Pay-as-you-go API is also available. See
 * https://docs.heygen.com/
 */

const HEYGEN_KEY = process.env.HEYGEN_API_KEY;

async function heygen(path: string, init?: RequestInit) {
  if (!HEYGEN_KEY) return { ok: false, status: 503, error: 'HEYGEN_API_KEY not set' };
  try {
    const r = await fetch(`https://api.heygen.com${path}`, {
      ...init,
      headers: {
        'X-Api-Key': HEYGEN_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    const body = await r.text();
    let data: any = null;
    try { data = JSON.parse(body); } catch { data = { raw: body }; }
    if (!r.ok) return { ok: false, status: r.status, error: data?.message || data?.error || body.slice(0, 300), data };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, status: 500, error: e?.message || 'network error' };
  }
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'avatars';

  if (!HEYGEN_KEY) {
    return NextResponse.json(
      { error: 'HEYGEN_API_KEY not set. Add it in Vercel env vars to enable AI avatar videos.' },
      { status: 503 },
    );
  }

  if (mode === 'avatars') {
    const r = await heygen('/v2/avatars');
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const avatars = (r.data?.data?.avatars || []).map((a: any) => ({
      avatar_id: a.avatar_id,
      avatar_name: a.avatar_name,
      gender: a.gender,
      preview_image_url: a.preview_image_url,
      preview_video_url: a.preview_video_url,
    }));
    const talkingPhotos = (r.data?.data?.talking_photos || []).map((t: any) => ({
      avatar_id: t.talking_photo_id,
      avatar_name: t.talking_photo_name,
      preview_image_url: t.preview_image_url,
      talking_photo: true,
    }));
    return NextResponse.json({ avatars: [...avatars, ...talkingPhotos] });
  }

  if (mode === 'voices') {
    const r = await heygen('/v2/voices');
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const voices = (r.data?.data?.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      preview_audio: v.preview_audio,
    }));
    return NextResponse.json({ voices });
  }

  if (mode === 'status') {
    const videoId = req.nextUrl.searchParams.get('videoId');
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });
    const r = await heygen(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const d = r.data?.data || {};
    return NextResponse.json({
      status: d.status,               // queued | processing | completed | failed
      video_url: d.video_url || null, // present when completed
      duration: d.duration,
      thumbnail_url: d.thumbnail_url || null,
      error: d.error || null,
    });
  }

  return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!HEYGEN_KEY) {
    return NextResponse.json(
      { error: 'HEYGEN_API_KEY not set. Add it in Vercel env vars to enable AI avatar videos.' },
      { status: 503 },
    );
  }
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { script, avatarId, voiceId, backgroundUrl, backgroundType, talkingPhoto } = b || {};
  if (!script || !avatarId || !voiceId) {
    return NextResponse.json({ error: 'script, avatarId, voiceId required' }, { status: 400 });
  }

  // Build HeyGen video_inputs payload
  let character: any;
  if (talkingPhoto) {
    character = { type: 'talking_photo', talking_photo_id: avatarId };
  } else {
    character = { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' };
  }

  // Background handling:
  //   - image/video URL provided → use it as the background
  //   - nothing provided → default to a clean color
  let background: any = { type: 'color', value: '#ffffff' };
  if (backgroundUrl) {
    const t = backgroundType === 'video' ? 'video' : 'image';
    background = t === 'video'
      ? { type: 'video', url: backgroundUrl, fit: 'cover' }
      : { type: 'image', url: backgroundUrl, fit: 'cover' };
  }

  const payload = {
    video_inputs: [{
      character,
      voice: { type: 'text', input_text: String(script).slice(0, 6000), voice_id: voiceId },
      background,
    }],
    dimension: { width: 1080, height: 1920 }, // vertical for TikTok/Reels/Shorts
  };

  const r = await heygen('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!r.ok) return NextResponse.json({ error: r.error, details: r.data }, { status: r.status });
  const videoId = r.data?.data?.video_id;
  if (!videoId) return NextResponse.json({ error: 'HeyGen did not return a video_id', raw: r.data }, { status: 500 });
  return NextResponse.json({ videoId });
}
