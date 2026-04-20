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
  const { rows } = await query<{ count: string }>(
    `with updated as (
       update content_calendar
          set client_approval_status = 'approved',
              assigned_role = 'PDM (Brand)',
              status = 'Reference',
              approved_at = coalesce(approved_at, now())
        where title like '[PDM%%'
          and (coalesce(assigned_role, '') <> 'PDM (Brand)'
               or coalesce(client_approval_status, '') <> 'approved')
        returning id
     )
     select count(*)::text as count from updated`,
  );
  return NextResponse.json({ migrated: Number(rows[0]?.count || 0) });
}
