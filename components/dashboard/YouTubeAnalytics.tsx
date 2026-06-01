'use client';

/**
 * YouTube analytics card — mirrors TikTokAnalytics in shape. Public stats
 * via YouTube Data API v3 (one API key, no per-channel OAuth).
 *   - Paste @handle or channel URL → saved in client_kv (key: youtube_handle)
 *   - /api/youtube/profile fetches channel stats + 20 recent videos
 *   - Daily snapshots feed 7d/30d/90d velocity chips
 */

import React, { useEffect, useState } from 'react';
import MonthlyMoM from './MonthlyMoM';

type Profile = {
  handle: string;
  channelId: string;
  displayName: string;
  bio: string;
  avatar: string | null;
  subscribers: number;
  totalViews: number;
  videosCount: number;
};

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

type Velocity = {
  d7: { s: number; v: number };
  d30: { s: number; v: number };
  d90: { s: number; v: number };
  trackingSince: string;
  snapshotCount: number;
};

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function cleanHandle(raw: string): string {
  let s = (raw || '').trim();
  const channelMatch = s.match(/channel\/(UC[A-Za-z0-9_-]{20,})/i);
  if (channelMatch) return channelMatch[1];
  const handleMatch = s.match(/youtube\.com\/@?([A-Za-z0-9_.-]+)/i);
  if (handleMatch) return handleMatch[1].replace(/[/?].*$/, '');
  return s.replace(/^@/, '').replace(/[/?].*$/, '');
}

export default function YouTubeAnalytics({
  ownerKey,
  kvClientId,
  kvKey = 'youtube_handle',
  label,
  gradientFrom,
  gradientTo,
  editable = true,
}: {
  ownerKey: string;
  kvClientId: string;
  kvKey?: string;
  label?: string;
  gradientFrom: string;
  gradientTo: string;
  editable?: boolean;       // gate the "Capture this month" button (default true)
}) {
  const [handle, setHandle] = useState<string>('');
  const [savedHandle, setSavedHandle] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topVideos, setTopVideos] = useState<Video[]>([]);
  const [velocity, setVelocity] = useState<Velocity | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [setupOk, setSetupOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/youtube/profile?check=1')
      .then((r) => r.json())
      .then((d) => setSetupOk(!!d.configured))
      .catch(() => setSetupOk(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/client-kv?clientId=${encodeURIComponent(kvClientId)}&key=${encodeURIComponent(kvKey)}`);
        const d = await r.json();
        const h = d?.value ? cleanHandle(String(d.value)) : '';
        if (h) {
          setSavedHandle(h);
          setHandle(h);
          await refresh(h);
          return;
        }
      } catch {}
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kvClientId, kvKey]);

  async function saveHandle() {
    const h = cleanHandle(handle);
    if (!h) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: kvClientId, key: kvKey, value: h }),
    });
    setSavedHandle(h);
    refresh(h);
  }

  async function refresh(h?: string) {
    const use = cleanHandle(h || savedHandle || handle);
    if (!use) return;
    setLoading(true); setErr(''); setProfile(null);
    try {
      const r = await fetch(`/api/youtube/profile?handle=${encodeURIComponent(use)}&ownerKey=${encodeURIComponent(ownerKey)}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Fetch failed'); setLoading(false); return; }
      setProfile(d.profile);
      setTopVideos(d.topVideos || []);
      setVelocity(d.velocity || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>play_circle</span>
            <h3 className="text-[15px] font-bold text-white">YouTube Analytics {label ? `· ${label}` : ''}</h3>
            {profile && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>Live</span>}
          </div>
          <p className="text-[11px] text-white/55">Public channel stats · auto-snapshots for growth tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <span className="text-[11px] text-white/50 pl-3">@</span>
            <input
              type="text"
              placeholder="handle or channel URL"
              value={handle.replace(/^@/, '')}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveHandle(); }}
              className="px-2 py-1.5 bg-transparent text-white text-[12px] placeholder:text-white/35 focus:outline-none"
              style={{ width: 170 }}
            />
          </div>
          <button
            onClick={saveHandle}
            disabled={!handle.trim()}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
          >
            {savedHandle ? 'Refresh' : 'Connect'}
          </button>
        </div>
      </div>

      {setupOk === false && (
        <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 22 }}>settings</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-amber-100">YouTube needs one setup step</div>
              <div className="text-[11px] text-white/75 mt-1 leading-relaxed">
                Add <code className="text-white font-bold">YOUTUBE_API_KEY</code> to Vercel env vars and redeploy, then come back.
              </div>
              <ol className="text-[11px] text-white/70 mt-2 space-y-0.5 list-decimal ml-4">
                <li>Google Cloud → enable <b>YouTube Data API v3</b> on your project</li>
                <li>Credentials → Create API key</li>
                <li>Add as <b>YOUTUBE_API_KEY</b> in Vercel env vars (all 3 environments)</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      {err && (
        <div className="rounded-xl p-3 mb-3 text-[11px]" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <span className="font-bold text-rose-300">Error: </span><span className="text-white/75">{err}</span>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-white/55 py-10 text-center">Loading YouTube data…</div>
      ) : !profile ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: gradientTo, opacity: 0.5 }}>link</span>
          <div className="text-[13px] font-bold">Connect a YouTube channel</div>
          <p className="text-[11px] text-white/55 mt-1 max-w-md mx-auto">
            Paste an @handle, channel URL, or channel ID above and hit Connect. We pull subscribers,
            lifetime views, and the latest 20 videos with stats.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            {profile.avatar && <img src={profile.avatar} alt="" className="w-12 h-12 rounded-full" />}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-white truncate">{profile.displayName}</div>
              <a href={`https://www.youtube.com/channel/${profile.channelId}`} target="_blank" rel="noreferrer"
                 className="text-[11px] text-sky-300 hover:text-sky-200">{profile.handle ? `@${profile.handle}` : profile.channelId}</a>
              {profile.bio && <div className="text-[11px] text-white/55 truncate">{profile.bio.split('\n')[0]}</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <Stat label="Subscribers" value={fmt(profile.subscribers)} delta={velocity ? velocity.d30.s : 0} deltaLabel="30d" color={gradientFrom} />
            <Stat label="Total Views" value={fmt(profile.totalViews)} delta={velocity ? velocity.d30.v : 0} deltaLabel="30d" color="#ef4444" />
            <Stat label="Videos" value={String(profile.videosCount)} color="#f59e0b" />
          </div>

          {velocity && velocity.snapshotCount >= 2 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-1">
                ✦ Growth since {new Date(`${velocity.trackingSince}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-[12px] text-white/85">
                7d: <span className="font-bold text-emerald-300">+{velocity.d7.s.toLocaleString()}</span> subs ·{' '}
                30d: <span className="font-bold text-emerald-300">+{velocity.d30.s.toLocaleString()}</span> subs · {fmt(velocity.d30.v)} views
              </div>
            </div>
          )}

          <MonthlyMoM
            clientId={kvClientId}
            scope="youtube"
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
            editable={editable}
            metrics={[
              { key: 'subscribers', label: 'Subscribers', value: profile.subscribers, fmt },
              { key: 'views', label: 'Total Views', value: profile.totalViews, fmt },
              { key: 'videos', label: 'Videos', value: profile.videosCount },
            ]}
          />

          <div className="mb-1">
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-2">Top Videos · by views</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topVideos.slice(0, 5).map((v) => (
                <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                   className="block rounded-lg overflow-hidden transition hover:scale-[1.02]"
                   style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 bg-white/5" />
                  )}
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-white truncate">{v.title}</div>
                    <div className="text-[9px] text-white/55">{fmt(v.views)} views · {fmt(v.likes)} likes</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, delta, deltaLabel, color }: { label: string; value: string; delta?: number; deltaLabel?: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderTop: `2px solid ${color}` }}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">{label}</div>
      <div className="text-[22px] font-black text-white leading-none mt-1.5">{value}</div>
      {typeof delta === 'number' && delta !== 0 && deltaLabel && (
        <div className={`text-[10px] mt-1 font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()} · {deltaLabel}
        </div>
      )}
    </div>
  );
}
