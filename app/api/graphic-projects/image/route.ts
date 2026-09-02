import { NextRequest, NextResponse } from 'next/server';
import { uploadPublicMedia } from '@/lib/media-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Optional: generate a photographic layer for an artboard.
 *
 * The artboard itself is HTML — that is what keeps type crisp and brand hexes
 * exact. This is for the thing HTML can't make: a background photograph or
 * texture to sit behind the layout. The generated image lands in the media
 * bucket and comes back as a normal asset URL the designer can reference.
 *
 * Needs OPENAI_API_KEY in Vercel env. Without it this returns 503 and the lab
 * simply carries on with CSS-built backgrounds and uploaded photos — the same
 * way the video lab degrades without HeyGen.
 *
 * POST /api/graphic-projects/image
 * body: { prompt, size?: '1024x1024' | '1024x1536' | '1536x1024', quality?: 'low'|'medium'|'high' }
 * → { url }
 */

const SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set. Add it in Vercel env to generate photo backgrounds. Until then, build backgrounds from CSS or upload a photo.' },
      { status: 503 },
    );
  }

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { prompt, size, quality } = b || {};
  if (!prompt || !String(prompt).trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  const useSize = SIZES.has(size) ? size : '1024x1024';

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        // No text in the image — every word on the piece is real DOM text on
        // the artboard, so the generated layer is imagery only.
        prompt: `${String(prompt).slice(0, 3000)}\n\nPhotographic background layer only. No text, no words, no letters, no logos, no watermarks, no UI. Leave the composition open enough that a headline can sit over it.`,
        size: useSize,
        quality: quality === 'low' || quality === 'high' ? quality : 'medium',
        n: 1,
      }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = data?.error?.message || `Image API error ${r.status}`;
      return NextResponse.json({ error: msg }, { status: r.status === 401 ? 401 : 502 });
    }

    const b64 = data?.data?.[0]?.b64_json;
    const remote = data?.data?.[0]?.url;
    let bytes: Uint8Array;
    if (b64) {
      bytes = new Uint8Array(Buffer.from(b64, 'base64'));
    } else if (remote) {
      const img = await fetch(remote);
      if (!img.ok) return NextResponse.json({ error: 'Could not download the generated image' }, { status: 502 });
      bytes = new Uint8Array(await img.arrayBuffer());
    } else {
      return NextResponse.json({ error: 'The image API returned nothing usable' }, { status: 502 });
    }

    const url = await uploadPublicMedia(bytes, 'image/png', { prefix: 'graphics' });
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Image generation failed' }, { status: 500 });
  }
}
