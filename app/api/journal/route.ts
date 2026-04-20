import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { isMNAStaff } from '@/lib/staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kids' journal API.
 *
 * GET    /api/journal?ownerEmail=marissa@...
 *   Lists entries the caller is allowed to see:
 *     - The kid (owner) sees ALL their own entries
 *     - Mom (mn@) + MNA staff see entries shared 'mom' or 'both'
 *     - Anyone with the kid's passcode (passed via x-journal-code) sees all
 *
 * POST   /api/journal      { ownerEmail, author, title?, body, mood?, shared? }
 * PATCH  /api/journal      { id, title?, body?, mood?, shared? }
 * DELETE /api/journal?id=...
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
  const ownerEmail = req.nextUrl.searchParams.get('ownerEmail');
  if (!ownerEmail) return NextResponse.json({ error: 'ownerEmail required' }, { status: 400 });
  const me = await callerEmail();
  const isOwner = me.toLowerCase() === ownerEmail.toLowerCase();
  const isMom = isMNAStaff(me);
  // Optional passcode unlock — if a kid set a code, anyone (including mom)
  // who passes the code can read the full journal.
  const passcode = req.headers.get('x-journal-code') || '';
  let unlocked = false;
  if (passcode) {
    const { rows } = await query<{ value: any }>(
      `select value from client_kv where client_id = $1 and key = $2`,
      [ownerEmail, 'journal_code'],
    );
    const stored = rows[0]?.value;
    if (stored && String(stored).trim() === passcode.trim()) unlocked = true;
  }

  let where = 'owner_email = $1';
  const params: any[] = [ownerEmail];
  if (!isOwner && !unlocked) {
    if (isMom) {
      params.push(...['mom', 'both']);
      where += ` and shared in ($${params.length - 1}, $${params.length})`;
    } else {
      // Caller is neither the kid nor mom nor unlocked → see nothing
      return NextResponse.json({ entries: [], hasCode: false });
    }
  }

  const { rows } = await query(
    `select id, owner_email, author, title, body, mood, shared, created_at, updated_at
       from journal_entries where ${where}
      order by created_at desc`,
    params,
  );

  // Tell the UI whether a code is set on this journal so it can render
  // the lock screen for the owner if they want it.
  const { rows: codeRow } = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = $2`,
    [ownerEmail, 'journal_code'],
  );
  const hasCode = !!(codeRow[0]?.value);

  return NextResponse.json({ entries: rows, hasCode, unlocked: isOwner || unlocked });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { ownerEmail, author, title, body, mood, shared } = b || {};
  if (!ownerEmail || !body) return NextResponse.json({ error: 'ownerEmail and body required' }, { status: 400 });
  const me = await callerEmail();
  // Author defaults: if caller is the owner → 'kid'; if caller is mom → 'mom'; explicit override allowed otherwise
  const finalAuthor = author || (me.toLowerCase() === ownerEmail.toLowerCase() ? 'kid' : isMNAStaff(me) ? 'mom' : 'kid');
  const { rows } = await query(
    `insert into journal_entries (owner_email, author, title, body, mood, shared)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [ownerEmail, finalAuthor, title || null, body, mood || null, shared || 'none'],
  );
  return NextResponse.json({ entry: rows[0] });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, title, body, mood, shared } = b || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const fields: string[] = [];
  const values: any[] = [];
  if (title  !== undefined) { values.push(title);  fields.push(`title = $${values.length}`); }
  if (body   !== undefined) { values.push(body);   fields.push(`body = $${values.length}`); }
  if (mood   !== undefined) { values.push(mood);   fields.push(`mood = $${values.length}`); }
  if (shared !== undefined) { values.push(shared); fields.push(`shared = $${values.length}`); }
  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await query(
    `update journal_entries set ${fields.join(', ')} where id = $${values.length} returning *`,
    values,
  );
  return NextResponse.json({ entry: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from journal_entries where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
