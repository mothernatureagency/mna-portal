/**
 * Minimal Stripe client over fetch — Checkout Sessions and webhook
 * signature checks are all the invoicing flow needs, so no SDK.
 *
 * Requires STRIPE_SECRET_KEY; the webhook route also needs STRIPE_WEBHOOK_SECRET.
 */

import crypto from 'crypto';

const API = 'https://api.stripe.com/v1';

// Stripe takes form-encoded bodies with bracketed keys: line_items[0][price_data][currency]=usd
function encode(obj: Record<string, any>, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

async function stripePost<T = any>(path: string, params: Record<string, any>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encode(params).join('&'),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data as T;
}

export function createCheckoutSession(params: Record<string, any>) {
  return stripePost<{ id: string; url: string }>('/checkout/sessions', params);
}

/**
 * Verify a webhook's Stripe-Signature header against the raw body.
 * Returns the parsed event, or null when the signature doesn't check out.
 */
export function verifyWebhook(rawBody: string, header: string | null, toleranceSec = 300): any | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;

  const parts = header.split(',').map(p => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || sigs.length === 0) return null;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return null;

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const ok = sigs.some(s =>
    s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))
  );
  if (!ok) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}
