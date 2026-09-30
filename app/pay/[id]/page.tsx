import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';
import { stripeConfigured } from '@/lib/stripe';
import { CARD_FEE_PERCENT, cardFee, tokenMatches } from '@/lib/invoice-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pay Invoice — Mother Nature Agency', robots: { index: false } };

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

function formatDate(ymd: string) {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`);
  return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '40px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)', borderRadius: '16px 16px 0 0', padding: 28, textAlign: 'center' }}>
          <div style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>Mother Nature Agency</div>
        </div>
        <div style={{ background: 'white', borderRadius: '0 0 16px 16px', padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 20 }}>
          Questions? <a href="mailto:mn@mothernatureagency.com" style={{ color: '#0c6da4' }}>mn@mothernatureagency.com</a>
        </p>
      </div>
    </div>
  );
}

function Message({ title, body, tone = 'info' }: { title: string; body: string; tone?: 'info' | 'good' | 'warn' }) {
  const color = tone === 'good' ? '#2e7d32' : tone === 'warn' ? '#b45309' : '#0c6da4';
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

export default async function PayInvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string; result?: string };
}) {
  await ensureSchema();
  const token = searchParams.t || '';
  const isUuid = /^[0-9a-f-]{36}$/i.test(params.id);
  const { rows } = isUuid
    ? await query(`select * from invoices where id = $1`, [params.id])
    : { rows: [] as any[] };
  const inv = rows[0];

  if (!inv || !tokenMatches(inv.pay_token, token) || inv.status === 'draft') {
    return (
      <Shell>
        <Message tone="warn" title="Link not valid" body="This payment link is invalid or has expired. Please reply to your invoice email and we'll send a new one." />
      </Shell>
    );
  }

  const clientName = clients.find(c => c.id === inv.client_id)?.name || inv.client_id;
  const total = Number(inv.total);
  const header = (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{ fontSize: 13, color: '#888' }}>Invoice {inv.invoice_number} · {clientName}</div>
      <div style={{ fontSize: 14, color: '#333', fontWeight: 600, marginTop: 4 }}>{inv.title}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#0c6da4', marginTop: 12 }}>{money(total)}</div>
      <div style={{ fontSize: 13, color: '#666' }}>Due {formatDate(inv.due_date)}</div>
    </div>
  );

  if (inv.status === 'paid') {
    return <Shell>{header}<Message tone="good" title="Paid — thank you!" body={`This invoice was paid${inv.paid_date ? ` on ${formatDate(inv.paid_date)}` : ''}.`} /></Shell>;
  }
  if (inv.status === 'cancelled') {
    return <Shell>{header}<Message tone="warn" title="Invoice cancelled" body="This invoice has been cancelled and doesn't need to be paid." /></Shell>;
  }
  if (inv.payment_status === 'processing' || searchParams.result === 'success') {
    return (
      <Shell>
        {header}
        <Message
          tone="good"
          title="Payment submitted — thank you!"
          body="Card payments confirm right away. Bank transfers take 3–5 business days to clear; we'll email you a receipt when it does."
        />
      </Shell>
    );
  }
  if (!stripeConfigured()) {
    return <Shell>{header}<Message title="Online payment unavailable" body="Please pay by Zelle to mn@mothernatureagency.com or by check payable to Mother Nature Agency LLC." /></Shell>;
  }

  const fee = cardFee(total);
  const base = `/api/pay/checkout?id=${inv.id}&t=${encodeURIComponent(token)}`;
  const btn: React.CSSProperties = { display: 'block', textDecoration: 'none', borderRadius: 12, padding: '16px 20px', marginBottom: 12 };

  return (
    <Shell>
      {header}
      {searchParams.result === 'cancelled' && (
        <div style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
          Payment was not completed. You can try again below.
        </div>
      )}
      <a href={`${base}&method=bank`} style={{ ...btn, background: '#0c6da4', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Pay by bank transfer</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{money(total)}</span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>No fee · connect your bank account securely</div>
      </a>
      <a href={`${base}&method=card`} style={{ ...btn, background: 'white', color: '#0c6da4', border: '2px solid #0c6da4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Pay by card</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{money(total + fee)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          {CARD_FEE_PERCENT > 0 ? `Includes ${CARD_FEE_PERCENT}% card processing fee (${money(fee)})` : 'Credit or debit card'}
        </div>
      </a>
      <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        Payments are processed securely by Stripe.<br />
        Prefer Zelle? Send to mn@mothernatureagency.com with the invoice number.
      </div>
    </Shell>
  );
}
