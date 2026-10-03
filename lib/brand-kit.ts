// Brand kits — the type, colour and rules a client's creative has to hold to.
//
// The shape of the problem is franchise-shaped. Every Prime IV location shares
// the same wordmark, the same navy and gold, the same headline face; what
// differs per location is a phone number, a booking URL, maybe a photo of that
// clinic. So a kit can belong to a GROUP as well as to a single client, and a
// client's own kit stores only the fields it actually overrides. Resolving a
// client walks group → client, field by field, so a location inherits the
// franchise and departs from it only where it means to.
//
// Groups are derived from the client id by default (`prime-iv-pinecrest` →
// `prime-iv`), because that is already how the codebase encodes the
// relationship. custom_clients.brand_group overrides that for the ones whose
// ids don't follow the pattern.

export type FontSource = 'google' | 'upload' | 'stack';

export type BrandFont = {
  /** google: a Google Fonts family. upload: a file we host. stack: a plain CSS stack. */
  source: FontSource;
  /** The family name as it must appear in font-family. */
  family: string;
  /** Public URL of the font file, for source='upload'. */
  url?: string;
  /** e.g. "400;700" for Google, or the single weight of an uploaded file. */
  weights?: string;
  /** Fallbacks appended after the family, e.g. "Impact, system-ui, sans-serif". */
  fallback?: string;
};

export type BrandColor = { label: string; hex: string };
export type BrandLogo = { label: string; url: string };

export type BrandKitFields = {
  headlineFont?: BrandFont;
  bodyFont?: BrandFont;
  palette?: BrandColor[];
  logos?: BrandLogo[];
  /** Hard do's and don'ts. The part that separates on-brand from on-palette. */
  rules?: string;
  /** How copy on the artwork should sound. */
  voice?: string;
  /** Photography and illustration direction. */
  imagery?: string;
};

export type BrandKit = {
  id: string;
  scope: 'group' | 'client';
  owner_key: string;
  name: string | null;
  /** Client kits only: which group this one inherits from. */
  group_key?: string | null;
  fields: BrandKitFields;
  updated_at: string;
};

/** A resolved kit, plus where each part of it came from. */
export type ResolvedKit = {
  fields: BrandKitFields;
  groupKey: string | null;
  /** Which scope supplied each field — for showing "inherited" in the UI. */
  sources: Partial<Record<keyof BrandKitFields, 'group' | 'client'>>;
};

/**
 * The group a client id implies. Prime IV locations are all `prime-iv-<place>`
 * and the base client is `prime-iv` itself, so both land on the same group.
 */
export function derivedGroupKey(clientId: string): string | null {
  if (!clientId) return null;
  if (clientId === 'prime-iv' || clientId.startsWith('prime-iv-')) return 'prime-iv';
  return null;
}

const FIELD_KEYS: (keyof BrandKitFields)[] = [
  'headlineFont', 'bodyFont', 'palette', 'logos', 'rules', 'voice', 'imagery',
];

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

/**
 * Merge a group kit and a client kit field by field. The client wins wherever
 * it has actually set something; everything it leaves blank comes from the
 * group. Whole-kit replacement would force a location to restate the
 * franchise's typography just to change its phone number.
 */
export function mergeKits(group: BrandKitFields | null, client: BrandKitFields | null): ResolvedKit['fields'] & { sources: ResolvedKit['sources'] } {
  const out: BrandKitFields = {};
  const sources: ResolvedKit['sources'] = {};
  for (const k of FIELD_KEYS) {
    const c = client?.[k];
    const g = group?.[k];
    if (!isEmpty(c)) { (out as any)[k] = c; sources[k] = 'client'; }
    else if (!isEmpty(g)) { (out as any)[k] = g; sources[k] = 'group'; }
  }
  return { ...out, sources };
}

/** The font-family value to write into CSS, fallbacks included. */
export function fontFamilyCss(f: BrandFont | undefined): string | null {
  if (!f?.family) return null;
  const fallback = f.fallback?.trim() || 'system-ui, sans-serif';
  return `'${f.family.replace(/'/g, '')}', ${fallback}`;
}

/**
 * How the artboard is to load this face. Google families come in through the
 * usual stylesheet; uploaded files get an @font-face pointing at our bucket
 * (Supabase serves public objects with permissive CORS, which is what both the
 * browser and the rasteriser need).
 */
export function fontLoaderCss(f: BrandFont | undefined): string | null {
  if (!f?.family) return null;
  if (f.source === 'google') {
    const fam = f.family.trim().replace(/\s+/g, '+');
    const weights = f.weights?.trim() || '400;700';
    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fam}:wght@${weights}&display=swap">`;
  }
  if (f.source === 'upload' && f.url) {
    const format = /\.otf($|\?)/i.test(f.url) ? 'opentype'
      : /\.ttf($|\?)/i.test(f.url) ? 'truetype'
      : /\.woff($|\?)/i.test(f.url) ? 'woff' : 'woff2';
    return `@font-face { font-family: '${f.family.replace(/'/g, '')}'; src: url('${f.url}') format('${format}'); font-weight: ${f.weights || '400'}; font-display: swap; }`;
  }
  return null;
}
