import { query } from '@/lib/db';
import { decryptToken, encryptToken } from './crypto';

/**
 * Tenant registry for the AI CRM layer. One row per connected Revive/GHL
 * subaccount (location). Every AI operation is scoped to exactly one
 * location — context, history, and knowledge base never cross locations.
 */

export type GhlLocation = {
  id: string;
  client_id: string | null;
  ghl_location_id: string;
  name: string;
  token_encrypted: string | null;
  business_phone: string | null;
  timezone: string | null;
  business_hours: string | null;
  address: string | null;
  website: string | null;
  booking_url: string | null;
  services: Array<{ name: string; description?: string; price?: string }>;
  pricing: string | null;
  offers: string | null;
  faqs: string | null;
  membership_info: string | null;
  approved_language: string | null;
  restricted_language: string | null;
  tone_instructions: string | null;
  restricted_claims: string | null;
  escalation_instructions: string | null;
  escalation_keywords: string | null;
  custom_prompt: string | null;
  auto_respond_enabled: boolean;
  confidence_threshold: number;
  response_delay_seconds: number;
  ai_paused: boolean;
  polling_enabled: boolean;
  webhook_secret: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_auth_email: string | null;
  review_auto_enabled: boolean;
  review_auto_3_star: boolean;
  created_at: string;
  updated_at: string;
};

// Fields the browser is allowed to edit via the settings UI.
const EDITABLE_FIELDS = [
  'client_id', 'ghl_location_id', 'name', 'business_phone', 'timezone',
  'business_hours', 'address', 'website', 'booking_url', 'services', 'pricing',
  'offers', 'faqs', 'membership_info', 'approved_language', 'restricted_language',
  'tone_instructions', 'restricted_claims', 'escalation_instructions',
  'escalation_keywords', 'custom_prompt', 'auto_respond_enabled',
  'confidence_threshold', 'response_delay_seconds', 'ai_paused',
  'polling_enabled', 'webhook_secret', 'gbp_account_id', 'gbp_location_id',
  'gbp_auth_email', 'review_auto_enabled', 'review_auto_3_star',
] as const;

/** Strip secrets before anything leaves the server. */
export function sanitizeLocation(loc: GhlLocation) {
  const { token_encrypted, webhook_secret, ...rest } = loc;
  return {
    ...rest,
    has_token: !!token_encrypted,
    has_webhook_secret: !!webhook_secret,
    confidence_threshold: Number(loc.confidence_threshold),
  };
}

export async function listLocations(): Promise<GhlLocation[]> {
  const { rows } = await query<GhlLocation>(
    `select * from ghl_locations order by name asc`,
  );
  return rows;
}

export async function getLocationByGhlId(ghlLocationId: string): Promise<GhlLocation | null> {
  const { rows } = await query<GhlLocation>(
    `select * from ghl_locations where ghl_location_id = $1`,
    [ghlLocationId],
  );
  return rows[0] || null;
}

export async function getLocationById(id: string): Promise<GhlLocation | null> {
  const { rows } = await query<GhlLocation>(
    `select * from ghl_locations where id = $1`,
    [id],
  );
  return rows[0] || null;
}

/** Decrypted API token for server-side GHL calls. Never send to client. */
export function locationToken(loc: GhlLocation): string | null {
  if (!loc.token_encrypted) return null;
  try {
    return decryptToken(loc.token_encrypted);
  } catch {
    return null;
  }
}

/**
 * Create or update a location from a UI payload. `token` (plaintext, write-only)
 * is encrypted here and stored; it's never echoed back.
 */
export async function upsertLocation(payload: Record<string, unknown>, id?: string | null) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of EDITABLE_FIELDS) {
    if (!(key in payload)) continue;
    let v = payload[key];
    if (key === 'services') v = JSON.stringify(Array.isArray(v) ? v : []);
    fields.push(key);
    values.push(v === '' ? null : v);
  }
  if (typeof payload.token === 'string' && payload.token.trim()) {
    fields.push('token_encrypted');
    values.push(encryptToken(payload.token.trim()));
  }
  if (fields.length === 0 && !id) throw new Error('No fields provided');

  if (id) {
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await query<GhlLocation>(
      `update ghl_locations set ${sets}${sets ? ',' : ''} updated_at = now()
        where id = $1 returning *`,
      [id, ...values],
    );
    if (!rows[0]) throw new Error('Location not found');
    return rows[0];
  }

  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await query<GhlLocation>(
    `insert into ghl_locations (${cols}) values (${placeholders}) returning *`,
    values,
  );
  return rows[0];
}

export async function deleteLocation(id: string) {
  await query(`delete from ghl_locations where id = $1`, [id]);
}
