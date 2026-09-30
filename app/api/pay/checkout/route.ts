import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';
import { createCheckoutSession, stripeConfigured } from '@/lib/stripe';
import { CARD_FEE_PERCENT, PORTAL_URL, cardFee, getBillingEmails, tokenMatches } from '@/lib/invoice-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pay/checkout?id=<invoice>&t=<pay token>&method=bank|card
 * Public (the pay token is the credential). Creates a Stripe Checkout
 * Session for the invoice and redirects to it.
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id') || '';
  const token = req.nextUrl.searchParams.get('t') || '';
  const method = req.nextUrl.searchParams.get('method') === 'card' ? 'card' : 'bank';

  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  const { rows } = await query(`select * from invoices where id = $1`, [id]);
  const inv = rows[0];
  if (!inv || !tokenMatches(inv.pay_token, token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  const payPage = `${PORTAL_URL}/pay/${inv.id}?t=${encodeURIComponent(token)}`;
  // Only open invoices can be paid; anything else goes back to the pay page, which explains why.
  if (!['sent', 'overdue'].includes(inv.status) || inv.payment_status === 'processing' || !stripeConfigured()) {
    return NextResponse.redirect(payPage, 303);
  }

  const total = Math.round(Number(inv.total) * 100);
  if (total < 50) return NextResponse.redirect(payPage, 303); // Stripe's minimum charge is $0.50

  const clientName = clients.find(c => c.id === inv.client_id)?.name || inv.client_id;
  const lineItems: any[] = [{
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: total,
      product_data: { name: `Invoice ${inv.invoice_number}`, description: `${clientName} — ${inv.title}`.slice(0, 500) },
    },
  }];
  const fee = method === 'card' ? Math.round(cardFee(Number(inv.total)) * 100) : 0;
  if (fee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: fee, product_data: { name: `Card processing fee (${CARD_FEE_PERCENT}%)` } },
    });
  }

  const [email] = await getBillingEmails(inv.client_id);
  const metadata = { invoice_id: inv.id, invoice_number: inv.invoice_number, method };

  try {
    const session = await createCheckoutSession({
      mode: 'payment',
      payment_method_types: method === 'card' ? ['card'] : ['us_bank_account'],
      ...(method === 'bank'
        ? { payment_method_options: { us_bank_account: { verification_method: 'automatic' } } }
        : {}),
      line_items: lineItems,
      customer_email: email,
      client_reference_id: inv.id,
      metadata,
      payment_intent_data: {
        description: `Invoice ${inv.invoice_number} — ${clientName}`,
        metadata,
      },
      success_url: `${payPage}&result=success`,
      cancel_url: `${payPage}&result=cancelled`,
    });
    await query(`update invoices set stripe_session_id = $2 where id = $1`, [inv.id, session.id]);
    return NextResponse.redirect(session.url, 303);
  } catch (err: any) {
    console.error('[pay/checkout] Stripe error:', err.message);
    return NextResponse.json({ error: 'Could not start payment. Please try again or contact mn@mothernatureagency.com.' }, { status: 502 });
  }
}
