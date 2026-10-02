import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { squareWebhookUrl, verifySquareWebhook } from '@/lib/square';
import { PORTAL_URL, recordOnlinePayment } from '@/lib/invoice-payments';
import { sendPaymentFailedEmail, sendPaymentReceivedEmails } from '@/lib/invoice-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/square/webhook — Square payment.created / payment.updated events.
 *
 * Card payments are usually recorded already by /api/pay/square; this catches
 * bank (ACH) payments clearing or failing days later, and anything the pay
 * request missed. Payments are matched to invoices by reference_id.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const event = verifySquareWebhook(raw, req.headers.get('x-square-hmacsha256-signature'), squareWebhookUrl(PORTAL_URL));
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const payment = event.data?.object?.payment;
  const invoiceId: string | undefined = payment?.reference_id;
  if (!payment || !invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) {
    return NextResponse.json({ received: true }); // not an invoice payment
  }
  const method: 'bank' | 'card' = payment.source_type === 'BANK_ACCOUNT' ? 'bank' : 'card';

  await ensureSchema();

  if (payment.status === 'COMPLETED') {
    const inv = await recordOnlinePayment(invoiceId, method, payment.id);
    if (inv) {
      try { await sendPaymentReceivedEmails(inv, method); }
      catch (err: any) { console.error('[square/webhook] receipt email failed:', err.message); }
    }
  } else if (payment.status === 'FAILED' || payment.status === 'CANCELED') {
    // Only a bank payment we were waiting on counts; a declined card attempt
    // was already reported to the payer on the pay page.
    const { rows } = await query(
      `update invoices set payment_status = 'failed'
        where id = $1 and status <> 'paid' and payment_status = 'processing' and square_payment_id = $2
        returning *`,
      [invoiceId, payment.id]
    );
    if (rows[0]) {
      try { await sendPaymentFailedEmail(rows[0]); }
      catch (err: any) { console.error('[square/webhook] failure email failed:', err.message); }
    }
  }

  return NextResponse.json({ received: true });
}
