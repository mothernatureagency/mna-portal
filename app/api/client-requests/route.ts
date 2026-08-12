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
  const userEmail = (user?.email || '').toLowerCase();

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

  // Privacy: only the owner sees everyone's tasks. Other staff see just their
  // own tasks plus shared team/unassigned ones — never tasks assigned to a
  // specific other person. (Clients are already scoped to their client_id.)
  const isOwner = role === 'owner' || userEmail === 'mn@mothernatureagency.com';
  if (!isOwner && role !== 'client') {
    if (userEmail) {
      params.push(userEmail);
      conditions.push(`(assigned_to IS NULL OR assigned_to = 'team' OR lower(assigned_to) = $${params.length})`);
    } else {
      conditions.push(`(assigned_to IS NULL OR assigned_to = 'team')`);
    }
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

  // Assignment is optional — when left blank, the task goes to the Mother
  // Nature team (sentinel 'team') rather than being left unassigned.
  const { rows } = await query(
    `INSERT INTO client_requests (client_id, title, description, assigned_to) VALUES ($1,$2,$3,$4) RETURNING *`,
    [clientId, title, description || null, assignedTo || 'team']
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
  const { id, status, assignedTo, title, description } = body || {};
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
    // Clearing the assignee hands the task to the Mother Nature team
    // rather than leaving it unassigned.
    params.push(assignedTo || 'team');
    fields.push(`assigned_to = $${params.length}`);
  }

  // Title / description are editable by staff only (clients can only toggle status).
  if (role !== 'client') {
    if (title !== undefined) {
      params.push(title);
      fields.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description || null);
      fields.push(`description = $${params.length}`);
    }
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
