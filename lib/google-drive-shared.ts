// Client-safe Google Drive utilities. Anything that touches the DB / OAuth
// tokens lives in lib/google-drive.ts (server only). Splitting these prevents
// `pg` from being pulled into the client bundle through the import graph.

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
  const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (folderMatch) return folderMatch[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}
