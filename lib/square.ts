/**
 * Minimal Square client over fetch — creating payments, reading them back,
 * and checking webhook signatures are all the invoicing flow needs.
 *
 * Env:
 *   SQUARE_ACCESS_TOKEN            server API token
 *   SQUARE_APPLICATION_ID          public; the pay page's payment form uses it
 *   SQUARE_LOCATION_ID             location payments are credited to
 *   SQUARE_ENVIRONMENT             'production' (default) or 'sandbox'
 *   SQUARE_WEBHOOK_SIGNATURE_KEY   from the webhook subscription
 *   SQUARE_WEBHOOK_URL             optional; the subscription's exact URL
 *                                  (default <portal>/api/square/webhook)
 */

import crypto from 'crypto';

const SANDBOX = process.env.SQUARE_ENVIRONMENT === 'sandbox';
const API = SANDBOX ? 'https://connect.squareupsandbox.com/v2' : 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2026-09-16';

export const SQUARE_SDK_URL = SANDBOX
  ? 'https://sandbox.web.squarecdn.com/v1/square.js'
  : 'https://web.squarecdn.com/v1/square.js';

export function squareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_LOCATION_ID);
}

/** What the browser payment form needs; none of it is secret. */
export function squarePublicConfig() {
  return {
    applicationId: process.env.SQUARE_APPLICATION_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || '',
    sdkUrl: SQUARE_SDK_URL,
  };
}

async function squareFetch<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN not configured');
  const res = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.errors?.[0];
    const err = new Error(e?.detail || e?.code || `Square error ${res.status}`) as Error & { code?: string };
    err.code = e?.code;
    throw err;
  }
  return data as T;
}

export interface SquarePayment {
  id: string;
  status: 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  source_type?: string; // 'CARD' | 'BANK_ACCOUNT' | 'WALLET' | ...
  reference_id?: string;
  amount_money?: { amount: number; currency: string };
}

export async function createPayment(params: {
  sourceId: string;
  idempotencyKey: string;
  amountCents: number;
  referenceId: string;
  note: string;
  buyerEmail?: string;
}): Promise<SquarePayment> {
  const { payment } = await squareFetch<{ payment: SquarePayment }>('/payments', {
    method: 'POST',
    body: {
      source_id: params.sourceId,
      idempotency_key: params.idempotencyKey,
      amount_money: { amount: params.amountCents, currency: 'USD' },
      location_id: process.env.SQUARE_LOCATION_ID,
      reference_id: params.referenceId,
      note: params.note.slice(0, 500),
      buyer_email_address: params.buyerEmail,
      autocomplete: true,
    },
  });
  return payment;
}

export function squareWebhookUrl(portalUrl: string): string {
  return process.env.SQUARE_WEBHOOK_URL || `${portalUrl}/api/square/webhook`;
}

/**
 * Verify a webhook: Square signs notificationUrl + rawBody with HMAC-SHA256
 * and sends it base64-encoded in x-square-hmacsha256-signature.
 */
export function verifySquareWebhook(rawBody: string, signature: string | null, notificationUrl: string): any | null {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return null;
  const expected = crypto.createHmac('sha256', key).update(notificationUrl + rawBody).digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}
