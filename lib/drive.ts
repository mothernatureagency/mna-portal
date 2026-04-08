// Helpers for rendering Google Drive file links as previews.
//
// Accepted input formats:
//   https://drive.google.com/file/d/{ID}/view?usp=sharing
//   https://drive.google.com/file/d/{ID}/view
//   https://drive.google.com/open?id={ID}
//   https://drive.google.com/uc?id={ID}
//   https://drive.google.com/thumbnail?id={ID}&sz=w800
//   Raw file ID (25+ chars of letters/digits/_-)
//
// Returns null if no ID can be extracted.

export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // file/d/{ID}
  const fileDMatch = trimmed.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (fileDMatch) return fileDMatch[1];

  // ?id={ID}
  const idParamMatch = trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (idParamMatch) return idParamMatch[1];

  // Raw ID
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

// Drive's thumbnail endpoint works for images and most video files.
// sz=w800 gives a reasonable card preview. Public sharing must be enabled.
export function driveThumbnailUrl(url: string | null | undefined, width = 800): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
}

// The "open in Drive" URL we link to from the click-through button.
export function driveViewUrl(url: string | null | undefined): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}
