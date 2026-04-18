'use client';

/**
 * CompetitorBenchmark — Meta Business Suite + Google Reviews comparison.
 *
 * Two tabs:
 *   1. Meta — followers / new follows / published content vs local competitors
 *   2. Google Reviews — placeholder until we wire the Google Places API
 *
 * Data is currently hand-fed from the Meta Business Suite Benchmarking view;
 * swap the COMPETITORS_28D constant for an API pull when ready.
 */

import React, { useState, useMemo, useEffect } from 'react';

type Competitor = {
  id: string;
  name: string;
  isClient?: boolean;
  followers: number;
  newFollows: number;
  publishedContent: number;
};

// Shared type for live Google data per competitor (kept loose because it
// comes straight from /api/google-places which normalizes either new or
// legacy responses)
type GoogleComp = {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  total: number;
  mapsUrl: string;
  reviews: any[];
};

// ─── DATA ────────────────────────────────────────────────────────────
// Source: Meta Business Suite Benchmarking, Mar 19 – Apr 15, 2026 (28d)
const COMPETITORS_28D: Competitor[] = [
  { id: 'niceville',  name: 'Prime IV Niceville',    isClient: true, followers: 387,  newFollows: 15, publishedContent: 15 },
  { id: 'destin',     name: 'Prime IV Destin',                       followers: 504,  newFollows: 3,  publishedContent: 7  },
  { id: 'aqua-vitae', name: 'Aqua Vitae IV Drip Bar',                followers: 1100, newFollows: 8,  publishedContent: 5  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────
function pct(v: number, total: number) {
  if (!total) return 0;
  return Math.round((v / total) * 1000) / 10;
}

function fmtMultiple(client: number, other: number) {
  if (!other) return '—';
  const x = client / other;
  if (x >= 10) return `${x.toFixed(0)}×`;
  return `${x.toFixed(1)}×`;
}

// ─── COMPONENT ───────────────────────────────────────────────────────
type Tab = 'meta' | 'google';

export default function CompetitorBenchmark({
  gradientFrom,
  gradientTo,
  clientId,
}: {
  gradientFrom: string;
  gradientTo: string;
  clientId?: string;
}) {
  const [tab, setTab] = useState<Tab>('meta');
  // Google place IDs per competitor slot — stored in client_kv so both
  // staff + client portal can see them. Keyed by competitor id.
  const [placeIds, setPlaceIds] = useState<Record<string, string>>({});
  const [liveGoogle, setLiveGoogle] = useState<Record<string, GoogleComp>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pasteBuf, setPasteBuf] = useState('');

  // Load saved place IDs for each competitor + the client's own
  useEffect(() => {
    if (tab !== 'google' || !clientId) return;
    (async () => {
      const [comps, clientOwn] = await Promise.all([
        fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_competitor_place_ids`)
          .then((r) => r.json()).then((d) => (d.value && typeof d.value === 'object') ? d.value : {}).catch(() => ({})),
        fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_place_id`)
          .then((r) => r.json()).then((d) => d.value || '').catch(() => ''),
      ]);
      // Seed the client's own place id from the main reviews card
      const next = { ...comps };
      if (clientOwn) next.niceville = clientOwn;
      setPlaceIds(next);

      // Fetch live data for any we have
      for (const [compId, pid] of Object.entries(next)) {
        if (!pid) continue;
        setLoadingIds((l) => [...l, compId]);
        fetch(`/api/google-places?placeId=${encodeURIComponent(pid as string)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && !data.error) {
              setLiveGoogle((prev) => ({ ...prev, [compId]: data }));
            }
          })
          .catch(() => {})
          .finally(() => setLoadingIds((l) => l.filter((x) => x !== compId)));
      }
    })();
  }, [tab, clientId]);

  async function savePlaceId(compId: string, rawId: string) {
    const id = rawId.trim();
    if (!id) return;
    const next = { ...placeIds, [compId]: id };
    setPlaceIds(next);
    // Persist — client's own place id also written to the main key so the
    // primary GoogleReviewsCard stays in sync.
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'google_competitor_place_ids', value: next }),
    }).catch(() => {});
    if (compId === 'niceville') {
      await fetch('/api/client-kv', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, key: 'google_place_id', value: id }),
      }).catch(() => {});
    }
    // Fetch live data for it
    setLoadingIds((l) => [...l, compId]);
    try {
      const r = await fetch(`/api/google-places?placeId=${encodeURIComponent(id)}`);
      const data = await r.json();
      if (data && !data.error) setLiveGoogle((prev) => ({ ...prev, [compId]: data }));
    } finally {
      setLoadingIds((l) => l.filter((x) => x !== compId));
    }
    setEditingId(null);
    setPasteBuf('');
  }

  async function clearPlaceId(compId: string) {
    const next = { ...placeIds };
    delete next[compId];
    setPlaceIds(next);
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'google_competitor_place_ids', value: next }),
    }).catch(() => {});
    setLiveGoogle((prev) => {
      const n = { ...prev }; delete n[compId]; return n;
    });
  }

  const data = COMPETITORS_28D;
  const client = data.find((c) => c.isClient)!;
  const competitors = data.filter((c) => !c.isClient);

  const totals = useMemo(() => ({
    posts: data.reduce((s, c) => s + c.publishedContent, 0),
    follows: data.reduce((s, c) => s + c.newFollows, 0),
    followers: data.reduce((s, c) => s + c.followers, 0),
  }), [data]);

  const clientPostShare = pct(client.publishedContent, totals.posts);
  const clientGrowthShare = pct(client.newFollows, totals.follows);
  const maxFollowers = Math.max(...data.map((c) => c.followers));
  const maxPosts = Math.max(...data.map((c) => c.publishedContent));
  const maxFollows = Math.max(...data.map((c) => c.newFollows));

  return (
    <div className="glass-card p-6">
      {/* ── Header + Tabs ── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>insights</span>
            Competitor Benchmark
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            Mar 19 – Apr 15, 2026 (last 28 days) · Source: Meta Business Suite
          </p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-white/15 text-[11px] font-semibold">
          <button
            onClick={() => setTab('meta')}
            className={`px-3 py-1.5 transition ${tab === 'meta' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            style={tab === 'meta' ? { background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            Meta
          </button>
          <button
            onClick={() => setTab('google')}
            className={`px-3 py-1.5 transition ${tab === 'google' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            style={tab === 'google' ? { background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            Google Reviews
          </button>
        </div>
      </div>

      {tab === 'meta' && (
        <>
          {/* ── Headline insight ── */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}11)`,
              border: `1px solid ${gradientFrom}55`,
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
              ✦ Activity & Growth Leader
            </div>
            <div className="text-white text-[13px] leading-relaxed">
              Niceville is publishing <span className="font-bold">{fmtMultiple(client.publishedContent, competitors[1].publishedContent)} more</span> than Aqua Vitae and{' '}
              <span className="font-bold">{fmtMultiple(client.publishedContent, competitors[0].publishedContent)} more</span> than the Destin location, while gaining{' '}
              <span className="font-bold">{fmtMultiple(client.newFollows, competitors[0].newFollows)} the new follows</span> of Destin and{' '}
              <span className="font-bold">{fmtMultiple(client.newFollows, competitors[1].newFollows)}</span> Aqua Vitae's. We have the smallest base but the strongest momentum.
            </div>
          </div>

          {/* ── Market Activity Share ── */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <ShareTile
              label="Market Activity Share"
              clientPct={clientPostShare}
              note={`${client.publishedContent} of ${totals.posts} posts`}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <ShareTile
              label="New-Follow Share"
              clientPct={clientGrowthShare}
              note={`${client.newFollows} of ${totals.follows} new follows`}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
          </div>

          {/* ── Bar charts ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BarColumn
              title="Followers"
              metric="followers"
              data={data}
              max={maxFollowers}
              barColor="#94a3b8"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <BarColumn
              title="New Follows (28d)"
              metric="newFollows"
              data={data}
              max={maxFollows}
              barColor="#34d399"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <BarColumn
              title="Published Content (28d)"
              metric="publishedContent"
              data={data}
              max={maxPosts}
              barColor="#a78bfa"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
          </div>
        </>
      )}

      {tab === 'google' && (
        <GoogleCompetitorGrid
          competitors={data}
          placeIds={placeIds}
          liveGoogle={liveGoogle}
          loadingIds={loadingIds}
          editingId={editingId}
          pasteBuf={pasteBuf}
          setEditingId={setEditingId}
          setPasteBuf={setPasteBuf}
          savePlaceId={savePlaceId}
          clearPlaceId={clearPlaceId}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function ShareTile({
  label,
  clientPct,
  note,
  gradientFrom,
  gradientTo,
}: {
  label: string;
  clientPct: number;
  note: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-[34px] font-black text-white leading-none">{clientPct}%</div>
        <div className="text-[11px] text-white/50">{note}</div>
      </div>
      <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${clientPct}%`,
            background: `linear-gradient(90deg,${gradientFrom},${gradientTo})`,
          }}
        />
      </div>
    </div>
  );
}

function BarColumn({
  title,
  metric,
  data,
  max,
  barColor,
  gradientFrom,
  gradientTo,
}: {
  title: string;
  metric: 'followers' | 'newFollows' | 'publishedContent';
  data: Competitor[];
  max: number;
  barColor: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[11px] font-bold text-white/85 mb-3">{title}</div>
      <div className="space-y-2.5">
        {data.map((c) => {
          const v = c[metric];
          const w = max ? (v / max) * 100 : 0;
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={c.isClient ? 'font-bold text-white' : 'text-white/65'}>
                  {c.isClient && '★ '}{c.name}
                </span>
                <span className={c.isClient ? 'font-bold text-white' : 'text-white/65'}>
                  {v.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${w}%`,
                    background: c.isClient
                      ? `linear-gradient(90deg,${gradientFrom},${gradientTo})`
                      : barColor,
                    opacity: c.isClient ? 1 : 0.55,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoogleCompetitorGrid({
  competitors,
  placeIds,
  liveGoogle,
  loadingIds,
  editingId,
  pasteBuf,
  setEditingId,
  setPasteBuf,
  savePlaceId,
  clearPlaceId,
  gradientFrom,
  gradientTo,
}: {
  competitors: Competitor[];
  placeIds: Record<string, string>;
  liveGoogle: Record<string, GoogleComp>;
  loadingIds: string[];
  editingId: string | null;
  pasteBuf: string;
  setEditingId: (id: string | null) => void;
  setPasteBuf: (s: string) => void;
  savePlaceId: (id: string, val: string) => void;
  clearPlaceId: (id: string) => void;
  gradientFrom: string;
  gradientTo: string;
}) {
  // Who has Google data right now → generate an insight
  const withData = competitors
    .map((c) => ({ c, g: liveGoogle[c.id] }))
    .filter((x): x is { c: Competitor; g: GoogleComp } => !!x.g);

  const client = competitors.find((c) => c.isClient);
  const clientLive = client ? liveGoogle[client.id] : null;
  const ratingLeader = withData.slice().sort((a, b) => b.g.rating - a.g.rating)[0];
  const volumeLeader = withData.slice().sort((a, b) => b.g.total - a.g.total)[0];

  return (
    <div className="space-y-4">
      {/* Insight callout — only when we have 2+ data points to compare */}
      {withData.length >= 2 && (
        <div
          className="rounded-xl p-4"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}11)`, border: `1px solid ${gradientFrom}55` }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
            ✦ Google Local Position
          </div>
          <div className="text-white text-[13px] leading-relaxed">
            {clientLive && (
              <>
                {client?.name} averages <span className="font-bold">{clientLive.rating.toFixed(1)}★ across {clientLive.total} reviews</span>.{' '}
              </>
            )}
            {ratingLeader && (
              <>Highest rated: <span className="font-bold">{ratingLeader.c.name} ({ratingLeader.g.rating.toFixed(1)}★)</span>. </>
            )}
            {volumeLeader && (
              <>Most reviewed: <span className="font-bold">{volumeLeader.c.name} ({volumeLeader.g.total.toLocaleString()})</span>.</>
            )}
          </div>
        </div>
      )}

      {/* 3-card grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {competitors.map((c) => {
          const live = liveGoogle[c.id];
          const placeId = placeIds[c.id];
          const loading = loadingIds.includes(c.id);
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${c.isClient ? gradientFrom + '55' : 'rgba(255,255,255,0.1)'}`,
                borderLeft: `3px solid ${c.isClient ? gradientFrom : '#94a3b8'}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    {c.isClient ? '★ Your location' : 'Competitor'}
                  </div>
                  <div className="text-[13px] font-bold text-white truncate">{c.name}</div>
                </div>
              </div>

              {loading ? (
                <div className="text-[11px] text-white/55 py-6 text-center">Loading…</div>
              ) : live ? (
                <>
                  {/* Rating + total */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-[28px] font-black text-white leading-none">{live.rating.toFixed(1)}</div>
                    <div className="text-[11px] text-white/55">★ · {live.total.toLocaleString()} reviews</div>
                  </div>
                  <GStars rating={Math.round(live.rating)} />

                  {/* Newest review preview — keeps card scannable */}
                  {live.reviews && live.reviews[0] && (
                    <div className="mt-3 rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <GStars rating={live.reviews[0].rating || 0} size={11} />
                        <span className="text-[9px] text-white/50">
                          {live.reviews[0].author_name || 'Reviewer'}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/70 leading-snug line-clamp-3">
                        {live.reviews[0].review_text || <span className="italic text-white/35">No review text</span>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 gap-2">
                    {live.mapsUrl && (
                      <a href={live.mapsUrl} target="_blank" rel="noreferrer"
                         className="text-[10px] text-white/55 hover:text-white flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>open_in_new</span>
                        View on Maps
                      </a>
                    )}
                    <button
                      onClick={() => { setEditingId(c.id); setPasteBuf(placeId || ''); }}
                      className="text-[10px] text-white/45 hover:text-white/80"
                    >
                      Change
                    </button>
                  </div>
                </>
              ) : isEditing || !placeId ? (
                <div className="mt-2">
                  <div className="text-[11px] text-white/65 mb-2 leading-snug">
                    Paste {c.name}'s Google Place ID (starts with <code className="text-white/80">ChIJ</code>)
                  </div>
                  <input
                    type="text"
                    autoFocus={isEditing}
                    placeholder="ChIJ…"
                    value={isEditing ? pasteBuf : ''}
                    onChange={(e) => { setEditingId(c.id); setPasteBuf(e.target.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') savePlaceId(c.id, pasteBuf); }}
                    className="w-full px-2.5 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none font-mono"
                    style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }}
                  />
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => savePlaceId(c.id, isEditing ? pasteBuf : '')}
                      disabled={!(isEditing ? pasteBuf.trim() : false)}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 flex-1"
                      style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
                    >
                      Save
                    </button>
                    {isEditing && (
                      <button
                        onClick={() => { setEditingId(null); setPasteBuf(''); }}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <a
                    href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                    target="_blank" rel="noreferrer"
                    className="text-[9px] text-white/50 hover:text-white mt-2 inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>open_in_new</span>
                    Open Place ID Finder
                  </a>
                </div>
              ) : (
                <div className="text-[11px] text-white/55 py-4 text-center">
                  Place ID saved but no data yet —{' '}
                  <button onClick={() => clearPlaceId(c.id)} className="text-rose-300 hover:text-rose-200">clear</button> and re-paste.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-white/40">
        Reviews + ratings pulled live from Google Places API. Only the newest review is shown per card to keep the comparison scannable.
      </div>
    </div>
  );
}

function GStars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="material-symbols-outlined" style={{
          fontSize: size,
          color: n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.15)',
          fontVariationSettings: n <= rating ? '"FILL" 1' : '"FILL" 0',
        }}>star</span>
      ))}
    </span>
  );
}

function GoogleReviewsLive({ data, gradientFrom, gradientTo }: { data: any; gradientFrom: string; gradientTo: string }) {
  const s = data.summary;
  const avg = Number(s.avg_rating) || 0;
  const total = Number(s.total) || 0;
  const last7 = Number(s.last_7d) || 0;
  const last30 = Number(s.last_30d) || 0;
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}11)`, border: `1px solid ${gradientFrom}55` }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
          ✦ Live Google Reviews
        </div>
        <div className="text-white text-[13px] leading-relaxed">
          Averaging <span className="font-bold">{avg.toFixed(1)} ★</span> across <span className="font-bold">{total}</span> total reviews.{' '}
          {last7 > 0 && <>Added <span className="font-bold">{last7}</span> new this week. </>}
          {last30 > 0 && <>{last30} in the last 30 days.</>}
        </div>
      </div>
      <div className="text-[11px] text-white/55">
        Competitor-side Google data needs each competitor's Place ID wired in. Ask Make to pull
        Destin + Aqua Vitae via Outscraper / Google Places and POST to the same sync endpoint
        (swap clientId) — this card will auto-populate a side-by-side.
      </div>
    </div>
  );
}

function GoogleReviewsPlaceholder({ gradientFrom, gradientTo }: { gradientFrom: string; gradientTo: string }) {
  return (
    <div className="text-center py-12">
      <span
        className="material-symbols-outlined inline-block mb-3"
        style={{ fontSize: 48, color: gradientTo, opacity: 0.6 }}
      >
        rate_review
      </span>
      <div className="text-white text-[14px] font-semibold mb-1">Google Reviews comparison · coming online</div>
      <p className="text-white/55 text-[11px] max-w-md mx-auto leading-relaxed">
        Once the Google Places API key is provisioned for portal.mothernatureagency.com,
        this tab will pull each competitor's review count, average rating, and recent
        review velocity automatically. Right now we'd be guessing — and we don't fabricate
        review numbers.
      </p>
    </div>
  );
}
