import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list contacts
// ?group=team|client  — filter by group
// ?clientId=prime-iv  — filter by client association
export async function GET(req: NextRequest) {
  await ensureSchema();
  const group = req.nextUrl.searchParams.get('group');
  const clientId = req.nextUrl.searchParams.get('clientId');

  let where = '';
  const params: any[] = [];

  if (group) {
    params.push(group);
    where += ` WHERE contact_group = $${params.length}`;
  }
  if (clientId) {
    params.push(clientId);
    where += where ? ' AND' : ' WHERE';
    where += ` (client_id = $${params.length} OR client_id IS NULL)`;
  }

  const { rows } = await query(
    `SELECT * FROM contacts${where} ORDER BY contact_group ASC, name ASC`,
    params
  );
  return NextResponse.json({ contacts: rows });
}

// POST — create contact
export async function POST(req: NextRequest) {
  await ensureSchema();
  const { name, email, role, group, clientId, company } = await req.json();

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO contacts (name, email, role, contact_group, client_id, company)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, email.toLowerCase(), role || null, group || 'client', clientId || null, company || null]
  );
  return NextResponse.json({ contact: rows[0] }, { status: 201 });
}

// PATCH — update contact
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];
  const patchable = ['name', 'email', 'role', 'contact_group', 'client_id', 'company'];

  for (const key of patchable) {
    const bodyKey = key === 'contact_group' ? 'group' : key;
    if (body[bodyKey] !== undefined) {
      values.push(key === 'email' ? body[bodyKey].toLowerCase() : body[bodyKey]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ contact: rows[0] });
}

// DELETE — remove contact
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('DELETE FROM contacts WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
