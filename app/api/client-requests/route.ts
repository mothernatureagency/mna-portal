import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/client-requests?clientId=prime-iv
// - If an authenticated Supabase user has user_metadata.client_id, we scope to that.
// - If the caller is MNA staff, they may pass ?clientId=... to pull any client's list.
export async function GET(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const userClientId = (meta.client_id as string) || '';

  let clientId = req.nextUrl.searchParams.get('clientId') || '';
  if (role === 'client') {
    // Clients can only ever see their own list, regardless of query string.
    clientId = userClientId || 'prime-iv';
  }
  if (!clientId) return NextResponse.json({ items: [] });

  const { rows } = await query(
    `select id, client_id, title, description, status, created_at, completed_at
       from client_requests
      where client_id = $1
      order by (status = 'done') asc, created_at desc`,
    [clientId]
  );
  return NextResponse.json({ items: rows });
}

// POST /api/client-requests
// body: { clientId, title, description? }
// Staff-only (clients should not be adding tasks to themselves on this list —
// this list is MNA asking the client for things).
export async function POST(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  if (role === 'client') {
    return NextResponse.json({ error: 'Only staff can create tasks' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, title, description } = body || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId and title required' }, { status: 400 });

  const { rows } = await query(
    `insert into client_requests (client_id, title, description) values ($1,$2,$3) returning *`,
    [clientId, title, description || null]
  );
  return NextResponse.json({ item: rows[0] });
}

// PATCH /api/client-requests
// body: { id, status }
// Clients may mark their own items 'done' or back to 'open'. Staff can do anything.
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const userClientId = (meta.client_id as string) || '';

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, status } = body || {};
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  // If a client is making the request, verify the row belongs to them first.
  if (role === 'client') {
    const { rows } = await query(`select client_id from client_requests where id = $1`, [id]);
    if (!rows[0] || rows[0].client_id !== userClientId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const completedAtSet = status === 'done' ? ', completed_at = now()' : ', completed_at = null';
  const { rows } = await query(
    `update client_requests set status = $1${completedAtSet} where id = $2 returning *`,
    [status, id]
  );
  return NextResponse.json({ item: rows[0] });
}

// DELETE /api/client-requests?id=...
// Staff only.
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can delete tasks' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await query(`delete from client_requests where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
