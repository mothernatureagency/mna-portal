import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { isConnected } from '@/lib/google-calendar';
import { listAccounts, listLocations, GbpError } from '@/lib/google-business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Business Profile location mapping. Staff only.
 *
 * GET ?clientId=prime-iv
 *   Returns the connected state for the signed-in staff member, the
 *   saved location mapping for the client (client_kv key gbp_location),
 *   and — when connected — the accounts/locations they can manage so
 *   the UI can offer a picker.
 *
 * POST { clientId, account, location, title }
 *   Saves the mapping. The signed-in user's email is stored with it so
 *   syncs/replies use THEIR OAuth tokens no matter who clicks sync.
 *
 * DELETE ?clientId=prime-iv — removes the mapping.
 */

const KV_KEY = 'gbp_location';

async function staffUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const meta = (user.user_metadata as Record<string, unknown> | null) || {};
  if (((meta.role as string) || 'staff') === 'client') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { email: user.email || '' };
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const { email, error } = await staffUser();
  if (error) return error;

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  let mapping: any = null;
  if (clientId) {
    const { rows } = await query(
      `select value from client_kv where client_id = $1 and key = $2`,
      [clientId, KV_KEY],
    );
    mapping = rows[0]?.value || null;
  }

  const connected = email ? await isConnected(email) : false;
  if (!connected) return NextResponse.json({ connected: false, mapping, accounts: [] });

  try {
    const accounts = await listAccounts(email!);
    const withLocations = await Promise.all(
      accounts.map(async (a) => ({
        ...a,
        locations: await listLocations(email!, a.name).catch(() => []),
      })),
    );
    return NextResponse.json({ connected: true, mapping, accounts: withLocations });
  } catch (e: any) {
    const status = e instanceof GbpError ? e.status : 500;
    return NextResponse.json(
      { connected: true, mapping, accounts: [], error: e?.message || 'Failed to list locations' },
      { status: status === 401 ? 200 : status },
    );
  }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { email, error } = await staffUser();
  if (error) return error;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, account, location, title } = body || {};
  if (!clientId || !account || !location) {
    return NextResponse.json({ error: 'clientId, account, and location required' }, { status: 400 });
  }

  const value = { email, account, location, title: title || null };
  await query(
    `insert into client_kv (client_id, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (client_id, key)
     do update set value = excluded.value, updated_at = now()`,
    [clientId, KV_KEY, JSON.stringify(value)],
  );
  return NextResponse.json({ ok: true, mapping: value });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { error } = await staffUser();
  if (error) return error;

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  await query(`delete from client_kv where client_id = $1 and key = $2`, [clientId, KV_KEY]);
  return NextResponse.json({ ok: true });
}
