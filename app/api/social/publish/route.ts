import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { ayrsharePublish, platformsFor, mediaFor } from '@/lib/ayrshare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Publish one content_calendar post to social now, via Ayrshare.
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
    `select id, platform, caption, title, photo_drive_url, assigned_role from content_calendar where id = $1`,
    [id],
  );
  const post = rows[0];
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (String(post.assigned_role || '') === 'PDM (Brand)') {
    return NextResponse.json({ error: 'PDM brand-cascade posts are published by corporate — not from here.' }, { status: 400 });
  }

  const platforms = platformsFor(post.platform);
  if (platforms.length === 0) return NextResponse.json({ error: `No connected platform for "${post.platform}".` }, { status: 400 });

  const media = mediaFor(post.photo_drive_url);
  if (platforms.includes('instagram') && media.length === 0) {
    return NextResponse.json({ error: 'Instagram needs an image/video. Upload one to this post (a Drive link won\'t work), then publish.' }, { status: 400 });
  }

  // Client's Ayrshare profile key.
  const { rows: kv } = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = 'ayrshare_profile_key'`,
    [clientId],
  );
  const profileKey = typeof kv[0]?.value === 'string' ? kv[0].value : undefined;

  const caption = (post.caption || '').toString();
  const result = await ayrsharePublish({ profileKey, caption, mediaUrls: media, platforms });

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
