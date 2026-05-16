import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/content-calendar/cleanup-duplicates?client=<name>
 *
 * Removes duplicate rows in content_calendar for the given client. A duplicate
 * is defined as another row with the SAME (project_id, post_date, platform, title).
 * For each duplicate group the row with the OLDEST created_at is kept; the rest
 * are deleted. Returns the number of removed rows.
 *
 * Safe to call repeatedly — when there are no duplicates the count is 0.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const clientName = req.nextUrl.searchParams.get('client');
  if (!clientName) return NextResponse.json({ error: 'client required' }, { status: 400 });

  const { rows } = await query<{ id: string }>(
    `with ranked as (
       select cc.id,
              row_number() over (
                partition by cc.project_id,
                             cc.post_date,
                             cc.platform,
                             coalesce(cc.title, '')
                order by cc.created_at asc, cc.id asc
              ) as rn
         from content_calendar cc
         join projects p on p.id = cc.project_id
        where p.client_name = $1
     )
     delete from content_calendar
      where id in (select id from ranked where rn > 1)
     returning id`,
    [clientName],
  );
  return NextResponse.json({ removed: rows.length });
}
