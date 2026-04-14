import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/invoice-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list invoices
// ?clientId=prime-iv  — filter by client
// ?status=sent        — filter by status (draft, sent, paid, overdue, cancelled)
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  const status = req.nextUrl.searchParams.get('status');

  let where = '';
  const params: any[] = [];

  if (clientId) {
    params.push(clientId);
    where += ` where client_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    where += where ? ' and' : ' where';
    where += ` status = $${params.length}`;
  }

  const { rows } = await query(
    `select * from invoices${where} order by created_at desc`,
    params
  );
  return NextResponse.json({ invoices: rows });
}

// POST — create invoice
export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const {
    clientId, title, description, items, subtotal,
    taxRate, taxAmount, total, dueDate, notes,
  } = body;

  if (!clientId || !title || !dueDate) {
    return NextResponse.json({ error: 'clientId, title, and dueDate required' }, { status: 400 });
  }

  // Generate invoice number: MNA-YYYYMM-XXX
  const now = new Date();
  const prefix = `MNA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { rows: countRows } = await query(
    `select count(*) as cnt from invoices where invoice_number like $1`,
    [`${prefix}%`]
  );
  const seq = String(parseInt(countRows[0]?.cnt || '0') + 1).padStart(3, '0');
  const invoiceNumber = `${prefix}-${seq}`;

  const { rows } = await query(
    `insert into invoices (invoice_number, client_id, title, description, items, subtotal, tax_rate, tax_amount, total, due_date, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [
      invoiceNumber, clientId, title, description || null,
      JSON.stringify(items || []),
      subtotal || 0, taxRate || 0, taxAmount || 0, total || 0,
      dueDate, notes || null,
    ]
  );
  return NextResponse.json({ invoice: rows[0] }, { status: 201 });
}

// PATCH — update invoice
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields: string[] = [];
  const values: any[] = [];
  const patchable = [
    'title', 'description', 'items', 'subtotal', 'tax_rate', 'tax_amount',
    'total', 'status', 'due_date', 'issued_date', 'paid_date', 'paid_amount',
    'payment_method', 'notes', 'client_visible', 'client_id',
  ];

  for (const key of patchable) {
    if (body[key] !== undefined) {
      values.push(key === 'items' ? JSON.stringify(body[key]) : body[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);
  const { rows } = await query(
    `update invoices set ${fields.join(', ')} where id = $${values.length} returning *`,
    values
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = rows[0];

  // Send invoice email when status changes to 'sent'
  if (body.status === 'sent') {
    try {
      const emailResult = await sendInvoiceEmail(updated);
      return NextResponse.json({ invoice: updated, emailSent: emailResult.success, emailError: emailResult.error });
    } catch (err: any) {
      // Don't fail the status update if email fails
      console.error('[invoices] Email send error:', err.message);
      return NextResponse.json({ invoice: updated, emailSent: false, emailError: err.message });
    }
  }

  return NextResponse.json({ invoice: updated });
}

// DELETE — remove invoice
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from invoices where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
