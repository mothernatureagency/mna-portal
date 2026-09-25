import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Reviews AI queue for the dashboard. Session-authenticated.
 * GET /api/ai-crm/reviews?location=&status=&limit=
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const p = req.nextUrl.searchParams;
  const where: string[] = [];
  const vals: unknown[] = [];
  if (p.get('location')) { vals.push(p.get('location')); where.push(`r.ghl_location_id = $${vals.length}`); }
  if (p.get('status')) { vals.push(p.get('status')); where.push(`r.status = $${vals.length}`); }
  const limit = Math.min(200, Number(p.get('limit') || 100));
  const { rows } = await query(
    `select r.*, l.name as location_name
       from ai_review_queue r
       left join ghl_locations l on l.ghl_location_id = r.ghl_location_id
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by r.review_date desc nulls last, r.created_at desc
      limit ${limit}`,
    vals,
  );
  return NextResponse.json({ reviews: rows });
}
