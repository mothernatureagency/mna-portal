import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Staff roster — teammates added on the fly (beyond lib/staff.ts), so new
 * hires can be assigned to clients from the dashboard.
 *
 * GET    /api/staff                       → custom staff members
 * POST   /api/staff  { email, name, role?, color? }
 * DELETE /api/staff?email=
 */

const PALETTE = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function GET() {
  await ensureSchema();
  const { rows } = await query(`select email, name, role, color, created_at from staff_members order by created_at asc`);
  return NextResponse.json({ staff: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can add teammates' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body?.email || '').toString().trim().toLowerCase();
  const name = (body?.name || '').toString().trim();
  const roleTitle = (body?.role || '').toString().trim() || null;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });

  // Deterministic color from the palette based on the email.
  let sum = 0;
  for (let i = 0; i < email.length; i++) sum += email.charCodeAt(i);
  const color = (body?.color || '').toString().trim() || PALETTE[sum % PALETTE.length];

  const { rows } = await query(
    `insert into staff_members (email, name, role, color) values ($1,$2,$3,$4)
     on conflict (email) do update set name=excluded.name, role=excluded.role, color=excluded.color
     returning email, name, role, color, created_at`,
    [email, name, roleTitle, color],
  );
  return NextResponse.json({ member: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can remove teammates' }, { status: 403 });
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  await query('delete from staff_members where lower(email) = $1', [email]);
  // Also clear their client assignments so nothing dangles.
  await query('delete from staff_assignments where lower(staff_email) = $1', [email]);
  return NextResponse.json({ ok: true });
}
