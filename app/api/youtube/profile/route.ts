import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * YouTube channel stats fetcher (public data only, no OAuth, no access to
 * the client's account needed).
 *
 * Two data sources, tried in order:
 *  1. YouTube Data API v3 — if YOUTUBE_API_KEY is set (most accurate, free).
 *  2. Apify scraper — if APIFY_TOKEN is set (the same token TikTok analytics
 *     already uses), scrapes the public channel page instead. Zero Google
 *     setup required.
 *
 * GET /api/youtube/profile?check=1
 *   Returns whether either source is configured.
 *
 * GET /api/youtube/profile?handle=@mrbeast&ownerKey=prime-iv
 *   Resolves handle → channel + latest videos with stats. Snapshots
 *   subscriber/view counts daily and returns velocity from history.
 */

const YT_KEY = process.env.YOUTUBE_API_KEY;
const YT = 'https://youtube.googleapis.com/youtube/v3';
// Same Apify account TikTok analytics uses — either env var name works.
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_KEY;

function normalizeHandle(input: string): { handle?: string; channelId?: string } {
  const s = (input || '').trim();
  if (!s) return {};
  // youtube.com/channel/UCxxxxxxxx
  const idMatch = s.match(/channel\/(UC[A-Za-z0-9_-]{20,})/i);
  if (idMatch) return { channelId: idMatch[1] };
  // Raw channel ID
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(s)) return { channelId: s };
  // youtube.com/@handle
  const handleMatch = s.match(/youtube\.com\/@?([A-Za-z0-9_.-]+)/i);
  if (handleMatch) return { handle: handleMatch[1].replace(/[/?].*$/, '') };
  // Plain @handle or handle
  return { handle: s.replace(/^@/, '').replace(/[/?].*$/, '') };
}

type ChannelLookup = {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  subscribers: number;
  totalViews: number;
  videosCount: number;
  uploadsPlaylistId: string | null;
  customUrl: string | null;
};

async function fetchChannel({ handle, channelId }: { handle?: string; channelId?: string }): Promise<ChannelLookup | { error: string }> {
  const part = 'snippet,statistics,contentDetails';
  const params = new URLSearchParams({ part, key: YT_KEY! });
  if (channelId) params.set('id', channelId);
  else if (handle) params.set('forHandle', `@${handle}`);
  else return { error: 'No handle or channel id provided' };

  const r = await fetch(`${YT}/channels?${params}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { error: data?.error?.message || `YouTube API ${r.status}` };

  const c = (data.items || [])[0];
  if (!c) {
    // Fallback: try search by name when forHandle returns nothing (covers
    // old custom URLs / legacy usernames).
    if (handle) {
      const sParams = new URLSearchParams({
        part: 'snippet', type: 'channel', q: handle, maxResults: '1', key: YT_KEY!,
      });
      const sr = await fetch(`${YT}/search?${sParams}`);
      const sd = await sr.json().catch(() => ({}));
      const sid = sd?.items?.[0]?.snippet?.channelId;
      if (sid) return fetchChannel({ channelId: sid });
    }
    return { error: 'No channel found for that handle' };
  }

  const stats = c.statistics || {};
  return {
    channelId: c.id,
    title: c.snippet?.title || '',
    description: c.snippet?.description || '',
    thumbnail: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || null,
    subscribers: Number(stats.subscriberCount || 0),
    totalViews: Number(stats.viewCount || 0),
    videosCount: Number(stats.videoCount || 0),
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || null,
    customUrl: c.snippet?.customUrl || null,
  };
}

type Video = {
  id: string;
  title: string;
  description: string;
  publishedAt: string | null;
  thumbnail: string | null;
  url: string;
  views: number;
  likes: number;
  comments: number;
  durationISO: string | null;
};

async function fetchRecentVideos(uploadsPlaylistId: string): Promise<Video[]> {
  // Step 1: get latest 20 video IDs from the uploads playlist.
  const plParams = new URLSearchParams({
    part: 'contentDetails,snippet', playlistId: uploadsPlaylistId, maxResults: '20', key: YT_KEY!,
  });
  const pl = await fetch(`${YT}/playlistItems?${plParams}`);
  const plData = await pl.json().catch(() => ({}));
  if (!pl.ok) return [];
  const ids: string[] = (plData.items || [])
    .map((i: any) => i.contentDetails?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return [];

  // Step 2: fetch stats + duration in one batch.
  const vParams = new URLSearchParams({
    part: 'snippet,statistics,contentDetails', id: ids.join(','), key: YT_KEY!,
  });
  const v = await fetch(`${YT}/videos?${vParams}`);
  const vData = await v.json().catch(() => ({}));
  if (!v.ok) return [];

  return (vData.items || []).map((it: any) => ({
    id: it.id,
    title: it.snippet?.title || '',
    description: it.snippet?.description || '',
    publishedAt: it.snippet?.publishedAt || null,
    thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
    url: `https://www.youtube.com/watch?v=${it.id}`,
    views: Number(it.statistics?.viewCount || 0),
    likes: Number(it.statistics?.likeCount || 0),
    comments: Number(it.statistics?.commentCount || 0),
    durationISO: it.contentDetails?.duration || null,
  }));
}

// Parse numbers that may arrive as strings with separators ("1,234,567").
function numFrom(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const digits = String(v ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Scrape the public channel page via Apify's YouTube scraper — no Google
 * key needed. Item fields vary a little between actor versions, so every
 * read is defensive with fallbacks.
 */
async function fetchViaApify({ handle, channelId }: { handle?: string; channelId?: string }):
  Promise<{ ch: ChannelLookup; videos: Video[] } | { error: string }> {
  const channelUrl = channelId
    ? `https://www.youtube.com/channel/${channelId}`
    : `https://www.youtube.com/@${handle}`;
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/streamers~youtube-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=180`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: channelUrl }],
          maxResults: 20,
          maxResultsShorts: 0,
          maxResultStreams: 0,
        }),
      },
    );
    if (!r.ok) {
      const txt = await r.text();
      return { error: `Apify returned ${r.status}: ${txt.slice(0, 300)}` };
    }
    const items: any[] = await r.json().catch(() => []);
    if (!Array.isArray(items) || items.length === 0) {
      return { error: 'No videos returned — the handle may be wrong or the channel has no public videos.' };
    }
    const first = items.find((i) => i?.channelName || i?.numberOfSubscribers != null) || items[0];
    const chId = first.channelId
      || String(first.channelUrl || '').match(/channel\/(UC[A-Za-z0-9_-]{20,})/)?.[1]
      || channelId || '';
    const ch: ChannelLookup = {
      channelId: chId,
      title: first.channelName || first.channelTitle || handle || '',
      description: first.channelDescription || '',
      thumbnail: first.channelAvatarUrl || first.avatarUrl || null,
      subscribers: numFrom(first.numberOfSubscribers ?? first.subscriberCount),
      totalViews: numFrom(first.channelTotalViews),
      videosCount: numFrom(first.channelTotalVideos) || items.length,
      uploadsPlaylistId: null,
      customUrl: first.channelUsername ? `@${String(first.channelUsername).replace(/^@/, '')}` : null,
    };
    const videos: Video[] = items
      .filter((v) => v?.id || v?.url)
      .map((v) => ({
        id: v.id || String(v.url || '').match(/[?&]v=([\w-]{6,})/)?.[1] || '',
        title: v.title || '',
        description: v.text || v.description || '',
        publishedAt: v.date || null,
        thumbnail: v.thumbnailUrl || null,
        url: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
        views: numFrom(v.viewCount),
        likes: numFrom(v.likes),
        comments: numFrom(v.commentsCount),
        durationISO: null,
      }))
      .filter((v) => v.url);
    return { ch, videos };
  } catch (e: any) {
    return { error: e?.message || 'Apify request failed' };
  }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  if (req.nextUrl.searchParams.get('check') === '1') {
    const configured = !!(YT_KEY || APIFY_TOKEN);
    return NextResponse.json({
      configured,
      error: configured ? null : 'Add APIFY_TOKEN (the same key TikTok analytics uses) or a free YOUTUBE_API_KEY to Vercel env vars.',
    });
  }
  if (!YT_KEY && !APIFY_TOKEN) {
    return NextResponse.json({ error: 'Neither YOUTUBE_API_KEY nor APIFY_TOKEN is set in env vars' }, { status: 500 });
  }

  const handleRaw = req.nextUrl.searchParams.get('handle');
  const ownerKey = req.nextUrl.searchParams.get('ownerKey');
  if (!handleRaw || !ownerKey) return NextResponse.json({ error: 'handle + ownerKey required' }, { status: 400 });

  const { handle, channelId } = normalizeHandle(handleRaw);
  if (!handle && !channelId) return NextResponse.json({ error: 'Could not parse handle' }, { status: 400 });

  // Official API when a Google key exists, else scrape the public page.
  let ch: ChannelLookup;
  let videos: Video[];
  if (YT_KEY) {
    const chRes = await fetchChannel({ handle, channelId });
    if ('error' in chRes) {
      // Return history if the lookup failed so the UI still shows trend data.
      const { rows } = await query(
        `select snapshot_date, subscribers, total_views, videos_count, top_videos
           from youtube_snapshots where owner_key = $1 order by snapshot_date desc limit 30`,
        [ownerKey],
      );
      return NextResponse.json({ error: chRes.error, history: rows }, { status: 500 });
    }
    ch = chRes;
    videos = ch.uploadsPlaylistId ? await fetchRecentVideos(ch.uploadsPlaylistId) : [];
  } else {
    const scraped = await fetchViaApify({ handle, channelId });
    if ('error' in scraped) {
      const { rows } = await query(
        `select snapshot_date, subscribers, total_views, videos_count, top_videos
           from youtube_snapshots where owner_key = $1 order by snapshot_date desc limit 30`,
        [ownerKey],
      );
      return NextResponse.json({ error: scraped.error, history: rows }, { status: 500 });
    }
    ch = scraped.ch;
    videos = scraped.videos;
  }
  const top = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);

  // Daily snapshot upsert
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `insert into youtube_snapshots
       (owner_key, handle, channel_id, snapshot_date, subscribers, total_views, videos_count, top_videos)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     on conflict (owner_key, snapshot_date) do update set
       handle = excluded.handle,
       channel_id = excluded.channel_id,
       subscribers = excluded.subscribers,
       total_views = excluded.total_views,
       videos_count = excluded.videos_count,
       top_videos = excluded.top_videos,
       captured_at = now()`,
    [ownerKey, handle || ch.customUrl || ch.channelId, ch.channelId, today,
     ch.subscribers, ch.totalViews, ch.videosCount, JSON.stringify(top)],
  );

  const { rows: hist } = await query<{
    snapshot_date: string; subscribers: string; total_views: string; videos_count: number;
  }>(
    `select snapshot_date, subscribers, total_views, videos_count
       from youtube_snapshots where owner_key = $1 order by snapshot_date asc`,
    [ownerKey],
  );
  function pick(cutoff: string) {
    const hit = hist.find((r) => r.snapshot_date >= cutoff);
    return hit
      ? { s: ch.subscribers - Number(hit.subscribers), v: ch.totalViews - Number(hit.total_views) }
      : { s: 0, v: 0 };
  }
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);

  return NextResponse.json({
    profile: {
      handle: handle || ch.customUrl || '',
      channelId: ch.channelId,
      displayName: ch.title,
      bio: ch.description,
      avatar: ch.thumbnail,
      subscribers: ch.subscribers,
      totalViews: ch.totalViews,
      videosCount: ch.videosCount,
    },
    videos,
    topVideos: top,
    velocity: {
      d7: pick(d7),
      d30: pick(d30),
      d90: pick(d90),
      trackingSince: hist[0]?.snapshot_date || today,
      snapshotCount: hist.length,
    },
  });
}
