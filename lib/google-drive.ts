// Server-only Google Drive helpers. Uses the per-user OAuth token stored
// by lib/google-calendar.ts. Importing this file from a client component
// will pull pg/dns/net into the client bundle and break the build — import
// from './google-drive-shared' for pure utilities + the DriveFile type.

import { getAccessToken } from './google-calendar';
import type { DriveFile } from './google-drive-shared';

export type { DriveFile } from './google-drive-shared';
export { extractFolderId } from './google-drive-shared';

/** List images / videos / docs in a Drive folder, newest first. */
export async function listFolderFiles(userEmail: string, folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken(userEmail);
  if (!token) throw new Error('Google not connected — reconnect in /schedule');

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,thumbnailLink,webViewLink,iconLink,modifiedTime)',
    pageSize: '200',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // The Google Cloud project has the OAuth app but the Drive API itself was
    // never switched on — surface the exact console link instead of raw JSON.
    if (res.status === 403 && /has not been used in project|is disabled|accessNotConfigured/i.test(txt)) {
      const project = txt.match(/project\s+(\d+)/)?.[1];
      throw new Error(
        `The Google Drive API is turned off in your Google Cloud project${project ? ` (${project})` : ''}. ` +
        `One-time fix: open https://console.developers.google.com/apis/api/drive.googleapis.com/overview${project ? `?project=${project}` : ''} ` +
        `signed in as the Google account that owns the app, click "Enable", wait ~2 minutes, then try again.`,
      );
    }
    if (res.status === 403 && /insufficient|scope/i.test(txt)) {
      throw new Error('Google is connected without Drive permission — go to /schedule, disconnect, and reconnect Google so the Drive access prompt appears.');
    }
    throw new Error(`Drive list failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.files || []) as DriveFile[];
}

/**
 * Download a single Drive file's bytes so it can be handed to Claude.
 *
 * Google-native files (Docs/Sheets/Slides) have no binary to download, so they
 * are exported to text/CSV instead. Everything else comes back as-is.
 *
 * Falls back to Drive's public download endpoint when the user hasn't
 * connected Google — enough for a flyer that's already shared by link.
 */
export async function fetchDriveFileBytes(
  userEmail: string | null | undefined,
  fileId: string,
): Promise<{ name: string; mimeType: string; bytes: Buffer }> {
  const token = userEmail ? await getAccessToken(userEmail).catch(() => null) : null;

  if (!token) {
    // No Google connection — try the public link. Drive serves an HTML consent
    // page instead of the file when it isn't shared, so reject that explicitly
    // rather than handing Claude a login page to read.
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MNA-Portal)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Could not download that Drive file (${res.status}). Connect Google in /schedule, or share the file with "anyone with the link".`);
    const mimeType = res.headers.get('content-type') || 'application/octet-stream';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (/text\/html/i.test(mimeType)) {
      throw new Error('That Drive file is not shared publicly. Connect Google in /schedule, or set the file to "anyone with the link".');
    }
    return { name: fileId, mimeType, bytes };
  }

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metaRes.ok) {
    const txt = await metaRes.text().catch(() => '');
    throw new Error(`Drive file lookup failed (${metaRes.status}): ${txt.slice(0, 200)}`);
  }
  const meta = await metaRes.json() as { name: string; mimeType: string };

  // Docs/Sheets/Slides can't be downloaded raw — export them to text.
  const EXPORT_AS: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
  };
  const exportMime = EXPORT_AS[meta.mimeType];
  const url = exportMime
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) {
    const txt = await fileRes.text().catch(() => '');
    throw new Error(`Drive download failed (${fileRes.status}): ${txt.slice(0, 200)}`);
  }
  return {
    name: meta.name,
    mimeType: exportMime || meta.mimeType,
    bytes: Buffer.from(await fileRes.arrayBuffer()),
  };
}
