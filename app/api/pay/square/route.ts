import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';
import { createPayment, squareConfigured } from '@/lib/square';
import { cardFee, getBillingEmails, recordOnlinePayment, tokenMatches } from '@/lib/invoice-payments';
import { sendPaymentReceivedEmails } from '@/lib/invoice-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Card errors Square returns that the payer can fix themselves.
const FRIENDLY: Record<string, string> = {
  CARD_DECLINED: 'Your card was declined. Please try another card or pay by bank.',
  INSUFFICIENT_FUNDS: 'The card was declined for insufficient funds.',
  CVV_FAILURE: 'The security code (CVV) didn\'t match. Please check it and try again.',
  ADDRESS_VERIFICATION_FAILURE: 'The ZIP code didn\'t match the card. Please check it and try again.',
  INVALID_EXPIRATION: 'The card\'s expiration date is invalid.',
  GENERIC_DECLINE: 'Your card was declined. Please try another card or pay by bank.',
};

/**
 * POST /api/pay/square — { id, t, sourceId, method: 'bank'|'card', idempotencyKey }
 * Public (the pay token is the credential). Charges the token the Square
 * payment form produced on the pay page.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { id, t, sourceId, idempotencyKey } = body || {};
  const method: 'bank' | 'card' = body?.method === 'card' ? 'card' : 'bank';

  if (!squareConfigured()) return NextResponse.json({ error: 'Online payment is not available.' }, { status: 503 });
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || typeof sourceId !== 'string' || typeof idempotencyKey !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await ensureSchema();
  const { rows } = await query(`select * from invoices where id = $1`, [id]);
  const inv = rows[0];
  if (!inv || !tokenMatches(inv.pay_token, t)) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  if (!['sent', 'overdue'].includes(inv.status)) {
    return NextResponse.json({ error: inv.status === 'paid' ? 'This invoice is already paid.' : 'This invoice is not open for payment.' }, { status: 409 });
  }
  if (inv.payment_status === 'processing') {
    return NextResponse.json({ error: 'A bank payment for this invoice is already processing.' }, { status: 409 });
  }

  const total = Number(inv.total);
  const amountCents = Math.round((total + (method === 'card' ? cardFee(total) : 0)) * 100);
  if (amountCents < 100) return NextResponse.json({ error: 'Amount too small to pay online.' }, { status: 400 });

  const clientName = clients.find(c => c.id === inv.client_id)?.name || inv.client_id;
  const [buyerEmail] = await getBillingEmails(inv.client_id);

  try {
    const payment = await createPayment({
      sourceId,
      idempotencyKey: idempotencyKey.slice(0, 45),
      amountCents,
      referenceId: inv.id,
      note: `Invoice ${inv.invoice_number} — ${clientName} — ${inv.title}`,
      buyerEmail,
    });

    if (payment.status === 'COMPLETED') {
      const paid = await recordOnlinePayment(inv.id, method, payment.id);
      if (paid) {
        try { await sendPaymentReceivedEmails(paid, method); }
        catch (err: any) { console.error('[pay/square] receipt email failed:', err.message); }
      }
      return NextResponse.json({ status: 'paid' });
    }
    if (payment.status === 'PENDING' || payment.status === 'APPROVED') {
      // Bank transfers settle in a few days; the webhook finishes the job.
      await query(
        `update invoices set payment_status = 'processing', square_payment_id = $2 where id = $1 and status <> 'paid'`,
        [inv.id, payment.id]
      );
      return NextResponse.json({ status: 'processing' });
    }
    return NextResponse.json({ error: 'The payment did not go through. Please try again.' }, { status: 402 });
  } catch (err: any) {
    console.error('[pay/square] Square error:', err.code, err.message);
    const msg = (err.code && FRIENDLY[err.code]) || 'The payment could not be completed. Please try again or contact mn@mothernatureagency.com.';
    return NextResponse.json({ error: msg }, { status: 402 });
  }
}
