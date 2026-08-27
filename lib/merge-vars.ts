/**
 * Caption merge-tags. Write a caption once with {{placeholders}} and each
 * location swaps in its own values at post time — Linktree link, location name,
 * booking link, phone, or any custom field. The stored caption keeps the
 * template; only the copy sent to social is localized.
 *
 * Tokens look like {{linktree}} or {{location}} (case-insensitive). Unknown
 * tokens are left untouched so nothing silently disappears.
 */

export type MergeVars = Record<string, string>;

// Common fields the editor offers by default (order matters for the UI).
export const KNOWN_MERGE_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'location', label: 'Location name', placeholder: 'Niceville' },
  { key: 'linktree', label: 'Linktree / link-in-bio', placeholder: 'https://linktr.ee/primeivniceville' },
  { key: 'booking', label: 'Booking link', placeholder: 'https://…' },
  { key: 'phone', label: 'Phone', placeholder: '(850) 555-0100' },
  { key: 'address', label: 'Address', placeholder: '123 Main St, Niceville FL' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
];

// Derive a sensible default location name from a project/client display name,
// e.g. "Prime IV — Niceville" → "Niceville". Used as a fallback when the client
// hasn't set one explicitly.
export function deriveLocation(displayName: string): string {
  const n = (displayName || '').trim();
  if (!n) return '';
  const parts = n.split(/[—–-]/); // em/en/hyphen
  return (parts.length > 1 ? parts[parts.length - 1] : n).trim();
}

// Merge stored values over any fallbacks, lowercasing keys.
export function effectiveVars(stored: unknown, fallback: MergeVars = {}): MergeVars {
  const out: MergeVars = {};
  for (const [k, v] of Object.entries(fallback)) if (v != null && v !== '') out[k.toLowerCase()] = String(v);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (v != null && String(v) !== '') out[k.toLowerCase()] = String(v);
    }
  }
  return out;
}

// Replace {{key}} tokens; leave unknown tokens as-is.
export function applyMergeVars(text: string | null | undefined, vars: MergeVars): string {
  if (!text) return text || '';
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key) => {
    const v = vars[String(key).toLowerCase()];
    return v !== undefined ? v : m;
  });
}

/**
 * Turn a localized caption back into a template.
 *
 * Cross-posting copies a caption verbatim, so any literal location name, link
 * or phone number written for the source location would travel to every other
 * one. Swapping the source's own values back to {{tokens}} first means each
 * target localizes it at publish time with its own values.
 *
 * Longest values are replaced first so "linktr.ee/primeivniceville" wins over
 * a bare "Niceville" sitting inside it. Matching is case-insensitive.
 */
export function tokenizeWithVars(
  text: string | null | undefined,
  vars: MergeVars,
): { text: string; replaced: string[] } {
  let out = text || '';
  const replaced: string[] = [];
  if (!out) return { text: out, replaced };

  const entries = Object.entries(vars)
    .filter(([, v]) => typeof v === 'string' && v.trim().length >= 3)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [key, value] of entries) {
    const needle = value.trim();
    const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (!pattern.test(out)) continue;
    pattern.lastIndex = 0;
    out = out.replace(pattern, `{{${key}}}`);
    replaced.push(key);
  }
  return { text: out, replaced };
}

/** Tokens still unresolved after a merge — these would publish as raw text. */
export function unresolvedTokens(text: string | null | undefined): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || '')) !== null) found.add(m[1].toLowerCase());
  return Array.from(found);
}

/**
 * Best-effort merge fields for a brand-new client, shown pre-filled at
 * onboarding so staff correct rather than compose. Handles are derived from
 * the name; anything wrong is edited in the Content Tracker afterwards.
 */
export function suggestMergeVars(input: {
  name: string;
  location?: string;
  isPrimeIV?: boolean;
  website?: string;
}): MergeVars {
  const displayLocation = (input.location || deriveLocation(input.name) || input.name || '').trim();
  const slug = displayLocation.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const plain = (input.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  const handle = input.isPrimeIV ? `primeiv${slug}` : (plain || slug);
  const out: MergeVars = {
    location: displayLocation,
    linktree: `linktr.ee/${handle}`,
  };
  const site = (input.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  out.website = site || `${handle}.com`;
  return out;
}
