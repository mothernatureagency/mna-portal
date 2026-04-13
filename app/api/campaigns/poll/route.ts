import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — Make.com polls this to find approved campaigns ready to send
export async function GET() {
  await ensureSchema();
  const { rows } = await query(
    `select * from campaigns where status = 'approved' and sent_at is null order by scheduled_date asc`
  );
  return NextResponse.json({ campaigns: rows });
}

// PATCH — Make.com calls after successfully sending through Revive/Twilio
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, reviveCampaignId } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { rows } = await query(
    `update campaigns set status = 'sent', sent_at = now(), revive_campaign_id = $1 where id = $2 returning *`,
    [reviveCampaignId || null, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ campaign: rows[0] });
}
