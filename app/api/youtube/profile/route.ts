import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * YouTube channel stats fetcher via YouTube Data API v3 (public data only,
 * no OAuth required).
 *
 * GET /api/youtube/profile?check=1
 *   Returns whether YOUTUBE_API_KEY is set.
 *
 * GET /api/youtube/profile?handle=@mrbeast&ownerKey=prime-iv
 *   Resolves handle → channel → uploads playlist → latest videos with stats.
 *   Snapshots subscriber/view counts daily and returns velocity from history.
 *
 * Setup: in Google Cloud Console, enable "YouTube Data API v3" on the same
 * project that already provides GOOGLE_PLACES_API_KEY, create an API key,
 * and put it in YOUTUBE_API_KEY env var. ~3 quota units per refresh; 10k/day
 * free quota covers ~3,300 refreshes.
 */

const YT_KEY = process.env.YOUTUBE_API_KEY;
const YT = 'https://youtube.googleapis.com/youtube/v3';

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

export async function GET(req: NextRequest) {
  await ensureSchema();
  if (req.nextUrl.searchParams.get('check') === '1') {
    return NextResponse.json({
      configured: !!YT_KEY,
      error: YT_KEY ? null : 'YOUTUBE_API_KEY not set. Enable YouTube Data API v3 in Google Cloud, create an API key, and add it as YOUTUBE_API_KEY in Vercel.',
    });
  }
  if (!YT_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set in env vars' }, { status: 500 });

  const handleRaw = req.nextUrl.searchParams.get('handle');
  const ownerKey = req.nextUrl.searchParams.get('ownerKey');
  if (!handleRaw || !ownerKey) return NextResponse.json({ error: 'handle + ownerKey required' }, { status: 400 });

  const { handle, channelId } = normalizeHandle(handleRaw);
  if (!handle && !channelId) return NextResponse.json({ error: 'Could not parse handle' }, { status: 400 });

  const chRes = await fetchChannel({ handle, channelId });
  if ('error' in chRes) {
    // Return history if scrape failed so the UI still shows trend data.
    const { rows } = await query(
      `select snapshot_date, subscribers, total_views, videos_count, top_videos
         from youtube_snapshots where owner_key = $1 order by snapshot_date desc limit 30`,
      [ownerKey],
    );
    return NextResponse.json({ error: chRes.error, history: rows }, { status: 500 });
  }
  const ch: ChannelLookup = chRes;

  const videos = ch.uploadsPlaylistId ? await fetchRecentVideos(ch.uploadsPlaylistId) : [];
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
