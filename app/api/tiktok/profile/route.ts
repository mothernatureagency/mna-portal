import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TikTok profile fetcher via Apify (public data, no TikTok app approval).
 *
 * GET /api/tiktok/profile?handle=alexusaura&ownerKey=prime-iv
 *   Fetches current profile + recent videos, snapshots to DB, returns combined
 *   current + 30/90 day growth.
 *
 * Uses Apify's `clockworks/tiktok-scraper` actor (stable, well-maintained).
 * Requires APIFY_TOKEN in Vercel env. Sign up free at apify.com, free tier
 * covers ~100 profile scrapes/month.
 */

// Accept either env var name so users who set APIFY_KEY or APIFY_TOKEN
// both work without re-renaming in Vercel.
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_KEY;

function normalizeHandle(input: string): string {
  let s = (input || '').trim();
  const urlMatch = s.match(/tiktok\.com\/@?([A-Za-z0-9_.]+)/i);
  if (urlMatch) return urlMatch[1];
  return s.replace(/^@/, '').replace(/[/?].*$/, '');
}

async function scrapeProfile(handle: string) {
  if (!APIFY_TOKEN) {
    return { ok: false, error: 'APIFY_TOKEN not set in Vercel env vars. Sign up at apify.com (free tier), create an API token, and add it as APIFY_TOKEN.' };
  }
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: [handle],
        resultsPerPage: 20,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `Apify returned ${r.status}: ${txt.slice(0, 300)}` };
    }
    const items: any[] = await r.json();
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: 'No items returned — handle may be wrong or profile is private.' };
    }
    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Apify request failed' };
  }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  // Setup check — lets the UI tell the user upfront whether TikTok is
  // ready to use vs needs an APIFY_TOKEN in Vercel env.
  if (req.nextUrl.searchParams.get('check') === '1') {
    return NextResponse.json({
      configured: !!APIFY_TOKEN,
      error: APIFY_TOKEN ? null : 'APIFY_TOKEN not set in Vercel env vars.',
    });
  }
  const handleRaw = req.nextUrl.searchParams.get('handle');
  const ownerKey = req.nextUrl.searchParams.get('ownerKey');
  if (!handleRaw || !ownerKey) return NextResponse.json({ error: 'handle + ownerKey required' }, { status: 400 });

  const handle = normalizeHandle(handleRaw);

  const scraped = await scrapeProfile(handle);
  if (!scraped.ok || !scraped.items) {
    // Still return any existing snapshots so the UI can show historical data
    const { rows } = await query(
      `select snapshot_date, followers, total_likes, videos_count, top_videos
         from tiktok_snapshots where owner_key = $1 order by snapshot_date desc limit 30`,
      [ownerKey],
    );
    return NextResponse.json({ error: scraped.error || 'scrape returned no items', history: rows }, { status: 500 });
  }

  // Each item is one video; the profile data is nested on authorMeta.
  const first = scraped.items[0];
  const author = first?.authorMeta || first?.authorMetaObject || {};
  const followers = Number(author.fans || author.followerCount || 0);
  const following = Number(author.following || author.followingCount || 0);
  const totalLikes = Number(author.heart || author.totalLikes || 0);
  const videosCount = Number(author.video || author.videoCount || scraped.items.length);

  // Top 10 videos by views
  const videos = scraped.items.map((v) => ({
    id: v.id || v.videoId || v.webVideoUrl,
    url: v.webVideoUrl || v.playUrl || v.downloadUrl,
    text: v.text || v.description || '',
    hashtags: Array.isArray(v.hashtags) ? v.hashtags.map((h: any) => h.name || h).slice(0, 10) : [],
    plays: Number(v.playCount || v.views || 0),
    likes: Number(v.diggCount || v.likeCount || 0),
    comments: Number(v.commentCount || 0),
    shares: Number(v.shareCount || 0),
    created: v.createTimeISO || (v.createTime ? new Date(v.createTime * 1000).toISOString() : null),
    cover: v.videoMeta?.coverUrl || v.coverUrl || null,
    duration: v.videoMeta?.duration || null,
  })).filter((v) => v.url);

  const top = videos.slice().sort((a, b) => b.plays - a.plays).slice(0, 10);

  // Upsert today's snapshot
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `insert into tiktok_snapshots
       (owner_key, handle, snapshot_date, followers, following, total_likes, videos_count, top_videos)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     on conflict (owner_key, snapshot_date) do update set
       handle = excluded.handle,
       followers = excluded.followers,
       following = excluded.following,
       total_likes = excluded.total_likes,
       videos_count = excluded.videos_count,
       top_videos = excluded.top_videos,
       captured_at = now()`,
    [ownerKey, handle, today, followers, following, totalLikes, videosCount, JSON.stringify(top)],
  );

  // Compute velocities from history
  const { rows: hist } = await query<{
    snapshot_date: string; followers: number; total_likes: string; videos_count: number;
  }>(
    `select snapshot_date, followers, total_likes, videos_count
       from tiktok_snapshots where owner_key = $1 order by snapshot_date asc`,
    [ownerKey],
  );
  function pick(cutoff: string) {
    const hit = hist.find((r) => r.snapshot_date >= cutoff);
    return hit ? { f: followers - hit.followers, l: totalLikes - Number(hit.total_likes) } : { f: 0, l: 0 };
  }
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);

  return NextResponse.json({
    profile: {
      handle,
      displayName: author.nickName || author.nickname || handle,
      bio: author.signature || '',
      avatar: author.avatar || author.avatarMedium || null,
      verified: !!author.verified,
      followers, following, totalLikes, videosCount,
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
