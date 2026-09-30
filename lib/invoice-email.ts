/**
 * Invoice emails: the invoice itself (when status changes to 'sent'),
 * due-date reminders, and payment confirmations.
 */

import { sendEmail } from './send-email';
import { clients } from './clients';
import { buildInvoicePdf } from './invoice-pdf';
import { stripeConfigured } from './stripe';
import { CARD_FEE_PERCENT, PORTAL_URL, ensurePayToken, getBillingEmails, payUrl } from './invoice-payments';

const OWNER_EMAIL = 'mn@mothernatureagency.com';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_id: string;
  title: string;
  description?: string;
  items: any[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string;
  issued_date?: string;
  notes?: string;
}

export type InvoiceEmailKind = 'invoice' | 'before' | 'due' | 'after';

function getClientName(clientId: string): string {
  const client = clients.find(c => c.id === clientId);
  return client?.name || clientId;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

function formatDate(ymd: string): string {
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`);
  if (isNaN(d.getTime())) return String(ymd);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function intro(invoice: InvoiceData, kind: InvoiceEmailKind): string {
  const num = esc(invoice.invoice_number);
  const due = formatDate(invoice.due_date);
  switch (kind) {
    case 'before': return `Friendly reminder: invoice ${num} is due in 3 days, on ${due}.`;
    case 'due': return `Invoice ${num} is due today.`;
    case 'after': return `Invoice ${num} was due on ${due} and is now past due. If you've already sent payment, thank you, and please disregard this note.`;
    default: return `Here's your invoice for ${esc(invoice.title)}. A PDF copy is attached for your records.`;
  }
}

function subject(invoice: InvoiceData, kind: InvoiceEmailKind): string {
  const base = `Invoice ${invoice.invoice_number}`;
  switch (kind) {
    case 'before': return `Reminder: ${base} is due in 3 days | Mother Nature Agency`;
    case 'due': return `${base} is due today | Mother Nature Agency`;
    case 'after': return `Past due: ${base} | Mother Nature Agency`;
    default: return `${base} — ${invoice.title} | Mother Nature Agency`;
  }
}

const TD = 'padding: 10px 6px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;';
const TH = 'padding: 10px 6px; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.05em;';

export function buildInvoiceEmailHtml(invoice: InvoiceData, kind: InvoiceEmailKind, link: string | null): string {
  const clientName = getClientName(invoice.client_id);
  const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);

  const itemRows = items.map((item: any) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.rate ?? item.amount) || 0;
    return `
    <tr>
      <td style="${TD}">${esc(item.description || item.name || '—')}</td>
      <td style="${TD} text-align: center;">${qty}</td>
      <td style="${TD} text-align: right;">${formatCurrency(rate)}</td>
      <td style="${TD} text-align: right;">${formatCurrency(qty * rate)}</td>
    </tr>`;
  }).join('');

  const feeNote = CARD_FEE_PERCENT > 0
    ? `<strong style="color: #2e7d32;">Bank transfer (ACH): no fee</strong> &nbsp;·&nbsp; Credit card: ${CARD_FEE_PERCENT}% processing fee`
    : 'Pay by bank transfer (ACH) or credit card';

  const payBox = link ? `
      <div style="border: 2px solid #0c6da4; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 28px;">
        <div style="font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em;">Amount Due</div>
        <div style="font-size: 36px; font-weight: 800; color: #0c6da4; margin: 6px 0 2px;">${formatCurrency(invoice.total)}</div>
        <div style="font-size: 13px; color: #666; margin-bottom: 20px;">Due ${formatDate(invoice.due_date)}</div>
        <a href="${esc(link)}" style="display: inline-block; background: #0c6da4; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 10px;">Pay Invoice</a>
        <div style="font-size: 12px; color: #888; margin-top: 14px; line-height: 1.6;">${feeNote}</div>
      </div>` : `
      <div style="border: 2px solid #0c6da4; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 28px;">
        <div style="font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em;">Amount Due</div>
        <div style="font-size: 36px; font-weight: 800; color: #0c6da4; margin: 6px 0 2px;">${formatCurrency(invoice.total)}</div>
        <div style="font-size: 13px; color: #666;">Due ${formatDate(invoice.due_date)}</div>
      </div>`;

  // Without online payments, bank transfer details stay in the email so ACH is still possible.
  const bankRows = link ? '' : `
          <tr><td colspan="2" style="padding: 12px 0 4px; font-size: 13px; font-weight: 700; color: #0c6da4;">Bank of America — Mother Nature Agency LLC</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Account #</td><td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">898165120338</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">ACH Routing #</td><td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">063100277</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #666;">Wire Routing #</td><td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">026009593</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0c6da4, #4ab8ce); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 800;">Mother Nature Agency</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Invoice ${esc(invoice.invoice_number)}</p>
    </div>

    <!-- Body -->
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
      <p style="font-size: 16px; color: #333; margin: 0 0 8px;">Hi ${esc(clientName)},</p>
      <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.6;">${intro(invoice, kind)}</p>
      ${payBox}

      <!-- Invoice details -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Invoice #</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 700; text-align: right;">${esc(invoice.invoice_number)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Title</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">${esc(invoice.title)}</td>
          </tr>
          ${invoice.issued_date ? `
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Issued</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; text-align: right;">${esc(invoice.issued_date)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Due Date</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">${esc(invoice.due_date)}</td>
          </tr>
        </table>
      </div>

      <!-- Line items -->
      ${items.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="${TH} text-align: left;">Description</th>
            <th style="${TH} text-align: center;">Qty</th>
            <th style="${TH} text-align: right;">Rate</th>
            <th style="${TH} text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <!-- Totals -->
      <div style="text-align: right; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 4px;">Subtotal: ${formatCurrency(invoice.subtotal)}</div>
        ${Number(invoice.tax_amount) > 0 ? `<div style="font-size: 13px; color: #888; margin-bottom: 4px;">Tax (${invoice.tax_rate}%): ${formatCurrency(invoice.tax_amount)}</div>` : ''}
        <div style="font-size: 22px; font-weight: 800; color: #0c6da4; margin-top: 8px;">Total: ${formatCurrency(invoice.total)}</div>
      </div>

      <!-- Other ways to pay -->
      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #0c6da4;">${link ? 'Other Ways to Pay' : 'Payment Methods'}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #666;">Zelle</td>
            <td style="padding: 6px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">mn@mothernatureagency.com</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #666;">Check payable to</td>
            <td style="padding: 6px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">Mother Nature Agency LLC</td>
          </tr>${bankRows}
        </table>
        <p style="font-size: 12px; color: #888; margin: 10px 0 0;">Please include the invoice number with your payment.</p>
      </div>

      ${invoice.notes ? `
      <div style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 16px;">
        <strong>Notes:</strong> ${esc(invoice.notes)}
      </div>` : ''}

      <p style="font-size: 13px; color: #888; margin: 24px 0 0; line-height: 1.6;">
        Questions about this invoice? Just reply to this email or reach us at
        <a href="mailto:${OWNER_EMAIL}" style="color: #0c6da4; text-decoration: none;">${OWNER_EMAIL}</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #999; margin: 0;">Mother Nature Agency</p>
      <p style="font-size: 11px; color: #bbb; margin: 4px 0 0;">
        <a href="${PORTAL_URL}/client/invoices" style="color: #999; text-decoration: none;">View in Portal</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Email an invoice (or a reminder about it) to the client's billing contacts, with the PDF attached. */
export async function sendInvoiceEmail(
  invoice: InvoiceData,
  kind: InvoiceEmailKind = 'invoice'
): Promise<{ success: boolean; error?: string }> {
  const to = await getBillingEmails(invoice.client_id);
  if (to.length === 0) {
    console.warn(`[invoice-email] No billing email for client: ${invoice.client_id}`);
    return { success: false, error: `No billing email saved for ${getClientName(invoice.client_id)}. Add one on the invoice, then use Resend Email.` };
  }

  const link = stripeConfigured() ? payUrl(invoice.id, await ensurePayToken(invoice.id)) : null;

  const pdf = await buildInvoicePdf({
    ...invoice,
    clientName: getClientName(invoice.client_id),
    payUrl: link,
  });

  return sendEmail({
    to,
    subject: subject(invoice, kind),
    html: buildInvoiceEmailHtml(invoice, kind, link),
    replyTo: OWNER_EMAIL,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdf).toString('base64') }],
  });
}

function simpleEmail(heading: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #0c6da4;">${heading}</h2>
      <div style="font-size: 14px; color: #555; line-height: 1.7;">${body}</div>
    </div>
    <p style="text-align: center; font-size: 12px; color: #999; margin: 24px 0 0;">Mother Nature Agency</p>
  </div>
</body></html>`;
}

/** Thank the client and tell the owner when an online payment clears. */
export async function sendPaymentReceivedEmails(invoice: InvoiceData, method: 'bank' | 'card') {
  const clientName = getClientName(invoice.client_id);
  const amount = formatCurrency(invoice.total);
  const how = method === 'card' ? 'card' : 'bank transfer';

  const to = await getBillingEmails(invoice.client_id);
  if (to.length) {
    await sendEmail({
      to,
      subject: `Payment received — Invoice ${invoice.invoice_number} | Mother Nature Agency`,
      html: simpleEmail('Payment received, thank you!', `
        Hi ${esc(clientName)},<br><br>
        We've received your ${how} payment of <strong>${amount}</strong> for invoice
        <strong>${esc(invoice.invoice_number)}</strong> (${esc(invoice.title)}).<br><br>
        Thank you!`),
      replyTo: OWNER_EMAIL,
    });
  }

  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Paid: ${invoice.invoice_number} — ${clientName} — ${amount}`,
    html: simpleEmail('Invoice paid', `
      <strong>${esc(clientName)}</strong> paid invoice <strong>${esc(invoice.invoice_number)}</strong>
      (${esc(invoice.title)}) by ${how}: <strong>${amount}</strong>.<br><br>
      It has been marked paid in the portal.`),
  });
}

/** Tell the owner when a bank payment bounces (e.g. insufficient funds). */
export async function sendPaymentFailedEmail(invoice: InvoiceData) {
  const clientName = getClientName(invoice.client_id);
  await sendEmail({
    to: OWNER_EMAIL,
    subject: `Payment failed: ${invoice.invoice_number} — ${clientName}`,
    html: simpleEmail('Bank payment failed', `
      A bank transfer for invoice <strong>${esc(invoice.invoice_number)}</strong> from
      <strong>${esc(clientName)}</strong> (${formatCurrency(invoice.total)}) did not go through.
      The invoice is still open, and the client can try again from the same pay link.<br><br>
      See the Stripe dashboard for the reason.`),
  });
}
