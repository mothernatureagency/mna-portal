export const OPERATIONS_ROLES = [
  { id: 'claude-ceo', name: 'Claude co-CEO', responsibility: 'Operations brief, technical dependencies, prioritization and handoffs' },
  { id: 'openai-ceo', name: 'OpenAI co-CEO', responsibility: 'Copy direction, newsletter, SMS and channel consistency' },
  { id: 'social-manager', name: 'Social media manager', responsibility: 'Imported Diamond plan, social drafts and approval readiness' },
  { id: 'crm-manager', name: 'CRM and SMS manager', responsibility: 'Revive location readiness, inbound review queue and monthly SMS' },
  { id: 'ads-manager', name: 'Ads manager', responsibility: 'Saved performance metrics and recommendations for the human ads operator' },
  { id: 'operations-manager', name: 'Operations manager', responsibility: 'Missing information, overdue approvals and failed work' },
] as const;
export const ROLE_IDS = OPERATIONS_ROLES.map(x => x.id);
export function requireMonth(month: unknown): string {
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use a month in YYYY-MM format.');
  return month;
}
export function cleanText(value: unknown, max: number, label: string, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new Error(`${label} must be text, up to ${max} characters.`);
  return value.trim();
}
export function assertClientScope(clientId: string, allowed: string[] | null) {
  if (allowed !== null && !allowed.includes(clientId)) throw new Error('Client access denied.');
}
export function plainCopy(value: string): string {
  return value.replace(/[\u2013\u2014]/g, ',').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export type Pack = { subject: string; heading: string; paragraphs: string[]; cta: string; memberSms: string; prospectSms: string; social: { day: number; platform: string; caption: string }[]; ads: string[]; missing: string[] };
export function validatePack(input: unknown): Pack {
  if (!input || typeof input !== 'object') throw new Error('The copywriter returned an invalid draft.');
  const x = input as Record<string, any>;
  const strings = (v: unknown, max: number, length: number) => {
    if (!Array.isArray(v) || v.length > length) throw new Error('Invalid draft list.');
    return v.map(i => plainCopy(cleanText(i, max, 'Draft item')));
  };
  if (!Array.isArray(x.social) || x.social.length > 31) throw new Error('Invalid social draft list.');
  return {
    subject: plainCopy(cleanText(x.subject, 100, 'Subject')), heading: plainCopy(cleanText(x.heading, 160, 'Heading')),
    paragraphs: strings(x.paragraphs, 1500, 6), cta: plainCopy(cleanText(x.cta, 80, 'CTA')),
    memberSms: plainCopy(cleanText(x.memberSms, 1000, 'Member SMS')), prospectSms: plainCopy(cleanText(x.prospectSms, 1000, 'Prospect SMS')),
    social: x.social.map((p: any) => {
      if (!Number.isInteger(p.day) || p.day < 1 || p.day > 31) throw new Error('Invalid post day.');
      return { day: p.day, platform: cleanText(p.platform, 40, 'Platform'), caption: plainCopy(cleanText(p.caption, 2200, 'Caption')) };
    }), ads: strings(x.ads, 1500, 8), missing: strings(x.missing, 500, 15),
  };
}
export function newsletterHtml(pack: Pack, name: string, booking: string, address: string) {
  const e = escapeHtml;
  return `<!doctype html><html><body style="margin:0;background:#f2f5f4;font-family:Arial,sans-serif;color:#17352c"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:12px"><tr><td style="padding:32px"><p style="font-size:13px;letter-spacing:2px">${e(name)}</p><h1 style="font-size:30px;line-height:1.2">${e(pack.heading)}</h1>${pack.paragraphs.map(p => `<p style="font-size:16px;line-height:1.6">${e(p)}</p>`).join('')}<p style="padding:16px 0"><a href="${e(booking)}" style="background:#17352c;color:#fff;padding:14px 24px;border-radius:6px;text-decoration:none;display:inline-block">${e(pack.cta)}</a></p><hr style="border:0;border-top:1px solid #e2e8e5"><p style="font-size:12px;color:#65776e">${e(name)}<br>${e(address)}</p><p style="font-size:12px"><a href="{{unsubscribe_link}}">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;
}
