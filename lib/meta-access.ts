import { query } from './db';
import { createClient } from './supabase/server';
import { clients as staticClients } from './clients';

/**
 * Authorization for the Meta Graph proxy routes.
 *
 * These routes take an `adAccountId` query param and forward it to Meta with
 * the agency's access token, so without a check any signed-in client could
 * read another client's ad account by editing the URL. The client portal
 * calls them (the KPI card and the Meta Ads dashboard), so the param has to
 * be clamped to what the caller is actually entitled to see.
 *
 * Staff and owners keep full access. Client-role users are limited to the ad
 * accounts configured for the clients they're assigned to.
 */

export type MetaAccess =
  | { ok: true; adAccountId: string | undefined }
  | { ok: false; status: number; error: string };

/** Meta's Graph API wants the `act_` prefix; we store IDs both ways. */
export function normalizeAdAccountId(raw: string | null | undefined): string | undefined {
  const v = (raw || '').trim();
  if (!v) return undefined;
  return v.startsWith('act_') ? v : `act_${v}`;
}

async function allowedAccountsFor(clientIds: string[]): Promise<Set<string>> {
  const allowed = new Set<string>();

  for (const id of clientIds) {
    const stat = staticClients.find((c) => c.id === id);
    const fromStatic = normalizeAdAccountId(stat?.metaAds?.adAccountId);
    if (fromStatic) allowed.add(fromStatic);
  }

  if (clientIds.length > 0) {
    try {
      const { rows } = await query<{ value: any }>(
        `select value from client_kv where key = 'meta_ads' and client_id = any($1::text[])`,
        [clientIds],
      );
      for (const r of rows) {
        const fromKv = normalizeAdAccountId(r.value?.adAccountId);
        if (fromKv) allowed.add(fromKv);
      }
    } catch {
      /* no DB — fall through to whatever the static config gave us */
    }
  }

  return allowed;
}

/**
 * Decide which ad account this request may read. Returns the account to use
 * (undefined means "the server default"), or a refusal to return verbatim.
 */
export async function resolveAdAccountAccess(requested: string | null): Promise<MetaAccess> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Not authenticated' };

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';

  // Staff and owners see every account, as they do in the admin dashboard.
  if (role !== 'client') {
    return { ok: true, adAccountId: normalizeAdAccountId(requested) };
  }

  const clientIds = [
    ...String(meta.client_ids || '').split(',').map((s) => s.trim()).filter(Boolean),
    ...(meta.client_id ? [String(meta.client_id)] : []),
  ];
  if (clientIds.length === 0) {
    return { ok: false, status: 403, error: 'No ad account is configured for your account' };
  }

  const allowed = await allowedAccountsFor(clientIds);
  if (allowed.size === 0) {
    return { ok: false, status: 403, error: 'No ad account is configured for your account' };
  }

  const want = normalizeAdAccountId(requested);
  if (!want) return { ok: true, adAccountId: Array.from(allowed)[0] };
  if (!allowed.has(want)) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true, adAccountId: want };
}
