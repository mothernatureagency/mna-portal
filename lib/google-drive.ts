// Google Drive helpers built on top of the existing google_tokens OAuth flow
// in lib/google-calendar.ts. We piggyback on the per-user access token rather
// than maintaining a separate Drive connection.

import { getAccessToken } from './google-calendar';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
};

/** Extract a folder ID from a Drive folder URL or accept the raw ID. */
export function extractFolderId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // https://drive.google.com/drive/folders/{ID}?usp=...
  const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (folderMatch) return folderMatch[1];
  // Raw ID
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

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
