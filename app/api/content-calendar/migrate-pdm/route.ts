import { NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-shot idempotent migration: any content_calendar row whose title starts
 * with "[PDM" (seeded before the auto-approve fix landed) gets flipped to
 * approved + assigned_role='PDM (Brand)'. Safe to call repeatedly — the
 * WHERE clause skips already-migrated rows.
 */
export async function POST() {
  await ensureSchema();
  // title match: `LIKE E'[PDM%'` — ESCAPE the opening bracket isn't required in
  // standard LIKE, `[` is not a wildcard metachar in pg. Simple prefix match
  // `[PDM%` works. client_visible = true so the client portal sees them too
  // (they fill the calendar even though the client doesn't need to approve).
  const { rows } = await query<{ count: string }>(
    `with updated as (
       update content_calendar
          set client_approval_status = 'approved',
              assigned_role = 'PDM (Brand)',
              status = 'Reference',
              client_visible = true,
              approved_at = coalesce(approved_at, now())
        where title like '[PDM%'
          and (coalesce(assigned_role, '') <> 'PDM (Brand)'
               or coalesce(client_approval_status, '') <> 'approved'
               or client_visible is distinct from true)
        returning id
     )
     select count(*)::text as count from updated`,
  );
  return NextResponse.json({ migrated: Number(rows[0]?.count || 0) });
}
