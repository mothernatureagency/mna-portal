import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/client-requests?clientId=prime-iv&assignedTo=admin@mothernatureagency.com
// - clientId: filter by client (required for client-role users, optional for staff)
// - assignedTo: filter by assignee email (staff only)
// - If no clientId and no assignedTo, returns ALL tasks across all clients (staff only)
export async function GET(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const userClientId = (meta.client_id as string) || '';

  let clientId = req.nextUrl.searchParams.get('clientId') || '';
  const assignedTo = req.nextUrl.searchParams.get('assignedTo') || '';

  if (role === 'client') {
    clientId = userClientId || 'prime-iv';
  }

  // Build query dynamically
  const conditions: string[] = [];
  const params: any[] = [];

  if (clientId) {
    params.push(clientId);
    conditions.push(`client_id = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    conditions.push(`assigned_to = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT id, client_id, title, description, status, assigned_to, created_at, completed_at
       FROM client_requests
      ${where}
      ORDER BY (status = 'done') ASC, created_at DESC`,
    params
  );
  return NextResponse.json({ items: rows });
}

// POST /api/client-requests
// body: { clientId, title, description?, assignedTo? }
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
  const { clientId, title, description, assignedTo } = body || {};
  if (!clientId || !title) return NextResponse.json({ error: 'clientId and title required' }, { status: 400 });

  const { rows } = await query(
    `INSERT INTO client_requests (client_id, title, description, assigned_to) VALUES ($1,$2,$3,$4) RETURNING *`,
    [clientId, title, description || null, assignedTo || null]
  );
  return NextResponse.json({ item: rows[0] });
}

// PATCH /api/client-requests
// body: { id, status?, assignedTo? }
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const userClientId = (meta.client_id as string) || '';

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, status, assignedTo } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // If a client is making the request, verify the row belongs to them.
  if (role === 'client') {
    const { rows } = await query(`SELECT client_id FROM client_requests WHERE id = $1`, [id]);
    if (!rows[0] || rows[0].client_id !== userClientId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (status !== undefined) {
    params.push(status);
    fields.push(`status = $${params.length}`);
    if (status === 'done') {
      fields.push('completed_at = now()');
    } else {
      fields.push('completed_at = null');
    }
  }

  if (assignedTo !== undefined) {
    params.push(assignedTo || null);
    fields.push(`assigned_to = $${params.length}`);
  }

  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  params.push(id);
  const { rows } = await query(
    `UPDATE client_requests SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return NextResponse.json({ item: rows[0] });
}

// DELETE /api/client-requests?id=...
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can delete tasks' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await query(`DELETE FROM client_requests WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
