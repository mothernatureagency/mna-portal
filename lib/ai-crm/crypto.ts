import crypto from 'crypto';

/**
 * AES-256-GCM encryption for GoHighLevel / Revive private integration tokens.
 * Tokens are encrypted at rest and only ever decrypted server-side, right
 * before an API call. They are never returned to the browser.
 *
 * Key: AI_TOKEN_ENCRYPTION_KEY env var (any string — it's stretched with
 * SHA-256 into a 32-byte key). Rotating the key invalidates stored tokens;
 * re-save them in the location settings UI after rotating.
 */

function getKey(): Buffer {
  const secret = process.env.AI_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('AI_TOKEN_ENCRYPTION_KEY is not set — required to store CRM tokens.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptToken(stored: string): string {
  const [version, ivB64, tagB64, ctB64] = stored.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Unrecognized token format');
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Constant-time string comparison for webhook secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
