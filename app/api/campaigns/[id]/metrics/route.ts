import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — fetch metrics for a campaign
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const { rows } = await query('select * from campaign_metrics where campaign_id = $1', [params.id]);
  return NextResponse.json({ metrics: rows[0] || null });
}

// PUT — upsert metrics (called by Make.com after syncing from Revive)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { recipients = 0, delivered = 0, bounced = 0, opened = 0, clicked = 0, unsubscribed = 0 } = body || {};
  const openRate = delivered > 0 ? ((opened / delivered) * 100) : 0;
  const clickRate = delivered > 0 ? ((clicked / delivered) * 100) : 0;

  const { rows } = await query(
    `insert into campaign_metrics (campaign_id, recipients, delivered, bounced, opened, clicked, unsubscribed, open_rate, click_rate, synced_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (campaign_id) do update set
       recipients = excluded.recipients, delivered = excluded.delivered,
       bounced = excluded.bounced, opened = excluded.opened,
       clicked = excluded.clicked, unsubscribed = excluded.unsubscribed,
       open_rate = excluded.open_rate, click_rate = excluded.click_rate,
       synced_at = now()
     returning *`,
    [params.id, recipients, delivered, bounced, opened, clicked, unsubscribed, openRate.toFixed(2), clickRate.toFixed(2)]
  );
  return NextResponse.json({ metrics: rows[0] });
}
