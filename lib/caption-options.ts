/**
 * Draft caption options ("OPTION A / OPTION B").
 *
 * The AI write-copy step intentionally produces two caption options for a
 * human to pick from, and stores BOTH in content_calendar.caption. Until
 * someone picks one, the caption is a draft: the publish paths refuse it
 * (see /api/social/run and /api/social/publish), and the UIs render a
 * one-tap picker (components/dashboard/CaptionOptionPicker) instead of the
 * raw text. Pure functions only — safe to import from client components.
 */

// Matches an option header at the start of a line, tolerating the shapes the
// model actually produces: "OPTION A:", "# OPTION A", "**Option A**",
// "Option A (primary — your best version):", etc.
const HEADER_RE =
  /(^|\n)[ \t]*(?:#{1,4}[ \t]*)?\*{0,2}option[ \t]+([a-d])\b(?:[ \t]*\([^)\n]*\))?[ \t:*_\-–—]*/gi;

export function captionHasDraftOptions(caption: string | null | undefined): boolean {
  const c = (caption || '').toString();
  return /(^|\n)[ \t]*(?:#{1,4}[ \t]*)?\*{0,2}option[ \t]+[a-d]\b/i.test(c);
}

export type CaptionOption = { label: string; text: string };

/**
 * Splits a two-option draft caption into its options. Returns null unless at
 * least two non-empty options are found — a caption that merely mentions the
 * word "option" is not a draft.
 */
export function parseCaptionOptions(caption: string | null | undefined): CaptionOption[] | null {
  const c = (caption || '').toString();
  if (!c) return null;
  const matches = Array.from(c.matchAll(HEADER_RE));
  if (matches.length < 2) return null;

  const options = matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? c.length) : c.length;
    const text = c
      .slice(start, end)
      // Drop separator-only lines the model sometimes puts between options.
      .replace(/(^|\n)[ \t]*[-*_]{3,}[ \t]*(?=\n|$)/g, '$1')
      .trim();
    return { label: m[2].toUpperCase(), text };
  }).filter((o) => o.text.length > 0);

  return options.length >= 2 ? options : null;
}
