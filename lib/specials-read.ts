// Server-only. Turns an uploaded file or a Drive link into a content block
// Claude can read, so a specials flyer / sheet doesn't have to be retyped.
//
// Shared by the plain-text reader (/api/content-calendar/read-specials, which
// fills the month planner's box) and the structured importer
// (/api/specials/import, which creates one row per special).

import type Anthropic from '@anthropic-ai/sdk';
import { extractDriveFileId } from './drive';
import { fetchDriveFileBytes } from './google-drive';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // Messages API per-image cap
const MAX_DOC_BYTES = 30 * 1024 * 1024;    // under the 32MB request cap

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
type ImageMime = typeof IMAGE_TYPES[number];

/**
 * Normalize what the browser / Drive reports into something the API accepts.
 * Drive hands back "image/jpg" and bare octet-stream often enough to matter,
 * so fall back to the extension when the declared type is useless.
 */
export function normalizeMime(mime: string, name: string): string {
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

/** Build the image / document / text block for a file's bytes. Throws with a
 *  message meant for the person who picked the file. */
export function contentBlockFor(mime: string, bytes: Buffer, name: string): Anthropic.ContentBlockParam {
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

/**
 * Pull the file off the request — multipart upload or a Drive link in JSON —
 * and hand back the block plus the display name of what was read.
 */
export async function blockFromRequest(
  req: Request,
  userEmail: string | null,
): Promise<{ block: Anthropic.ContentBlockParam; source: string }> {
  let mime = '';
  let bytes: Buffer;
  let source: string;

  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('file is required');
    bytes = Buffer.from(await file.arrayBuffer());
    mime = normalizeMime(file.type, file.name);
    source = file.name;
  } else {
    const body = await req.json().catch(() => ({} as any));
    const driveUrl = (body?.driveUrl || '').toString().trim();
    if (!driveUrl) throw new Error('Paste a Google Drive link, or upload a file.');
    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) {
      throw new Error("That doesn't look like a Drive file link. Use the file's share link (drive.google.com/file/d/…), not a folder.");
    }
    const file = await fetchDriveFileBytes(userEmail, fileId);
    bytes = file.bytes;
    mime = normalizeMime(file.mimeType, file.name);
    source = file.name;
  }

  if (!bytes || bytes.length === 0) throw new Error('That file is empty.');
  return { block: contentBlockFor(mime, bytes, source || 'file'), source };
}
