'use client';

/**
 * TikTok analytics + trend ideas card.
 *
 * Works for any client or creator — just pass ownerKey (e.g. 'prime-iv'
 * or 'alexusaura@...') and a storage key where the saved handle lives.
 * The card:
 *   - Lets the user paste a TikTok handle / profile URL (saved in client_kv)
 *   - Fetches current follower + like totals + latest 20 videos via
 *     /api/tiktok/profile (Apify under the hood)
 *   - Snapshots growth into the DB so velocity chips (7d / 30d) appear
 *     on subsequent refreshes
 *   - "Generate Ideas" button pipes the top videos through Sonnet for
 *     trend patterns + specific content suggestions
 */

import React, { useEffect, useState } from 'react';

type Profile = {
  handle: string;
  displayName: string;
  bio: string;
  avatar: string | null;
  verified: boolean;
  followers: number;
  following: number;
  totalLikes: number;
  videosCount: number;
};

type Video = {
  id: string;
  url: string;
  text: string;
  hashtags: string[];
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  cover: string | null;
  created: string | null;
};

type Velocity = { d7: { f: number; l: number }; d30: { f: number; l: number }; d90: { f: number; l: number }; trackingSince: string; snapshotCount: number };

type Ideas = {
  trends: string[];
  contentIdeas: { title: string; hook: string; why: string; type: string }[];
  hashtagStrategy: { alwaysInclude: string[]; testNext: string[] };
  postingCadence: string;
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function cleanHandle(raw: string): string {
  return raw.replace(/^.*(tiktok\.com\/)?@?/i, '').replace(/[/?].*$/, '').trim().replace(/^@/, '');
}

export default function TikTokAnalytics({
  ownerKey,
  kvClientId,
  kvKey = 'tiktok_handle',
  label,
  gradientFrom,
  gradientTo,
  niche,
}: {
  ownerKey: string;         // namespace for snapshots (e.g. 'prime-iv')
  kvClientId: string;       // client_id for client_kv (same or different)
  kvKey?: string;           // default 'tiktok_handle'
  label?: string;
  gradientFrom: string;
  gradientTo: string;
  niche?: string;
}) {
  const [handle, setHandle] = useState<string>('');
  const [savedHandle, setSavedHandle] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [topVideos, setTopVideos] = useState<Video[]>([]);
  const [velocity, setVelocity] = useState<Velocity | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  // Upfront setup check — is APIFY_TOKEN present in Vercel env?
  const [setupOk, setSetupOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/tiktok/profile?check=1')
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
      const r = await fetch(`/api/tiktok/profile?handle=${encodeURIComponent(use)}&ownerKey=${encodeURIComponent(ownerKey)}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Fetch failed'); setLoading(false); return; }
      setProfile(d.profile);
      setVideos(d.videos || []);
      setTopVideos(d.topVideos || []);
      setVelocity(d.velocity || null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateIdeas() {
    if (!profile || topVideos.length === 0) return;
    setIdeasBusy(true);
    try {
      const r = await fetch('/api/tiktok/ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: profile.handle,
          bio: profile.bio,
          niche,
          topVideos: topVideos.slice(0, 10),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Ideas failed'); return; }
      setIdeas(d);
    } finally { setIdeasBusy(false); }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>music_note</span>
            <h3 className="text-[15px] font-bold text-white">TikTok Analytics {label ? `· ${label}` : ''}</h3>
            {profile && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Live</span>}
          </div>
          <p className="text-[11px] text-white/55">Public profile data · auto-snapshots for growth tracking · AI trend ideas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <span className="text-[11px] text-white/50 pl-3">@</span>
            <input
              type="text"
              placeholder="handle or URL"
              value={handle.replace(/^@/, '')}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveHandle(); }}
              className="px-2 py-1.5 bg-transparent text-white text-[12px] placeholder:text-white/35 focus:outline-none"
              style={{ width: 150 }}
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
              <div className="text-[13px] font-bold text-amber-100">TikTok needs one setup step</div>
              <div className="text-[11px] text-white/75 mt-1 leading-relaxed">
                Add <code className="text-white font-bold">APIFY_TOKEN</code> to Vercel env vars and redeploy, then come back — this card will flip to live mode automatically.
              </div>
              <ol className="text-[11px] text-white/70 mt-2 space-y-0.5 list-decimal ml-4">
                <li>Get token: <a href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer" className="underline text-sky-300">console.apify.com/settings/integrations</a></li>
                <li>Add to Vercel: <a href="https://vercel.com/mothernatureagencys-projects/my-portal/settings/environment-variables" target="_blank" rel="noreferrer" className="underline text-sky-300">env vars</a> (check all 3 environments)</li>
                <li>Deployments → latest → ⋮ → Redeploy</li>
              </ol>
              <div className="text-[10px] text-white/50 mt-2">
                Until then, the <b>Connect</b> button below won't work — Apify rejects the request without a token.
              </div>
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
        <div className="text-[12px] text-white/55 py-10 text-center">Loading TikTok data…</div>
      ) : !profile ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: gradientTo, opacity: 0.5 }}>link</span>
          <div className="text-[13px] font-bold">Connect a TikTok profile</div>
          <p className="text-[11px] text-white/55 mt-1 max-w-md mx-auto">
            Paste a handle or a tiktok.com/@handle URL above and hit Connect. We'll pull live public
            stats + the latest 20 videos, then generate trend ideas from the top performers.
          </p>
        </div>
      ) : (
        <>
          {/* Profile header */}
          <div className="flex items-center gap-3 mb-4">
            {profile.avatar && <img src={profile.avatar} alt="" className="w-12 h-12 rounded-full" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-bold text-white truncate">{profile.displayName}</div>
                {profile.verified && <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#4ab8ce' }}>verified</span>}
              </div>
              <a href={`https://tiktok.com/@${profile.handle}`} target="_blank" rel="noreferrer"
                 className="text-[11px] text-sky-300 hover:text-sky-200">@{profile.handle}</a>
              {profile.bio && <div className="text-[11px] text-white/55 truncate">{profile.bio}</div>}
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Followers" value={fmt(profile.followers)} delta={velocity ? velocity.d30.f : 0} deltaLabel="30d" color={gradientFrom} />
            <Stat label="Total Likes" value={fmt(profile.totalLikes)} delta={velocity ? velocity.d30.l : 0} deltaLabel="30d" color="#ec4899" />
            <Stat label="Videos" value={String(profile.videosCount)} color="#f59e0b" />
            <Stat label="Following" value={String(profile.following)} color="#94a3b8" />
          </div>

          {velocity && velocity.snapshotCount >= 2 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-1">
                ✦ Growth since {new Date(`${velocity.trackingSince}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-[12px] text-white/85">
                7d: <span className="font-bold text-emerald-300">+{velocity.d7.f.toLocaleString()}</span> followers ·{' '}
                30d: <span className="font-bold text-emerald-300">+{velocity.d30.f.toLocaleString()}</span> followers · {fmt(velocity.d30.l)} likes
              </div>
            </div>
          )}

          {/* Top videos */}
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-2">Top Videos · by views</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topVideos.slice(0, 5).map((v) => (
                <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                   className="block rounded-lg overflow-hidden transition hover:scale-[1.02]"
                   style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {v.cover ? (
                    <img src={v.cover} alt="" className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-white/5" />
                  )}
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-white">{fmt(v.plays)} views</div>
                    <div className="text-[9px] text-white/55">{fmt(v.likes)} likes · {fmt(v.comments)} comments</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* AI ideas */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-bold text-white">🧠 Trend Ideas</div>
              <button
                onClick={generateIdeas}
                disabled={ideasBusy}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                {ideasBusy ? 'Analyzing…' : ideas ? 'Regenerate' : '✨ Generate Ideas'}
              </button>
            </div>

            {ideas && (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Patterns working</div>
                  <ul className="space-y-1">
                    {ideas.trends.map((t, i) => (
                      <li key={i} className="text-[12px] text-white/80">· {t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Next videos to film</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ideas.contentIdeas.map((idea, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${gradientFrom}` }}>
                        <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: gradientFrom }}>{idea.type}</div>
                        <div className="text-[13px] font-bold text-white mt-0.5">{idea.title}</div>
                        <div className="text-[11px] text-white/75 mt-1"><span className="text-white/45">Hook:</span> {idea.hook}</div>
                        <div className="text-[10px] text-white/55 mt-1 italic">{idea.why}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Always include</div>
                    <div className="flex flex-wrap gap-1">
                      {ideas.hashtagStrategy.alwaysInclude.map((h) => (
                        <span key={h} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,184,206,0.15)', color: '#67e8f9' }}>#{h.replace(/^#/, '')}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Test next</div>
                    <div className="flex flex-wrap gap-1">
                      {ideas.hashtagStrategy.testNext.map((h) => (
                        <span key={h} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(236,72,153,0.15)', color: '#f9a8d4' }}>#{h.replace(/^#/, '')}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-white/65 pt-2 border-t border-white/10">
                  <span className="text-white/45 uppercase tracking-wider text-[9px] font-bold">Cadence: </span>
                  {ideas.postingCadence}
                </div>
              </div>
            )}
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
