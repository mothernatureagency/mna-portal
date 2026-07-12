'use client';

import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type Review = {
  author_name: string | null;
  rating: number;
  review_text: string | null;
  review_date: string | null;
  google_review_id: string;
};

export default function ReviewResponsesPage() {
  const { activeClient } = useClient();
  const clientId = activeClient?.id;

  const [placeId, setPlaceId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return;
    setLoading(true); setError(''); setReviews([]); setDrafts({});
    (async () => {
      try {
        const kv = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_place_id`).then((r) => r.json());
        const pid: string | null = kv?.value || null;
        setPlaceId(pid);
        if (!pid) { setLoading(false); return; }
        const r = await fetch(`/api/google-places?placeId=${encodeURIComponent(pid)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load reviews');
        setReviews(d.reviews || []);
        setMapsUrl(d.mapsUrl || null);
      } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [clientId]);

  async function draftAll() {
    if (reviews.length === 0) return;
    setDrafting(true); setError('');
    try {
      const res = await fetch('/api/reviews/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: activeClient?.name,
          reviews: reviews.map((rv) => ({ author: rv.author_name, rating: rv.rating, text: rv.review_text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft failed');
      const map: Record<number, string> = {};
      for (const d of data.drafts || []) map[d.index] = d.reply;
      setDrafts(map);
    } catch (e: any) { setError(e.message); } finally { setDrafting(false); }
  }

  function copy(i: string | number, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(Number(i));
    setTimeout(() => setCopied(null), 1400);
  }

  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));

  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>reviews</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Review Responses</h1>
          </div>
          <p className="text-white/60 mt-1 text-sm">
            AI-drafted replies to <b className="text-white/80">{activeClient?.shortName}</b>'s public Google reviews — copy &amp; paste into GHL or Google. Nothing is posted automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white border border-white/10 inline-flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span> Open in Google
            </a>
          )}
          <button
            onClick={draftAll}
            disabled={drafting || reviews.length === 0}
            className="text-[13px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>auto_awesome</span>
            {drafting ? 'Drafting…' : 'Draft all responses'}
          </button>
        </div>
      </div>

      {error && <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

      {loading ? (
        <div className="text-white/50 text-sm">Loading reviews…</div>
      ) : !placeId ? (
        <div className="rounded-2xl p-6 text-white/60 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          No Google place linked for this client yet. Connect it on the client's dashboard (Google Reviews card → search &amp; save the business), then come back here.
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl p-6 text-white/60 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          No public reviews returned for this location.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((rv, i) => {
            const draft = drafts[i];
            const negative = rv.rating <= 3;
            return (
              <div key={rv.google_review_id || i} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `4px solid ${negative ? '#f59e0b' : '#10b981'}` }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[13px] font-bold text-white">{rv.author_name || 'Anonymous'}</div>
                  <div className="text-[12px]" style={{ color: negative ? '#fbbf24' : '#34d399' }}>{stars(rv.rating)}</div>
                </div>
                {rv.review_text && <div className="text-[12.5px] text-white/70 leading-snug mb-2">“{rv.review_text}”</div>}

                {draft !== undefined ? (
                  <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/70">Suggested reply</span>
                      <button onClick={() => copy(i, drafts[i])} className="text-[10px] font-bold text-white/70 hover:text-white inline-flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
                        {copied === i ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      value={drafts[i]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                      rows={3}
                      className="w-full text-[13px] rounded-lg p-2 text-white/90 outline-none leading-snug"
                      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-white/35">Hit “Draft all responses” to generate a reply.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
