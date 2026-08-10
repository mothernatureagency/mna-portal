import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { postformeListAccounts } from '@/lib/postforme';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * List a client's connected Post for Me social accounts (grouped by
 * external_id = clientId). Staff-triggered; used by the Content Tracker's
 * "connect socials" panel to show what's linked.
 *
 * GET ?clientId=...
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can view connected accounts' }, { status: 403 });

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const configured = !!process.env.POST_FOR_ME_API_KEY;
  const accounts = configured ? await postformeListAccounts(clientId) : [];
  return NextResponse.json({ ok: true, configured, accounts });
}
