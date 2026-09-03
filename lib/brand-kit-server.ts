// Server-side brand kit resolution. Kept out of the route file because a
// Next.js route module may only export HTTP handlers and its config.

import { query } from '@/lib/db';
import { derivedGroupKey, mergeKits, type BrandKit, type ResolvedKit } from '@/lib/brand-kit';

const NO_GROUP = '__no_group__';

/**
 * The kit a client actually designs to: its group's kit with its own overrides
 * layered on, field by field.
 *
 * The group is whichever the client's own kit names, else the one assigned on
 * the client record, else the one its id implies (`prime-iv-pinecrest` ->
 * `prime-iv`). Storing the assignment on the kit rather than only on
 * custom_clients means it works for the built-in clients too, which have no
 * custom_clients row.
 *
 * Returns empty fields when no kit exists, which is the pre-brand-kit
 * behaviour - callers fall back to the palette in lib/clients.ts.
 */
export async function resolveBrandKit(clientId: string): Promise<ResolvedKit & { groupKit: BrandKit | null; clientKit: BrandKit | null }> {
  let clientKit: BrandKit | null = null;
  try {
    const { rows } = await query<BrandKit>(
      `select * from brand_kits where scope = 'client' and owner_key = $1 limit 1`,
      [clientId],
    );
    clientKit = rows[0] || null;
  } catch {
    // No brand_kits table yet on a cold database - having no kit is a valid
    // state, so fall through rather than failing the design request.
    return { fields: {}, groupKey: null, sources: {}, groupKit: null, clientKit: null };
  }

  const groupKey = await groupKeyFor(clientId, clientKit);

  let groupKit: BrandKit | null = null;
  if (groupKey) {
    try {
      const { rows } = await query<BrandKit>(
        `select * from brand_kits where scope = 'group' and owner_key = $1 limit 1`,
        [groupKey],
      );
      groupKit = rows[0] || null;
    } catch { /* same as above */ }
  }

  const { sources, ...fields } = mergeKits(groupKit?.fields || null, clientKit?.fields || null);
  return { fields, groupKey, sources, groupKit, clientKit };
}

/**
 * The group a client belongs to. Explicit assignment wins over the one its id
 * implies, so a client whose id doesn't follow the pattern can still join.
 */
export async function groupKeyFor(clientId: string, knownKit?: BrandKit | null): Promise<string | null> {
  let kit = knownKit;
  if (kit === undefined) {
    try {
      const { rows } = await query<BrandKit>(
        `select * from brand_kits where scope = 'client' and owner_key = $1 limit 1`,
        [clientId],
      );
      kit = rows[0] || null;
    } catch { kit = null; }
  }
  // An explicit "no group" is stored as the sentinel so it can be told apart
  // from never having chosen.
  if (kit?.group_key === NO_GROUP) return null;
  if (kit?.group_key) return kit.group_key;

  try {
    const { rows } = await query<{ brand_group: string | null }>(
      `select brand_group from custom_clients where id = $1 limit 1`,
      [clientId],
    );
    if (rows[0]?.brand_group) return rows[0].brand_group;
  } catch { /* built-in clients aren't in custom_clients - fall through */ }

  return derivedGroupKey(clientId);
}

export { NO_GROUP };
