import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { extractDriveFileId } from '@/lib/drive';
import { fetchDriveFileBytes } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Read a monthly specials sheet/flyer and return it as plain text.
 *
 * The month planner takes the specials as text. Owners get them as a flyer,
 * a PDF, or a Drive doc, so this reads whichever and hands back text the
 * planner can use — staff review and edit it before planning either way.
 *
 * POST multipart/form-data { file }   — upload an image / PDF / CSV / text file
 *   OR POST application/json { driveUrl }  — a Drive share link or bare file ID
 *
 * Returns { specials, source }.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // Messages API per-image cap
const MAX_DOC_BYTES = 30 * 1024 * 1024;    // under the 32MB request cap

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
type ImageMime = typeof IMAGE_TYPES[number];

const PROMPT = `This is a business's monthly specials — the promotions, offers and packages they're running this month.

Transcribe it into plain text a marketer can plan posts from. One special per line, in the order shown. For each, keep the name, the price or discount, any dates or duration, and any conditions (member-only, first-time guests, while supplies last).

Also keep any theme, holiday or awareness-month framing that appears — those drive the content plan.

Rules:
- Transcribe only what is actually there. Do not invent specials, prices or dates.
- If a price or date is unreadable, write "(unclear)" rather than guessing.
- No preamble, no commentary, no markdown fences. Return the plain text list only.
- If the file contains no specials or offers at all, reply with exactly: NO_SPECIALS_FOUND`;

async function staffRole(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';
    return ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  } catch { return ''; }
}

async function userEmail(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || null;
  } catch { return null; }
}

// Normalize what the browser/Drive reports into something the API accepts.
// Drive hands back "image/jpg" and bare octet-stream often enough to matter.
function normalizeMime(mime: string, name: string): string {
  const m = (mime || '').split(';')[0].trim().toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  if (m && m !== 'application/octet-stream') return m;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const byExt: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', md: 'text/plain',
  };
  return byExt[ext] || m || 'application/octet-stream';
}

function contentBlock(mime: string, bytes: Buffer, name: string): Anthropic.ContentBlockParam {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) {
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`That image is ${(bytes.length / 1024 / 1024).toFixed(1)}MB — max 5MB. Screenshot it smaller or save it as a PDF.`);
    }
    return {
      type: 'image',
      source: { type: 'base64', media_type: mime as ImageMime, data: bytes.toString('base64') },
    };
  }
  if (mime === 'application/pdf') {
    if (bytes.length > MAX_DOC_BYTES) throw new Error('That PDF is too large (max 30MB).');
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
    };
  }
  if (mime.startsWith('text/') || mime === 'application/csv') {
    const text = bytes.toString('utf8').slice(0, 60000);
    if (!text.trim()) throw new Error(`"${name}" is empty.`);
    return { type: 'text', text: `FILE: ${name}\n\n${text}` };
  }
  throw new Error(
    `Can't read "${name}" (${mime}). Upload an image, a PDF, a CSV, or a Google Doc/Sheet — ` +
    'or paste an Excel sheet as a Drive link so it can be exported.',
  );
}

export async function POST(req: NextRequest) {
  const role = await staffRole();
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Only staff can read specials' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let mime = '';
  let bytes: Buffer | null = null;
  let source = '';

  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
      bytes = Buffer.from(await file.arrayBuffer());
      mime = normalizeMime(file.type, file.name);
      source = file.name;
    } else {
      const body = await req.json().catch(() => ({}));
      const driveUrl = (body?.driveUrl || '').toString().trim();
      if (!driveUrl) return NextResponse.json({ error: 'Paste a Google Drive link, or upload a file.' }, { status: 400 });
      const fileId = extractDriveFileId(driveUrl);
      if (!fileId) {
        return NextResponse.json({
          error: "That doesn't look like a Drive file link. Use the file's share link (drive.google.com/file/d/…), not a folder.",
        }, { status: 400 });
      }
      const file = await fetchDriveFileBytes(await userEmail(), fileId);
      bytes = file.bytes;
      mime = normalizeMime(file.mimeType, file.name);
      source = file.name;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read that file' }, { status: 400 });
  }

  if (!bytes || bytes.length === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });

  let block: Anthropic.ContentBlockParam;
  try {
    block = contentBlock(mime, bytes, source || 'file');
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unsupported file type' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
    });

    if (res.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'That file could not be read. Try a different export of it.' }, { status: 422 });
    }

    const specials = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();

    if (!specials || specials === 'NO_SPECIALS_FOUND') {
      return NextResponse.json({
        error: `No specials found in "${source}". Check it's the right file, or type them in instead.`,
      }, { status: 422 });
    }

    return NextResponse.json({ specials, source });
  } catch (e: any) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Rate limited — try again in a moment.' }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Could not read the file (${e.status}): ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: e?.message || 'Reading the specials failed' }, { status: 500 });
  }
}
