import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Provision portal login accounts (staff-operated).
 *
 * Creates a Supabase auth user with the right role + client scoping, so staff
 * don't have to hand-edit user_metadata JSON in the Supabase dashboard.
 *
 * GET  /api/accounts                              → list client/manager/staff accounts
 * POST /api/accounts { email, role, clientIds[] } → create an account
 *
 * role: 'client'  → client portal only, sees the given stores
 *       'owner'   → full tools, but only the given stores (scoped manager)
 *       'staff'   → sees everything
 */

const ALLOWED_ROLES = ['client', 'owner', 'staff'];

async function callerRole(): Promise<string> {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tempPassword() {
  // 16 chars, mixed — comfortably above any Supabase password policy.
  const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  return `Pv${raw}9!`;
}

export async function GET() {
  const r = await callerRole();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can view accounts' }, { status: 403 });
  const a = admin();
  if (!a) return NextResponse.json({ error: 'Auth admin not configured' }, { status: 500 });

  const { data, error } = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const accounts = (data?.users || []).map((u: any) => {
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      email: u.email,
      name: meta.name || meta.full_name || '',
      role: meta.role || 'staff',
      client_ids: meta.client_ids || meta.client_id || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
    };
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const r = await callerRole();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can create accounts' }, { status: 403 });
  const a = admin();
  if (!a) return NextResponse.json({ error: 'Auth admin not configured (SUPABASE_SERVICE_ROLE_KEY missing)' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body?.email || '').toString().trim().toLowerCase();
  const role = (body?.role || '').toString().trim();
  const clientIds: string[] = Array.isArray(body?.clientIds) ? body.clientIds.filter(Boolean) : [];
  const chosenPassword = (body?.password || '').toString();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'role must be client, owner, or staff' }, { status: 400 });
  if ((role === 'client' || role === 'owner') && clientIds.length === 0) {
    return NextResponse.json({ error: 'Pick at least one store for a client or scoped manager.' }, { status: 400 });
  }
  // A blank password auto-generates a temporary one; a provided one is used
  // as-is so the person can sign in without resetting.
  const custom = chosenPassword.length > 0;
  if (custom && chosenPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const user_metadata: Record<string, unknown> = { role };
  if (role !== 'staff' && clientIds.length) user_metadata.client_ids = clientIds.join(',');

  const password = custom ? chosenPassword : tempPassword();
  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata,
  });
  if (error) {
    const msg = /already been registered|already exists/i.test(error.message)
      ? 'That email already has an account. Update its role/stores in Supabase, or use a different email.'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    email,
    role,
    clientIds,
    custom,
    // Only echo back an auto-generated password; a chosen one the staffer
    // already knows, so we don't return it.
    tempPassword: custom ? null : password,
    userId: data?.user?.id,
  });
}

// DELETE /api/accounts?id=<userId> — remove a login account.
export async function DELETE(req: NextRequest) {
  const r = await callerRole();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can remove accounts' }, { status: 403 });
  const a = admin();
  if (!a) return NextResponse.json({ error: 'Auth admin not configured' }, { status: 500 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await a.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
