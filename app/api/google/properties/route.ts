import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/google-calendar';
import { reportingAccount } from '@/lib/google-reporting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything the connected Google account can actually read.
 *
 * Search Console property strings are unguessable — a franchise location may
 * be a domain property (sc-domain:example.com), a URL-prefix property
 * (https://example.com/), or a subfolder of the corporate site granted to you
 * as a delegated user. Rather than have staff type one and hope, list what the
 * account genuinely has and let them pick.
 *
 * GET → { gsc: [{ siteUrl, permissionLevel }], ga4: [{ property, displayName, account }], connected }
 */
/**
 * A 403 from these APIs means one of two very different things, and the
 * distinction decides who fixes it: the API is switched off in our Google
 * Cloud project (our job, one click), or the account genuinely lacks access
 * (the client's or corporate's job). Read the reason rather than guessing.
 */
async function explain403(res: Response, label: string): Promise<string> {
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON error */ }
  const reason = body?.error?.details?.find((d: any) => d?.reason)?.reason;
  const url = body?.error?.details?.find((d: any) => d?.metadata?.activationUrl)?.metadata?.activationUrl;
  if (reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(body?.error?.message || '')) {
    return `${label} API is turned off in our Google Cloud project — enable it${url ? ` (${url})` : ''}, then reopen this panel.`;
  }
  if (res.status === 403) {
    return `${label}: this Google account doesn't have access yet — ask for it to be added as a user on the property.`;
  }
  return `${label}: ${body?.error?.message || `request failed (${res.status})`}`;
}

export async function GET() {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const account = await reportingAccount(user.email || undefined);
  if (!account) return NextResponse.json({ gsc: [], ga4: [], connected: false });

  const token = await getAccessToken(account);
  if (!token) return NextResponse.json({ gsc: [], ga4: [], connected: false });

  const auth = { Authorization: `Bearer ${token}` };
  const notes: string[] = [];

  // ── Search Console properties ──
  let gsc: { siteUrl: string; permissionLevel: string }[] = [];
  try {
    const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', { headers: auth });
    if (r.ok) {
      const d = await r.json();
      gsc = (d.siteEntry || []).map((s: any) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel || 'unknown',
      }));
    } else {
      notes.push(await explain403(r, 'Search Console'));
    }
  } catch { notes.push('Could not reach Search Console.'); }

  // ── GA4 properties ──
  let ga4: { property: string; displayName: string; account: string }[] = [];
  try {
    const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { headers: auth });
    if (r.ok) {
      const d = await r.json();
      for (const acc of d.accountSummaries || []) {
        for (const p of acc.propertySummaries || []) {
          ga4.push({
            property: String(p.property || '').replace(/^properties\//, ''),
            displayName: p.displayName || p.property,
            account: acc.displayName || '',
          });
        }
      }
    } else {
      notes.push(await explain403(r, 'Google Analytics'));
    }
  } catch { notes.push('Could not reach Google Analytics.'); }

  return NextResponse.json({ gsc, ga4, connected: true, account, notes });
}
