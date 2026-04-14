/**
 * Invoice email template and sending logic.
 * Called when an invoice status changes to 'sent'.
 */

import { sendEmail } from './send-email';
import { clients } from './clients';

interface InvoiceData {
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

function getClientEmail(clientId: string): string | null {
  // Map client IDs to their billing contact emails
  const emailMap: Record<string, string> = {
    'prime-iv': 'jkulkusky@primeivhydration.com',
    'prime-iv-destin': 'jkulkusky@primeivhydration.com',
    // Add more client billing emails as needed
  };
  return emailMap[clientId] || null;
}

function getClientName(clientId: string): string {
  const client = clients.find(c => c.id === clientId);
  return client?.name || clientId;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function buildInvoiceEmailHtml(invoice: InvoiceData): string {
  const clientName = getClientName(invoice.client_id);
  const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);

  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${item.description || item.name || '—'}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: right;">${formatCurrency(item.rate || item.amount || 0)}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: right;">${formatCurrency((item.quantity || 1) * (item.rate || item.amount || 0))}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0c6da4, #4ab8ce); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 800;">Mother Nature Agency</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Invoice</p>
    </div>

    <!-- Body -->
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
      <p style="font-size: 16px; color: #333; margin: 0 0 8px;">Hi ${clientName},</p>
      <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.6;">
        Please find your invoice below. You can also view and manage your invoices in the
        <a href="https://portal.mothernatureagency.com/client/invoices" style="color: #0c6da4; text-decoration: none; font-weight: 600;">client portal</a>.
      </p>

      <!-- Invoice details -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Invoice #</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 700; text-align: right;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Title</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">${invoice.title}</td>
          </tr>
          ${invoice.issued_date ? `
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Issued</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; text-align: right;">${invoice.issued_date}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #888;">Due Date</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">${invoice.due_date}</td>
          </tr>
        </table>
      </div>

      <!-- Line items -->
      ${items.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #666; text-align: left; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #666; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #666; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Rate</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #666; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

      <!-- Totals -->
      <div style="text-align: right; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 4px;">Subtotal: ${formatCurrency(invoice.subtotal)}</div>
        ${invoice.tax_amount > 0 ? `<div style="font-size: 13px; color: #888; margin-bottom: 4px;">Tax (${invoice.tax_rate}%): ${formatCurrency(invoice.tax_amount)}</div>` : ''}
        <div style="font-size: 22px; font-weight: 800; color: #0c6da4; margin-top: 8px;">Total: ${formatCurrency(invoice.total)}</div>
      </div>

      <!-- Payment methods -->
      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #0c6da4;">Payment Methods</h3>
        <p style="font-size: 12px; color: #888; margin: 0 0 12px;">Please send to <strong style="color: #333;">Mother Nature Agency LLC</strong></p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #666;">PayPal</td>
            <td style="padding: 6px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">mn@mothernatureagency.com</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #666;">Zelle</td>
            <td style="padding: 6px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">mn@mothernatureagency.com</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 12px 0 4px; font-size: 13px; font-weight: 700; color: #0c6da4;">Bank of America — Mother Nature Agency LLC</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #666;">Account #</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">898165120338</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #666;">ACH Routing #</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">063100277</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: #666;">Wire Routing #</td>
            <td style="padding: 4px 0; font-size: 13px; color: #333; font-weight: 600; text-align: right;">026009593</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 6px 0 0; font-size: 11px; color: #e65100; font-weight: 600;">* Please add $20 wire fee if sending via wire transfer</td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #666; margin: 12px 0 0;">Checks payable to: <strong style="color: #333;">Mother Nature Agency LLC / Alexus Williams</strong></p>
      </div>

      ${invoice.notes ? `
      <div style="font-size: 13px; color: #888; line-height: 1.6; margin-bottom: 16px;">
        <strong>Notes:</strong> ${invoice.notes}
      </div>` : ''}

      <p style="font-size: 13px; color: #888; margin: 24px 0 0; line-height: 1.6;">
        If you have any questions about this invoice, please reply to this email or reach out to us at
        <a href="mailto:mn@mothernatureagency.com" style="color: #0c6da4; text-decoration: none;">mn@mothernatureagency.com</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #999; margin: 0;">Mother Nature Agency</p>
      <p style="font-size: 11px; color: #bbb; margin: 4px 0 0;">
        <a href="https://portal.mothernatureagency.com/client/invoices" style="color: #999; text-decoration: none;">View in Portal</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(invoice: InvoiceData): Promise<{ success: boolean; error?: string }> {
  const clientEmail = getClientEmail(invoice.client_id);
  if (!clientEmail) {
    console.warn(`[invoice-email] No billing email for client: ${invoice.client_id}`);
    return { success: false, error: `No billing email configured for client ${invoice.client_id}` };
  }

  const clientName = getClientName(invoice.client_id);
  const subject = `Invoice ${invoice.invoice_number} — ${invoice.title} | Mother Nature Agency`;

  const html = buildInvoiceEmailHtml(invoice);

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    replyTo: 'mn@mothernatureagency.com',
  });
}
