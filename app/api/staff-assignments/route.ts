import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { STAFF } from '@/lib/staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Staff → client assignments (who works on which client).
 *
 * DB-backed overlay so the owner can (re)assign staff from the dashboard.
 * On first read the table is seeded from the static defaults in lib/staff.ts
 * (owner excluded — she implicitly sees everything).
 *
 * GET    /api/staff-assignments                          → all assignments
 * POST   /api/staff-assignments  { staffEmail, clientId } → assign
 * DELETE /api/staff-assignments?staffEmail=&clientId=     → unassign
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

const OWNER_EMAIL = 'mn@mothernatureagency.com';

export async function GET() {
  await ensureSchema();
  const { rows: existing } = await query<{ n: string }>('select count(*)::text as n from staff_assignments');
  if (Number(existing[0]?.n || 0) === 0) {
    // Seed from static defaults (non-owner members).
    for (const m of STAFF) {
      if (m.email.toLowerCase() === OWNER_EMAIL) continue;
      for (const cid of m.assignedClients) {
        await query(
          `insert into staff_assignments (staff_email, client_id) values ($1, $2) on conflict do nothing`,
          [m.email.toLowerCase(), cid],
        );
      }
    }
  }
  const { rows } = await query(
    `select staff_email, client_id, created_at from staff_assignments order by staff_email, client_id`,
  );
  return NextResponse.json({ assignments: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can assign' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const staffEmail = (body?.staffEmail || '').toString().trim().toLowerCase();
  const clientId = (body?.clientId || '').toString().trim();
  if (!staffEmail || !clientId) return NextResponse.json({ error: 'staffEmail and clientId required' }, { status: 400 });

  await query(
    `insert into staff_assignments (staff_email, client_id) values ($1, $2) on conflict do nothing`,
    [staffEmail, clientId],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can unassign' }, { status: 403 });

  const staffEmail = (req.nextUrl.searchParams.get('staffEmail') || '').trim().toLowerCase();
  const clientId = (req.nextUrl.searchParams.get('clientId') || '').trim();
  if (!staffEmail || !clientId) return NextResponse.json({ error: 'staffEmail and clientId required' }, { status: 400 });
  await query('delete from staff_assignments where lower(staff_email) = $1 and client_id = $2', [staffEmail, clientId]);
  return NextResponse.json({ ok: true });
}
