import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { fetchGa4Monthly, fetchGscMonthly, reportingAccount } from '@/lib/google-reporting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/google/insights?clientId=prime-iv&ym=2026-08
 *
 * GA4 and Search Console numbers for one client-month, for the portal's
 * Google Performance card. Returns nulls rather than errors when a client
 * has no property configured or Google isn't connected — the card falls
 * back to staff-entered values in that case.
 *
 * Which property/site to query is stored per client in client_kv:
 *   ga4_property_id  → "properties/123456789" or "123456789"
 *   gsc_site_url     → "https://example.com/" or "sc-domain:example.com"
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const userClientId = (meta.client_id as string) || '';

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  const ym = req.nextUrl.searchParams.get('ym') || '';
  if (!clientId || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: 'clientId and ym=YYYY-MM required' }, { status: 400 });
  }
  if (role === 'client' && clientId !== userClientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await query<{ key: string; value: unknown }>(
    `select key, value from client_kv where client_id = $1 and key = any($2::text[])`,
    [clientId, ['ga4_property_id', 'gsc_site_url']],
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const propertyId = typeof byKey.get('ga4_property_id') === 'string' ? (byKey.get('ga4_property_id') as string) : '';
  const siteUrl = typeof byKey.get('gsc_site_url') === 'string' ? (byKey.get('gsc_site_url') as string) : '';

  if (!propertyId && !siteUrl) {
    return NextResponse.json({ ga4: null, gsc: null, configured: false, connected: null });
  }

  const account = await reportingAccount(user.email || undefined);
  if (!account) {
    return NextResponse.json({ ga4: null, gsc: null, configured: true, connected: false });
  }

  const [ga4, gsc] = await Promise.all([
    propertyId ? fetchGa4Monthly(account, propertyId, ym).catch(() => null) : Promise.resolve(null),
    siteUrl ? fetchGscMonthly(account, siteUrl, ym).catch(() => null) : Promise.resolve(null),
  ]);

  return NextResponse.json({ ga4, gsc, configured: true, connected: true });
}
