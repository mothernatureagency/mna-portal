import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import {
  RFAD_ALL_ITEMS,
  RFAD_KEY,
  RFAD_OWNERS,
  normalizeRfad,
  rfadProgress,
  type RfadState,
} from '@/lib/rfad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * RFAD progress for one client.
 *
 * GET  ?clientId=…            → { state, progress }
 * PUT  { clientId, itemId, done?, value? }
 *
 * Ticking an item hands the follow-up to whoever owns it — a row in
 * client_requests assigned to Social, Manager or Ads. Dispatched ids are
 * recorded on the state so re-ticking never files the same task twice.
 */

function accessibleClientIds(meta: Record<string, unknown>): string[] {
  const ids = String((meta.client_ids as string) || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const single = (meta.client_id as string) || '';
  if (single && !ids.includes(single)) ids.push(single);
  return ids;
}

async function readState(clientId: string): Promise<RfadState> {
  const { rows } = await query<{ value: unknown }>(
    `select value from client_kv where client_id = $1 and key = $2`,
    [clientId, RFAD_KEY],
  );
  return normalizeRfad(rows[0]?.value);
}

async function writeState(clientId: string, state: RfadState) {
  await query(
    `insert into client_kv (client_id, key, value, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (client_id, key) do update set value = excluded.value, updated_at = now()`,
    [clientId, RFAD_KEY, JSON.stringify(state)],
  );
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const clientId = req.nextUrl.searchParams.get('clientId') || '';

  // Staff overview: progress for every client that has started an RFAD.
  if (!clientId) {
    if (role === 'client') return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    const { rows } = await query<{ client_id: string; value: unknown }>(
      `select client_id, value from client_kv where key = $1`,
      [RFAD_KEY],
    );
    return NextResponse.json({
      all: rows.map((r) => {
        const st = normalizeRfad(r.value);
        return { clientId: r.client_id, progress: rfadProgress(st), completedAt: st.completedAt || null, startedAt: st.startedAt || null };
      }),
    });
  }
  if (role === 'client' && !accessibleClientIds(meta).includes(clientId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const state = await readState(clientId);
  return NextResponse.json({ state, progress: rfadProgress(state) });
}

export async function PUT(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, itemId, done, value } = body || {};
  if (!clientId || !itemId) return NextResponse.json({ error: 'clientId and itemId required' }, { status: 400 });
  if (role === 'client' && !accessibleClientIds(meta).includes(clientId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const item = RFAD_ALL_ITEMS.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 400 });

  const state = await readState(clientId);
  if (!state.startedAt) state.startedAt = new Date().toISOString();

  const prev = state.items[itemId] || {};
  const nowDone = done === undefined ? prev.done === true : done === true;
  state.items[itemId] = {
    ...prev,
    done: nowDone,
    ...(value !== undefined ? { value: String(value).slice(0, 500) } : {}),
    completedAt: nowDone ? (prev.completedAt || new Date().toISOString()) : undefined,
  };

  // Hand the follow-up to whoever owns this item — once, on first completion.
  const dispatched = new Set(state.dispatched || []);
  let assignedTo: string | null = null;
  if (nowDone && !dispatched.has(itemId)) {
    const owner = RFAD_OWNERS[item.owner];
    try {
      await query(
        `insert into client_requests (client_id, title, description, assigned_to)
         values ($1, $2, $3, $4)`,
        [
          clientId,
          `${item.task}`,
          `Onboarding (RFAD) — the client marked "${item.label}" complete.` +
            (state.items[itemId]?.value ? `\n\nThey provided: ${state.items[itemId]!.value}` : ''),
          owner.email,
        ],
      );
      dispatched.add(itemId);
      assignedTo = owner.email;
    } catch { /* never block the checkbox on task creation */ }
  }
  state.dispatched = Array.from(dispatched);

  const progress = rfadProgress(state);
  state.completedAt = progress.done === progress.total ? (state.completedAt || new Date().toISOString()) : undefined;

  await writeState(clientId, state);
  return NextResponse.json({ state, progress, assignedTo });
}
