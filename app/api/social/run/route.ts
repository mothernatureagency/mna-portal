import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { ayrsharePublish } from '@/lib/ayrshare';
import { platformsFor } from '../publish/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scheduled auto-post runner. Publishes approved, auto-post-enabled local
 * posts whose date has arrived. Meant to be hit by a daily Vercel Cron.
 * Protected by ?secret=SEED_SECRET. PDM cascade posts are never touched.
 */

async function clientIdForName(name: string): Promise<string | null> {
  const s = staticClients.find((c) => c.name === name || c.shortName === name);
  if (s) return s.id;
  const { rows } = await query<{ id: string }>(`select id from custom_clients where name = $1 limit 1`, [name]);
  return rows[0]?.id || null;
}

function mediaFor(url: string | null): string[] {
  const u = (url || '').trim();
  if (!u || !/^https?:\/\//i.test(u) || /drive\.google\.com|docs\.google\.com/i.test(u)) return [];
  return [u];
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  // Auth: Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; also accept
  // ?secret=SEED_SECRET for manual runs.
  const authHeader = req.headers.get('authorization') || '';
  const secret = req.nextUrl.searchParams.get('secret') || '';
  const okCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const okSecret = !!process.env.SEED_SECRET && secret === process.env.SEED_SECRET;
  if (!okCron && !okSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.AYRSHARE_API_KEY) {
    return NextResponse.json({ error: 'AYRSHARE_API_KEY not set — auto-posting is not configured yet.', posted: 0 }, { status: 200 });
  }

  const { rows: due } = await query<any>(
    `select cc.id, cc.platform, cc.caption, cc.photo_drive_url, p.client_name
       from content_calendar cc
       join projects p on p.id = cc.project_id
      where cc.auto_post = true
        and coalesce(cc.publish_status, '') <> 'posted'
        and cc.client_approval_status in ('approved', 'scheduled')
        and cc.assigned_role is distinct from 'PDM (Brand)'
        and cc.post_date <= current_date
      order by cc.post_date asc
      limit 50`,
  );

  const profileCache = new Map<string, string | undefined>();
  let posted = 0, failed = 0, skipped = 0;

  for (const post of due) {
    const platforms = platformsFor(post.platform);
    const media = mediaFor(post.photo_drive_url);
    if (platforms.length === 0 || (platforms.includes('instagram') && media.length === 0)) { skipped++; continue; }

    const clientId = await clientIdForName(post.client_name);
    if (!clientId) { skipped++; continue; }
    if (!profileCache.has(clientId)) {
      const { rows } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'ayrshare_profile_key'`, [clientId]);
      profileCache.set(clientId, typeof rows[0]?.value === 'string' ? rows[0].value : undefined);
    }
    const profileKey = profileCache.get(clientId);

    const result = await ayrsharePublish({ profileKey, caption: (post.caption || '').toString(), mediaUrls: media, platforms });
    if (result.ok) {
      await query(`update content_calendar set publish_status='posted', published_at=now(), publish_ref=$1, publish_error=null where id=$2`, [String(result.id), post.id]);
      posted++;
    } else {
      await query(`update content_calendar set publish_status='failed', publish_error=$1 where id=$2`, [result.error.slice(0, 500), post.id]);
      failed++;
    }
  }

  return NextResponse.json({ posted, failed, skipped, considered: due.length });
}
