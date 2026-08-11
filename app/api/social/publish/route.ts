import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { clients as staticClients } from '@/lib/clients';
import { postformePublish, platformsFor, platformBase, mediaForPost, isVideoUrl, isVideoOnlyPlatform } from '@/lib/postforme';
import { applyMergeVars, effectiveVars, deriveLocation } from '@/lib/merge-vars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Publish one content_calendar post to social now, via Post for Me.
 * Staff-triggered. Never auto-runs.
 *
 * POST { id, clientId }
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can publish' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = (body?.id || '').toString();
  const clientId = (body?.clientId || '').toString();
  if (!id || !clientId) return NextResponse.json({ error: 'id and clientId required' }, { status: 400 });

  const { rows } = await query<any>(
    `select id, platform, caption, title, photo_drive_url, photo_urls, assigned_role from content_calendar where id = $1`,
    [id],
  );
  const post = rows[0];
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (String(post.assigned_role || '') === 'PDM (Brand)') {
    // PDM brand posts are corporate's job by default — but a client can opt in
    // to have us push them (for locations corporate isn't covering).
    const { rows: opt } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'pdm_autopost'`, [clientId]);
    if (opt[0]?.value !== true) {
      return NextResponse.json({ error: 'PDM brand-cascade posts are published by corporate. To push them for this location, enable "Auto-post PDM posts" in the Content Tracker first.' }, { status: 400 });
    }
  }

  const platforms = platformsFor(post.platform);
  if (platforms.length === 0) return NextResponse.json({ error: `No connected platform for "${post.platform}".` }, { status: 400 });

  const media = mediaForPost(post);
  if (platforms.includes('instagram') && media.length === 0) {
    return NextResponse.json({ error: 'Instagram needs an image/video. Upload one to this post (a Drive link won\'t work), then publish.' }, { status: 400 });
  }
  // TikTok / YouTube can only post video.
  if (platforms.some(isVideoOnlyPlatform) && !media.some(isVideoUrl)) {
    const which = platforms.filter(isVideoOnlyPlatform).join('/');
    return NextResponse.json({ error: `${which} posts require a video. Upload an mp4 to this post, then publish.` }, { status: 400 });
  }

  // Only post to the accounts this client is explicitly assigned to, matching
  // the post's platform. No assignment → we refuse rather than guess.
  const { rows: kv } = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = 'postforme_accounts'`,
    [clientId],
  );
  const assigned: { id: string; platform: string }[] = Array.isArray(kv[0]?.value) ? kv[0].value : [];
  const accountIds = assigned.filter((a) => platforms.includes(platformBase(a.platform))).map((a) => a.id);
  if (accountIds.length === 0) {
    return NextResponse.json({ error: `No ${platforms.join('/')} account is assigned to this client. Tick the right account in the Content Tracker's Social auto-post bar first.` }, { status: 400 });
  }

  // Localize the caption for this client (swap {{linktree}}, {{location}}, …).
  let displayName = staticClients.find((c) => c.id === clientId)?.name || '';
  if (!displayName) {
    const { rows: cc } = await query<{ name: string }>(`select name from custom_clients where id = $1`, [clientId]);
    displayName = cc[0]?.name || '';
  }
  const { rows: mv } = await query<{ value: any }>(`select value from client_kv where client_id = $1 and key = 'merge_vars'`, [clientId]);
  const vars = effectiveVars(mv[0]?.value, { location: deriveLocation(displayName) });
  const caption = applyMergeVars((post.caption || '').toString(), vars);
  const result = await postformePublish({ accountIds, caption, mediaUrls: media });

  if (!result.ok) {
    await query(
      `update content_calendar set publish_status = 'failed', publish_error = $1 where id = $2`,
      [result.error.slice(0, 500), id],
    );
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await query(
    `update content_calendar set publish_status = 'posted', published_at = now(), publish_ref = $1, publish_error = null where id = $2`,
    [String(result.id), id],
  );
  return NextResponse.json({ ok: true, ref: result.id, platforms });
}
