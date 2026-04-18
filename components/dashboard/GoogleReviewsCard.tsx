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

  useEffect(() => {
    fetch(`/api/google-reviews-sync?clientId=${encodeURIComponent(clientId)}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews || []);
        // Postgres returns counts as strings; coerce to numbers.
        if (d.summary) {
          setSummary({
            total:     Number(d.summary.total) || 0,
            avg_rating: Number(d.summary.avg_rating) || 0,
            last_7d:   Number(d.summary.last_7d) || 0,
            last_30d:  Number(d.summary.last_30d) || 0,
            five_star: Number(d.summary.five_star) || 0,
            four_star: Number(d.summary.four_star) || 0,
            three_star: Number(d.summary.three_star) || 0,
            two_star:  Number(d.summary.two_star) || 0,
            one_star:  Number(d.summary.one_star) || 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <div className="glass-card p-5 text-[12px] text-white/55">Loading Google reviews…</div>;
  }

  const hasData = !!summary && summary.total > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>reviews</span>
            <h3 className="text-[15px] font-bold text-white">Google Reviews</h3>
            {hasData && summary && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                Live
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55">
            Synced from Google Business Profile via Make
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: '#fbbf24', opacity: 0.5 }}>rate_review</span>
          <div className="text-[13px] font-bold text-white mb-1">No reviews synced yet</div>
          <p className="text-[11px] text-white/55 max-w-md mx-auto leading-relaxed">
            Set up the Make scenario: Google Business Profile → daily schedule → POST to
            <code className="mx-1 text-white/80 text-[10px]">/api/google-reviews-sync</code>
            with header <code className="text-white/80 text-[10px]">X-Sync-Key</code>.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl p-4"
                 style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/80">Rating</div>
              <div className="flex items-baseline gap-1 mt-1">
                <div className="text-[28px] font-black text-white leading-none">{summary!.avg_rating.toFixed(1)}</div>
                <div className="text-[11px] text-white/75">/ 5</div>
              </div>
              <div className="mt-2"><Stars rating={Math.round(summary!.avg_rating)} size={14} /></div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">Total Reviews</div>
              <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.total}</div>
              <div className="text-[10px] text-white/45 mt-1">Across all time</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">New · 7 days</div>
              <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.last_7d}</div>
              <div className="text-[10px] text-white/45 mt-1">Fresh velocity</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/55">New · 30 days</div>
              <div className="text-[24px] font-black text-white leading-none mt-1.5">{summary!.last_30d}</div>
              <div className="text-[10px] text-white/45 mt-1">Monthly pace</div>
            </div>
          </div>

          {/* Distribution bars */}
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
