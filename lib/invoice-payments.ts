/**
 * Shared helpers for paying invoices online: pay links, the card fee,
 * client billing emails, and recording a payment.
 */

import crypto from 'crypto';
import { query } from './db';

export const PORTAL_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.mothernatureagency.com').replace(/\/$/, '');

// Percent added when a client pays by credit card. Bank (ACH) payments carry no fee.
// Default 0: the agency absorbs card fees. Set INVOICE_CARD_FEE_PERCENT to pass them on.
export const CARD_FEE_PERCENT = (() => {
  const n = Number(process.env.INVOICE_CARD_FEE_PERCENT ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
})();

export function cardFee(total: number): number {
  return Math.round(total * CARD_FEE_PERCENT) / 100;
}

// Legacy hardcoded billing contacts — used only when no billing_email is saved for the client.
const FALLBACK_BILLING_EMAILS: Record<string, string> = {
  'prime-iv': 'jkulkusky@primeivhydration.com',
  'prime-iv-destin': 'jkulkusky@primeivhydration.com',
};

/** Billing emails for a client, from client_kv 'billing_email' (comma-separated allowed). */
export async function getBillingEmails(clientId: string): Promise<string[]> {
  const { rows } = await query<{ value: unknown }>(
    `select value from client_kv where client_id = $1 and key = 'billing_email'`,
    [clientId]
  );
  const raw = typeof rows[0]?.value === 'string' ? (rows[0].value as string) : FALLBACK_BILLING_EMAILS[clientId] || '';
  return raw.split(',').map(s => s.trim()).filter(s => /.+@.+\..+/.test(s));
}

/** Returns the invoice's pay token, creating one the first time. */
export async function ensurePayToken(invoiceId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('base64url');
  const { rows } = await query<{ pay_token: string }>(
    `update invoices set pay_token = coalesce(pay_token, $2) where id = $1 returning pay_token`,
    [invoiceId, token]
  );
  return rows[0].pay_token;
}

export function payUrl(invoiceId: string, token: string): string {
  return `${PORTAL_URL}/pay/${invoiceId}?t=${encodeURIComponent(token)}`;
}

export function tokenMatches(stored: string | null, given: string | null): boolean {
  if (!stored || !given) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Today's date (YYYY-MM-DD) in the agency's timezone. */
export function todayCentral(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

/**
 * Mark an invoice paid from a completed online (Square) payment. Idempotent:
 * returns the updated row the first time, null if it was already paid or not found.
 */
export async function recordOnlinePayment(invoiceId: string, method: 'bank' | 'card', paymentId: string) {
  const { rows } = await query(
    `update invoices
        set status = 'paid', payment_status = 'paid', paid_date = $2,
            paid_amount = total, payment_method = $3, square_payment_id = $4
      where id = $1 and status <> 'paid'
      returning *`,
    [invoiceId, todayCentral(), method === 'card' ? 'Card (Square)' : 'Bank transfer (Square)', paymentId]
  );
  return rows[0] || null;
}
