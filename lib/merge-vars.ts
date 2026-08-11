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
