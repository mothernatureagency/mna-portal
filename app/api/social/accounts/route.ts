import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { postformeListAccounts } from '@/lib/postforme';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * List the whole Post for Me account pool plus this client's assignment.
 * Staff-triggered; used by the Content Tracker to let staff tick exactly which
 * accounts a client posts to (saved in client_kv 'postforme_accounts').
 *
 * GET ?clientId=...  →  { configured, accounts:[pool], selected:[assigned] }
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
  const accounts = configured ? await postformeListAccounts() : [];
  const { rows } = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = 'postforme_accounts'`,
    [clientId],
  );
  const selected = Array.isArray(rows[0]?.value) ? rows[0].value : [];
  return NextResponse.json({ ok: true, configured, accounts, selected });
}
