import { NextRequest, NextResponse } from 'next/server';
import { previewSrc } from '@/lib/drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Same-origin image relay for the artboard.
 *
 * The artboard is rasterised in the browser, which means every image it
 * references has to be readable by the page — a cross-origin photo without
 * CORS headers taints the canvas and the export dies. Pulling the bytes
 * through here makes every asset same-origin, and Drive share links get
 * normalised to their preview endpoint on the way through.
 *
 * GET /api/graphic-projects/proxy-image?url=<encoded>
 */

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let target: URL;
  try { target = new URL(previewSrc(raw, 1600) || raw); }
  catch { return NextResponse.json({ error: 'Not a valid URL' }, { status: 400 }); }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: 'Only http(s) URLs can be used as assets' }, { status: 400 });
  }
  // No fetching our way around the network boundary.
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/i.test(target.hostname)) {
    return NextResponse.json({ error: 'That host is not reachable from here' }, { status: 400 });
  }

  try {
    const r = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: `Source returned ${r.status}` }, { status: 502 });

    const type = r.headers.get('content-type') || 'application/octet-stream';
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: `That link is ${type.split(';')[0]}, not an image` }, { status: 415 });
    }
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'That image is too large to use on an artboard' }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not fetch that image' }, { status: 502 });
  }
}
