/** Shared by approval gates and previews. Counts GSM extension characters as two septets. */
const GSM = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));
export function smsSegments(text: string, tollFree = false) {
  let units = 0;
  let unicode = false;
  for (const char of text) {
    if (GSM.has(char)) units++;
    else if (EXTENDED.has(char)) units += 2;
    else { unicode = true; break; }
  }
  if (unicode) units = text.length; // UTF-16 units, including surrogate pairs.
  const single = unicode ? 70 : 160;
  const multi = unicode ? (tollFree ? 66 : 67) : (tollFree ? 152 : 153);
  let segments = units === 0 ? 0 : 1;
  if (units > single) {
    let used = 0;
    for (const char of text) {
      const width = unicode ? char.length : EXTENDED.has(char) ? 2 : 1;
      if (used + width > multi) { segments++; used = 0; }
      used += width;
    }
  }
  return { encoding: unicode ? 'UCS-2' : 'GSM-7', units, segments };
}
export function smsVariants(body: string): string[] {
  // Anchor headings so NON-MEMBER never matches MEMBER and normal prose stays intact.
  const parts = body.split(/^\s*(?:NON[- ]?MEMBER|MEMBER)\s+COPY\s*:\s*$/gim).map(x => x.trim()).filter(Boolean);
  return parts.length ? parts : [];
}
export function publicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
  } catch { return false; }
}
export function campaignIssues(c: { campaign_type: string; body?: string | null; subject?: string | null }): string[] {
  const issues: string[] = [];
  const body = c.body?.trim() || '';
  if (!body) return ['Add final campaign copy.'];
  if (/[\u2013\u2014]/.test(body)) issues.push('Replace em/en dashes with natural punctuation.');
  const variants = c.campaign_type === 'sms' ? smsVariants(body) : [body];
  for (const [i, copy] of Array.from(variants.entries())) {
    const label = variants.length > 1 ? `Version ${i + 1}: ` : '';
    const urls = copy.match(/https:\/\/[^\s<>"')]+/g) || [];
    if (!urls.some(publicHttpsUrl)) issues.push(label + 'Add a complete HTTPS booking or offer link.');
    if (/\{\{(?!unsubscribe_link\}\})[^}]+\}\}|\[(?:link|url|offer|price|insert)[^\]]*\]/i.test(copy)) issues.push(label + 'Resolve unfinished placeholders.');
    if (c.campaign_type === 'sms') {
      if (!/reply\s+STOP\s+to\s+(?:opt\s*out|unsubscribe)/i.test(copy)) issues.push(label + 'Include Reply STOP to opt out.');
      if (smsSegments(copy).segments > 1) issues.push(label + 'Shorten to one SMS segment before approval.');
    }
  }
  if (c.campaign_type === 'email') {
    if (!c.subject?.trim()) issues.push('Add an email subject.');
    if (!/\{\{unsubscribe_link\}\}|unsubscribe/i.test(body)) issues.push('Add an unsubscribe link.');
  }
  return Array.from(new Set(issues));
}
export const COPY_STYLE = 'Write warm, specific, natural copy. No em dashes or en dashes. No generic AI filler. No invented urgency, prices, offers, statistics, availability, or health claims. Keep exact product names. SMS: plain GSM-7 text, business name, one verified HTTPS CTA, Reply STOP to opt out, one segment including the link. Missing facts must be requested, never guessed.';

/** Optimistic review snapshot: reject approval if any reviewed field changed. */
export function campaignReviewVersion(c: Record<string, unknown>): string {
  return JSON.stringify(['name','campaign_type','subject','body','scheduled_date','scheduled_time','audience_segment','audience_count'].map(k => c[k] ?? null));
}
