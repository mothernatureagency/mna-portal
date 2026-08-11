import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';
import { postformePublish, postformeRawAccounts, platformsFor, platformBase, mediaFor, isVideoUrl, isVideoOnlyPlatform } from '@/lib/postforme';
import { clientTimezone, slotTimeUtc } from '@/lib/social-schedule';
import { applyMergeVars, effectiveVars, deriveLocation, type MergeVars } from '@/lib/merge-vars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scheduled auto-post runner. Meant to run each morning (daily Vercel Cron).
 * For every approved, auto-post-enabled local post whose date has arrived, it
 * hands the post to Post for Me at that location's best local-time window —
 * scheduling ahead when the window is later today, or posting immediately when
 * it has already passed. Same-day posts for a location stagger across windows.
 * Protected by ?secret=SEED_SECRET. PDM cascade posts are never touched.
 */

async function clientIdForName(name: string): Promise<string | null> {
  const s = staticClients.find((c) => c.name === name || c.shortName === name);
  if (s) return s.id;
  const { rows } = await query<{ id: string }>(`select id from custom_clients where name = $1 limit 1`, [name]);
  return rows[0]?.id || null;
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
  if (!process.env.POST_FOR_ME_API_KEY) {
    return NextResponse.json({ error: 'POST_FOR_ME_API_KEY not set — auto-posting is not configured yet.', posted: 0 }, { status: 200 });
  }

  // Diagnostic: ?debug=1 dumps the raw Post for Me account pool (no filtering).
  if (req.nextUrl.searchParams.get('debug')) {
    return NextResponse.json(await postformeRawAccounts());
  }

  const { rows: due } = await query<any>(
    `select cc.id, cc.platform, cc.caption, cc.photo_drive_url,
            to_char(cc.post_date, 'YYYY-MM-DD') as post_date, p.client_name
       from content_calendar cc
       join projects p on p.id = cc.project_id
      where cc.auto_post = true
        and coalesce(cc.publish_status, '') not in ('posted', 'scheduled')
        and cc.client_approval_status in ('approved', 'scheduled')
        and cc.assigned_role is distinct from 'PDM (Brand)'
        and cc.post_date <= current_date
      order by cc.post_date asc, cc.id asc
      limit 50`,
  );

  // Per-client account assignment + timezone override (cached).
  const assignCache = new Map<string, { id: string; platform: string }[]>();
  const tzCache = new Map<string, string>();
  async function assignedFor(clientId: string) {
    if (!assignCache.has(clientId)) {
      const { rows } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'postforme_accounts'`, [clientId]);
      assignCache.set(clientId, Array.isArray(rows[0]?.value) ? rows[0].value : []);
    }
    return assignCache.get(clientId)!;
  }
  async function tzFor(clientId: string) {
    if (!tzCache.has(clientId)) {
      const { rows } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'timezone'`, [clientId]);
      tzCache.set(clientId, clientTimezone(clientId, typeof rows[0]?.value === 'string' ? rows[0].value : null));
    }
    return tzCache.get(clientId)!;
  }
  const mvCache = new Map<string, MergeVars>();
  async function varsFor(clientId: string, clientName: string) {
    if (!mvCache.has(clientId)) {
      const { rows } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'merge_vars'`, [clientId]);
      mvCache.set(clientId, effectiveVars(rows[0]?.value, { location: deriveLocation(clientName) }));
    }
    return mvCache.get(clientId)!;
  }

  // Resolve each post's client, then index same-day posts per location so we
  // can stagger them across the day's best windows.
  const nameToId = new Map<string, string | null>();
  const dayIndex = new Map<string, number>(); // key: clientId|date → next slot index
  const now = Date.now();
  let posted = 0, scheduled = 0, failed = 0, skipped = 0;

  for (const post of due) {
    const platforms = platformsFor(post.platform);
    const media = mediaFor(post.photo_drive_url);
    if (platforms.length === 0 || (platforms.includes('instagram') && media.length === 0)) { skipped++; continue; }
    // TikTok / YouTube need a video — skip if there isn't one.
    if (platforms.some(isVideoOnlyPlatform) && !media.some(isVideoUrl)) { skipped++; continue; }

    if (!nameToId.has(post.client_name)) nameToId.set(post.client_name, await clientIdForName(post.client_name));
    const clientId = nameToId.get(post.client_name);
    if (!clientId) { skipped++; continue; }

    const assigned = await assignedFor(clientId);
    const accountIds = assigned.filter((a) => platforms.includes(platformBase(a.platform))).map((a) => a.id);
    if (accountIds.length === 0) { skipped++; continue; }

    // This post's staggered window for the day.
    const dayKey = `${clientId}|${post.post_date}`;
    const idx = dayIndex.get(dayKey) || 0;
    dayIndex.set(dayKey, idx + 1);
    const target = slotTimeUtc(post.post_date, idx, await tzFor(clientId));
    const inFuture = target.getTime() > now + 60_000; // >1 min out → hand off to Post for Me
    const scheduleISO = inFuture ? target.toISOString() : undefined;

    const vars = await varsFor(clientId, post.client_name);
    const caption = applyMergeVars((post.caption || '').toString(), vars);
    const result = await postformePublish({ accountIds, caption, mediaUrls: media, scheduleISO });
    if (result.ok) {
      if (inFuture) {
        await query(`update content_calendar set publish_status='scheduled', scheduled_for=$1, publish_ref=$2, publish_error=null where id=$3`, [target.toISOString(), String(result.id), post.id]);
        scheduled++;
      } else {
        await query(`update content_calendar set publish_status='posted', published_at=now(), scheduled_for=null, publish_ref=$1, publish_error=null where id=$2`, [String(result.id), post.id]);
        posted++;
      }
    } else {
      await query(`update content_calendar set publish_status='failed', publish_error=$1 where id=$2`, [result.error.slice(0, 500), post.id]);
      failed++;
    }
  }

  return NextResponse.json({ posted, scheduled, failed, skipped, considered: due.length });
}
