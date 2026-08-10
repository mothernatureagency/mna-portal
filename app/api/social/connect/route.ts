import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { postformeAuthUrl } from '@/lib/postforme';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generate a Post for Me OAuth "connect" link for a client + platform.
 * The connected account is tagged with external_id = clientId so we can find
 * it again at post time. Staff-triggered; returns { url } to open.
 *
 * POST { clientId, platform }
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can connect social accounts' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clientId = (body?.clientId || '').toString();
  const platform = (body?.platform || '').toString();
  if (!clientId || !platform) return NextResponse.json({ error: 'clientId and platform required' }, { status: 400 });

  const result = await postformeAuthUrl(clientId, platform);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, url: result.url });
}
