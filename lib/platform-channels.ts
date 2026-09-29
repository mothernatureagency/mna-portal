/**
 * Post platform labels ↔ social channels.
 *
 * A content_calendar row stores one free-text `platform` label ("Instagram",
 * "Meta", "Instagram + Facebook", …). These pure helpers translate that label
 * to the set of Post-for-Me channels it publishes to, and back. The publish
 * paths (lib/postforme.ts platformsFor) and the tracker's channel toggles both
 * resolve through here, so what the UI shows is exactly what will post.
 * Client-safe: no env access, importable from client components.
 */

// Keyword → channel. Order is also the display order for combined labels.
const KEYWORDS: Array<[string, string]> = [
  ['instagram', 'instagram'],
  ['facebook', 'facebook'],
  ['tiktok', 'tiktok'],
  ['youtube', 'youtube'],
  ['linkedin', 'linkedin'],
  ['pinterest', 'pinterest'],
  ['threads', 'threads'],
  ['bluesky', 'bluesky'],
  ['twitter', 'x'],
];

export const CHANNEL_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  x: 'X/Twitter',
};

/** The channels the tracker offers as toggles (matches the connect buttons). */
export const TOGGLEABLE_CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const;

/**
 * A platform label → every channel it names. "Meta" is the legacy shorthand
 * for Facebook + Instagram; any other label contributes one channel per
 * platform keyword it contains, so "Instagram + Facebook" → both.
 */
export function channelsForLabel(label: string | null | undefined): string[] {
  const p = (label || '').toLowerCase();
  if (p.trim() === 'meta') return ['facebook', 'instagram'];
  const out: string[] = [];
  for (const [kw, channel] of KEYWORDS) {
    if (p.includes(kw) && !out.includes(channel)) out.push(channel);
  }
  if (out.length === 0 && p.trim() === 'x') out.push('x');
  return out;
}

/** A set of channels → the canonical label to store ("Instagram + Facebook"). */
export function labelForChannels(channels: string[]): string {
  const order = KEYWORDS.map(([, c]) => c).concat('x');
  return order
    .filter((c, i) => order.indexOf(c) === i && channels.includes(c))
    .map((c) => CHANNEL_NAMES[c] || c)
    .join(' + ');
}
