import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Call Copilot session persistence.
 *
 * The live copilot keeps the transcript + cues in React state only, so they
 * vanish on Stop / refresh. These endpoints save a finished session — the
 * transcript ("notes") plus every cue it surfaced — scoped to the signed-in
 * staff user, so they can be reviewed later.
 *
 * GET    /api/copilot/sessions        → list the caller's sessions (no transcript/signals)
 * GET    /api/copilot/sessions?id=... → one full session (transcript + signals)
 * POST   /api/copilot/sessions        → { title?, transcript, signals, startedAt?, endedAt?, clientId? }
 * DELETE /api/copilot/sessions?id=... → delete one of the caller's sessions
 */

async function callerEmail(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || '';
  } catch { return ''; }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const me = await callerEmail();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const { rows } = await query(
      `select id, owner_email, title, transcript, signals, client_id, started_at, ended_at, created_at
         from copilot_sessions where id = $1 and lower(owner_email) = lower($2)`,
      [id, me],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ session: rows[0] });
  }

  // List view omits the heavy transcript/signals columns; includes a cue count.
  const { rows } = await query(
    `select id, title, client_id, started_at, ended_at, created_at,
            coalesce(jsonb_array_length(signals), 0) as cue_count
       from copilot_sessions
      where lower(owner_email) = lower($1)
      order by created_at desc`,
    [me],
  );
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const me = await callerEmail();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { title, transcript, signals, startedAt, endedAt, clientId } = body || {};

  const transcriptStr = typeof transcript === 'string' ? transcript.trim() : '';
  const signalArr = Array.isArray(signals) ? signals : [];
  // Nothing worth saving → don't create an empty row.
  if (!transcriptStr && signalArr.length === 0) {
    return NextResponse.json({ error: 'nothing to save' }, { status: 400 });
  }

  const { rows } = await query(
    `insert into copilot_sessions (owner_email, title, transcript, signals, client_id, started_at, ended_at)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7) returning id, title, client_id, started_at, ended_at, created_at`,
    [
      me,
      (typeof title === 'string' && title.trim()) ? title.trim() : null,
      transcriptStr || null,
      JSON.stringify(signalArr),
      clientId || null,
      startedAt ? new Date(startedAt).toISOString() : null,
      endedAt ? new Date(endedAt).toISOString() : null,
    ],
  );
  return NextResponse.json({ session: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const me = await callerEmail();
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from copilot_sessions where id = $1 and lower(owner_email) = lower($2)', [id, me]);
  return NextResponse.json({ ok: true });
}
