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

// ── Preview helpers ─────────────────────────────────────────────────
// Photos on a post come from two places: Google Drive links pasted by staff,
// and files uploaded straight to Supabase storage (plain public https URLs).
// Everything below handles both so staff and client views preview identically.

/** Preview <img>/<video> src for a stored photo URL, or null if unrenderable. */
export function previewSrc(url: string | null | undefined, width = 600): string | null {
  const drive = driveThumbnailUrl(url, width);
  if (drive) return drive;
  const t = (url || '').trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

/** Link that opens the full photo — Drive's view page, else the raw URL. */
export function photoOpenUrl(url: string | null | undefined): string | null {
  const t = (url || '').trim();
  return driveViewUrl(url) || (/^https?:\/\//i.test(t) ? t : null);
}

/**
 * Every photo/video on a post — the multi-photo list when present, else the
 * legacy single-photo column. First entry is the cover.
 */
export function photosOf(
  item: { photo_urls?: string[] | null; photo_drive_url?: string | null } | null | undefined,
): string[] {
  if (!item) return [];
  if (Array.isArray(item.photo_urls) && item.photo_urls.length > 0) return item.photo_urls.filter(Boolean);
  return item.photo_drive_url ? [item.photo_drive_url] : [];
}

/** True for sources that should render in a <video> rather than an <img>. */
export function isVideoUrl(src: string | null | undefined): boolean {
  const t = (src || '').trim();
  if (!t) return false;
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(t) || /-video\./i.test(t);
}
