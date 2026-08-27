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
    } else if (r.status === 403) {
      notes.push('Search Console permission missing — reconnect Google so the new scope is granted.');
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
    } else if (r.status === 403) {
      notes.push('Analytics permission missing — reconnect Google so the new scope is granted.');
    }
  } catch { notes.push('Could not reach Google Analytics.'); }

  return NextResponse.json({ gsc, ga4, connected: true, account, notes });
}
