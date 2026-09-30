import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { verifyWebhook } from '@/lib/stripe';
import { recordStripePayment } from '@/lib/invoice-payments';
import { sendPaymentFailedEmail, sendPaymentReceivedEmails } from '@/lib/invoice-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook — Stripe Checkout events for invoice payments.
 *
 * Card payments arrive as checkout.session.completed with payment_status 'paid'.
 * Bank (ACH) payments arrive as completed/'unpaid' first, then
 * async_payment_succeeded or async_payment_failed a few days later.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get('stripe-signature'));
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  const session = event.data?.object || {};
  const invoiceId: string | undefined = session.metadata?.invoice_id;
  if (!invoiceId) return NextResponse.json({ received: true }); // not an invoice payment
  const method: 'bank' | 'card' = session.metadata?.method === 'card' ? 'card' : 'bank';

  await ensureSchema();

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (session.payment_status === 'paid') {
        const inv = await recordStripePayment(invoiceId, method);
        if (inv) {
          try { await sendPaymentReceivedEmails(inv, method); }
          catch (err: any) { console.error('[stripe/webhook] receipt email failed:', err.message); }
        }
      } else {
        // ACH submitted but not cleared yet: stop reminders and block a second payment.
        await query(
          `update invoices set payment_status = 'processing' where id = $1 and status <> 'paid'`,
          [invoiceId]
        );
      }
      break;
    }
    case 'checkout.session.async_payment_failed': {
      const { rows } = await query(
        `update invoices set payment_status = 'failed' where id = $1 and status <> 'paid' returning *`,
        [invoiceId]
      );
      if (rows[0]) {
        try { await sendPaymentFailedEmail(rows[0]); }
        catch (err: any) { console.error('[stripe/webhook] failure email failed:', err.message); }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
