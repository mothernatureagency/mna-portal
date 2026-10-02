import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { sendInvoiceEmail, type InvoiceEmailKind } from '@/lib/invoice-email';
import { todayCentral } from '@/lib/invoice-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STAGES: InvoiceEmailKind[] = ['before', 'due', 'after'];

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * GET /api/cron/invoice-reminders — daily (vercel.json).
 * Emails open invoices 3 days before the due date, on it, and 7 days after,
 * and flips unpaid invoices past their due date to 'overdue'.
 * Auth: Vercel Cron's "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSchema();
  const today = todayCentral();

  const { rows: overdue } = await query(
    `update invoices set status = 'overdue' where status = 'sent' and due_date < $1 returning id`,
    [today]
  );
  const markedOverdue = overdue.length;

  const { rows } = await query(
    `select * from invoices
      where status in ('sent', 'overdue')
        and coalesce(payment_status, '') <> 'processing'
        and due_date <= ($1::date + 3)`,
    [today]
  );

  const results: { invoice: string; stage: string; ok: boolean; error?: string }[] = [];
  for (const inv of rows) {
    const daysLeft = daysBetween(today, inv.due_date);
    const due: InvoiceEmailKind | null =
      daysLeft <= -7 ? 'after' : daysLeft <= 0 ? 'due' : daysLeft <= 3 ? 'before' : null;
    const sent: string[] = Array.isArray(inv.reminders_sent) ? inv.reminders_sent : [];
    if (!due || sent.includes(due)) continue;

    // Send only the latest stage that applies; earlier ones are skipped, not sent late.
    const res = await sendInvoiceEmail(inv, due);
    results.push({ invoice: inv.invoice_number, stage: due, ok: res.success, error: res.error });
    if (res.success) {
      const upTo = STAGES.slice(0, STAGES.indexOf(due) + 1);
      await query(
        `update invoices set reminders_sent = $2::jsonb where id = $1`,
        [inv.id, JSON.stringify(Array.from(new Set([...sent, ...upTo])))]
      );
    }
  }

  return NextResponse.json({ today, markedOverdue, reminders: results });
}
