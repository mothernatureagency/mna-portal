import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/client-kv?clientId=prime-iv&key=lead_source_split
 * Returns { value, updatedAt } or { value: null } if not set.
 *
 * Open to any authenticated user. Client-role users can only read their
 * own client_id (enforced below).
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
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!clientId || !key) return NextResponse.json({ error: 'clientId and key required' }, { status: 400 });

  if (role === 'client' && clientId !== userClientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await query<{ value: unknown; updated_at: string }>(
    `select value, updated_at from client_kv where client_id = $1 and key = $2`,
    [clientId, key]
  );
  if (rows.length === 0) return NextResponse.json({ value: null });
  return NextResponse.json({ value: rows[0].value, updatedAt: rows[0].updated_at });
}

/**
 * PUT /api/client-kv
 * body: { clientId, key, value }
 * Staff only. Clients cannot write to their own KV store.
 */
export async function PUT(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') {
    return NextResponse.json({ error: 'Only staff can write client settings' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, key, value } = body || {};
  if (!clientId || !key || value === undefined) {
    return NextResponse.json({ error: 'clientId, key, and value required' }, { status: 400 });
  }

  const { rows } = await query(
    `insert into client_kv (client_id, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (client_id, key)
     do update set value = excluded.value, updated_at = now()
     returning value, updated_at`,
    [clientId, key, JSON.stringify(value)]
  );
  return NextResponse.json({ value: rows[0].value, updatedAt: rows[0].updated_at });
}
