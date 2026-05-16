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
    throw new Error(`Drive list failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.files || []) as DriveFile[];
}
