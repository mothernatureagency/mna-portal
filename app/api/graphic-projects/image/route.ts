import { NextRequest, NextResponse } from 'next/server';
import { uploadPublicMedia } from '@/lib/media-store';
import { buildImagePrompt } from '@/lib/graphic-imagery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Generate the photographic layer of an artboard.
 *
 * The artboard is HTML, which is what keeps type crisp and brand hexes exact.
 * This is the thing HTML cannot make: a real-looking face. For a wellness
 * brand that is not decoration - the face is the piece, and the layout is
 * what sits over it.
 *
 * Generation returns more than one option because picking beats re-rolling:
 * two frames of the same brief differ mostly in the expression, and the
 * expression is the whole job.
 *
 * Needs OPENAI_API_KEY. Without it this returns 503 and the lab falls back to
 * uploaded photos and type-led design.
 *
 * POST /api/graphic-projects/image
 * body: { subject, styleId?, copySpace?, brandNote?, aspect?, count?, quality? }
 * -> { images: [{ url }], prompt }
 */

const SIZE_BY_ASPECT: Record<string, string> = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
};

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          'OPENAI_API_KEY is not set, so photographic imagery cannot be generated. Add it in the Vercel environment variables to turn this on. Until then, upload a real photo or let the designer build the piece from type.',
      },
      { status: 503 },
    );
  }

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { subject, styleId, copySpace, brandNote, aspect, count, quality } = b || {};
  if (!subject || !String(subject).trim()) {
    return NextResponse.json({ error: 'Say what the photo is of' }, { status: 400 });
  }

  const size = SIZE_BY_ASPECT[aspect] || SIZE_BY_ASPECT.square;
  // Two by default: enough to choose an expression from without doubling the
  // wait or the bill on every click.
  const n = Math.min(4, Math.max(1, Number(count) || 2));
  const useQuality = quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'high';

  const prompt = buildImagePrompt({
    subject: String(subject),
    styleId,
    brandNote: typeof brandNote === 'string' ? brandNote : undefined,
    copySpace,
  });

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: prompt.slice(0, 30000), size, quality: useQuality, n }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = data?.error?.message || `Image API error ${r.status}`;
      return NextResponse.json({ error: msg }, { status: r.status === 401 ? 401 : 502 });
    }

    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    if (!items.length) return NextResponse.json({ error: 'The image API returned nothing usable' }, { status: 502 });

    const images: { url: string }[] = [];
    const failures: string[] = [];
    for (const item of items) {
      try {
        let bytes: Uint8Array;
        if (item.b64_json) {
          bytes = new Uint8Array(Buffer.from(item.b64_json, 'base64'));
        } else if (item.url) {
          const img = await fetch(item.url);
          if (!img.ok) { failures.push(`download failed (${img.status})`); continue; }
          bytes = new Uint8Array(await img.arrayBuffer());
        } else {
          continue;
        }
        images.push({ url: await uploadPublicMedia(bytes, 'image/png', { prefix: 'graphics' }) });
      } catch (e: any) {
        failures.push(e?.message || 'could not be saved');
      }
    }

    if (!images.length) {
      return NextResponse.json(
        { error: `The images were generated but none could be saved: ${failures.join('; ')}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ images, prompt, ...(failures.length ? { warning: `${failures.length} of ${items.length} could not be saved` } : {}) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Image generation failed' }, { status: 500 });
  }
}
