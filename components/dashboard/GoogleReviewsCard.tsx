'use client';

/**
 * Google Reviews card — for any client that has google_reviews synced
 * via Make.com. Shows star rating, total count, velocity, distribution,
 * and the most recent reviews.
 */

import React, { useEffect, useState } from 'react';

type Review = {
  google_review_id: string;
  author_name: string | null;
  author_photo_url: string | null;
  rating: number;
  review_text: string | null;
  review_date: string | null;
  reply_text: string | null;
  reply_date: string | null;
};

type Summary = {
  total: number;
  avg_rating: number;
  last_7d: number;
  last_30d: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
};

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
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

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GoogleReviewsCard({
  clientId,
  gradientFrom,
  gradientTo,
}: {
  clientId: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [placeName, setPlaceName] = useState<string>('');
  const [mapsUrl, setMapsUrl] = useState<string>('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState<string>('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [lookupErr, setLookupErr] = useState<string>('');
  const [lookupBusy, setLookupBusy] = useState(false);

  // Load saved Place ID for this client, then fetch live details.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const kv = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_place_id`).then((r) => r.json()).catch(() => null);
      const placeId: string | null = kv?.value || null;

      if (placeId) {
        // Live path — pull directly from Google
        const live = await fetch(`/api/google-places?placeId=${encodeURIComponent(placeId)}`).then((r) => r.json()).catch(() => null);
        if (live && !live.error) {
          setPlaceName(live.name || '');
          setMapsUrl(live.mapsUrl || '');
          setReviews((live.reviews || []).map((r: any) => ({
            google_review_id: r.google_review_id || `${r.author_name || ''}-${r.review_date || ''}`,
            author_name: r.author_name,
            author_photo_url: r.author_photo_url,
            rating: r.rating,
            review_text: r.review_text,
            review_date: r.review_date,
            reply_text: null,
            reply_date: null,
          })));
          setSummary({
            total: live.total || 0,
            avg_rating: live.rating || 0,
            last_7d: 0, last_30d: 0,  // Places API doesn't break down by recency
            five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0,
          });
          setLoading(false);
          return;
        }
      }

      // Fallback to synced (Make-populated) data
      const synced = await fetch(`/api/google-reviews-sync?clientId=${encodeURIComponent(clientId)}&limit=10`).then((r) => r.json()).catch(() => null);
      if (synced) {
        setReviews(synced.reviews || []);
        if (synced.summary) {
          setSummary({
            total:     Number(synced.summary.total) || 0,
            avg_rating: Number(synced.summary.avg_rating) || 0,
            last_7d:   Number(synced.summary.last_7d) || 0,
            last_30d:  Number(synced.summary.last_30d) || 0,
            five_star: Number(synced.summary.five_star) || 0,
            four_star: Number(synced.summary.four_star) || 0,
            three_star: Number(synced.summary.three_star) || 0,
            two_star:  Number(synced.summary.two_star) || 0,
            one_star:  Number(synced.summary.one_star) || 0,
          });
        }
      }
      setLoading(false);
    })();
  }, [clientId]);

  async function searchPlaces() {
    if (!lookupQuery.trim()) return;
    setLookupBusy(true); setLookupErr(''); setCandidates([]);
    try {
      const r = await fetch(`/api/google-places?q=${encodeURIComponent(lookupQuery)}`);
      const d = await r.json();
      if (d.error) setLookupErr(d.error);
      else setCandidates(d.candidates || []);
    } catch (e: any) {
      setLookupErr(e?.message || 'Lookup failed');
    } finally {
      setLookupBusy(false);
    }
  }

  async function choosePlace(c: any) {
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'google_place_id', value: c.placeId }),
    }).catch(() => {});
    setLookupOpen(false);
    window.location.reload();  // simplest — re-trigger load with new place
  }

  if (loading) {
    return <div className="glass-card p-5 text-[12px] text-white/55">Loading Google reviews…</div>;
  }

  const hasData = !!summary && summary.total > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>reviews</span>
            <h3 className="text-[15px] font-bold text-white">Google Reviews</h3>
            {hasData && summary && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                Live
              </span>
            )}
            {placeName && (
              <span className="text-[11px] text-white/65">· {placeName}</span>
            )}
          </div>
          <p className="text-[11px] text-white/55">
            Pulled live from Google Places API (no approval / OAuth needed)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer"
               className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
              Open on Maps
            </a>
          )}
          <button
            onClick={() => setLookupOpen((v) => !v)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white flex items-center gap-1"
            style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>search</span>
            {lookupOpen ? 'Cancel' : 'Pick Profile'}
          </button>
        </div>
      </div>

      {/* Place ID picker — essential when there are multiple Google profiles on the map */}
      {lookupOpen && (
        <div className="rounded-xl p-4 mb-4"
             style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-2">
            Search for the right Google profile
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchPlaces(); }}
              placeholder="Prime IV Niceville FL"
              className="flex-1 px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <button
              onClick={searchPlaces}
              disabled={lookupBusy || !lookupQuery.trim()}
              className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
            >
              {lookupBusy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {lookupErr && <div className="text-[11px] text-rose-300 mt-2">{lookupErr}</div>}
          {candidates.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/45">
                Pick the correct profile ({candidates.length} match{candidates.length === 1 ? '' : 'es'})
              </div>
              {candidates.map((c) => (
                <button
                  key={c.placeId}
                  onClick={() => choosePlace(c)}
                  className="w-full text-left rounded-lg p-2.5 transition hover:bg-white/10 flex items-start justify-between gap-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-white">{c.name}</div>
                    <div className="text-[11px] text-white/60 truncate">{c.address}</div>
                    {c.type && <div className="text-[10px] text-white/40 mt-0.5">{c.type}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <Stars rating={Math.round(c.rating || 0)} size={12} />
                    </div>
                    <div className="text-[10px] text-white/55 mt-0.5">{c.total} reviews</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasData ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: '#fbbf24', opacity: 0.5 }}>rate_review</span>
          <div className="text-[13px] font-bold text-white mb-1">Pick the Google profile</div>
          <p className="text-[11px] text-white/55 max-w-md mx-auto leading-relaxed mb-3">
            Tap <span className="text-white font-semibold">Pick Profile</span> above and search
            for the Niceville location. If there are two Prime IV profiles on the map, you'll see
            both in the results — pick the one at your address.
          </p>
          <p className="text-[10px] text-white/35 max-w-md mx-auto">
            Requires <code className="text-white/60">GOOGLE_PLACES_API_KEY</code> in Vercel env vars.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats — Places API only gives avg + total, so hide
              velocity tiles when we're in live-only mode. */}
          {(() => {
            const hasBreakdown =
              (summary!.five_star + summary!.four_star + summary!.three_star + summary!.two_star + summary!.one_star) > 0;
            const hasVelocity = summary!.last_7d > 0 || summary!.last_30d > 0;
            const tiles: React.ReactNode[] = [];
            tiles.push(
              <div key="r" className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/80">Rating</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <div className="text-[28px] font-black text-white leading-none">{summary!.avg_rating.toFixed(1)}</div>
                  <div className="text-[11px] text-white/75">/ 5</div>
                </div>
                <div className="mt-2"><Stars rating={Math.round(summary!.avg_rating)} size={14} /></div>
              </div>
            );
            tiles.push(
              <div key="t" className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">Total Reviews</div>
                <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.total}</div>
                <div className="text-[10px] text-white/45 mt-1">Across all time</div>
              </div>
            );
            if (hasVelocity) {
              tiles.push(
                <div key="w" className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">New · 7 days</div>
                  <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.last_7d}</div>
                  <div className="text-[10px] text-white/45 mt-1">Fresh velocity</div>
                </div>,
                <div key="m" className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">New · 30 days</div>
                  <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.last_30d}</div>
                  <div className="text-[10px] text-white/45 mt-1">Monthly pace</div>
                </div>,
              );
            }
            return (
              <>
                <div className={`grid ${tiles.length > 2 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'} gap-3 mb-5`}>
                  {tiles}
                </div>

                {hasBreakdown && (
                  <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-3">Rating Distribution</div>
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const key = `${star === 5 ? 'five' : star === 4 ? 'four' : star === 3 ? 'three' : star === 2 ? 'two' : 'one'}_star` as keyof Summary;
                const count = summary![key] as number;
                const pct = summary!.total ? (count / summary!.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <div className="text-[11px] text-white/60 w-8 shrink-0">{star}★</div>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${pct}%`, background: star >= 4 ? '#fbbf24' : star === 3 ? '#fb923c' : '#ef4444' }} />
                    </div>
                    <div className="text-[10px] text-white/55 w-12 text-right tabular-nums">{count}</div>
                  </div>
                );
              })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Recent reviews */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-2">Recent Reviews</div>
            <div className="space-y-2">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.google_review_id} className="rounded-xl p-3"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.author_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.author_photo_url} alt={r.author_name || ''} className="w-7 h-7 rounded-full shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {(r.author_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white truncate">{r.author_name || 'Google user'}</div>
                        <div className="flex items-center gap-2"><Stars rating={r.rating} size={12} />
                          <span className="text-[10px] text-white/45">{fmtDate(r.review_date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {r.review_text && (
                    <p className="text-[12px] text-white/75 mt-2 leading-relaxed">{r.review_text}</p>
                  )}
                  {r.reply_text && (
                    <div className="mt-2 rounded-lg p-2 text-[11px]"
                         style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/45 mb-0.5">Our reply</div>
                      <div className="text-white/70">{r.reply_text}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
