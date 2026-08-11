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

  // Manual paste (works with no Google API)
  const [mName, setMName] = useState('');
  const [mRating, setMRating] = useState(5);
  const [mText, setMText] = useState('');
  const [mDrafting, setMDrafting] = useState(false);
  const [manual, setManual] = useState<{ author: string; rating: number; text: string; draft: string }[]>([]);

  // Optional Google auto-fetch (only works if a Places key is configured)
  const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Automated responder queue (reviews synced from Google via Make.com).
  const [queue, setQueue] = useState<any[]>([]);
  const [queueEdits, setQueueEdits] = useState<Record<string, string>>({});
  function loadQueue() {
    if (!clientId) return;
    fetch(`/api/google-reviews-sync?clientId=${encodeURIComponent(clientId)}&limit=100`)
      .then((r) => r.json())
      .then((d) => setQueue(Array.isArray(d.reviews) ? d.reviews : []))
      .catch(() => setQueue([]));
  }
  useEffect(() => { loadQueue(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);
  async function actOnReview(gid: string, action: 'approve' | 'reject' | 'save', replyText?: string) {
    if (!clientId) return;
    try {
      const res = await fetch('/api/reviews/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, googleReviewId: gid, action, replyText }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setQueue((prev) => prev.map((x) => x.google_review_id === gid
        ? { ...x, reply_status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : x.reply_status, reply_text: replyText ?? x.reply_text }
        : x));
    } catch (e: any) { setError(e.message); }
  }

  // Try to pull public reviews; silently no-ops if the Places key is down.
  useEffect(() => {
    if (!clientId) return;
    setReviews([]); setDrafts({}); setMapsUrl(null);
    (async () => {
      try {
        const kv = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_place_id`).then((r) => r.json());
        const pid: string | null = kv?.value || null;
        if (!pid) return;
        const r = await fetch(`/api/google-places?placeId=${encodeURIComponent(pid)}`);
        const d = await r.json();
        if (r.ok) { setReviews(d.reviews || []); setMapsUrl(d.mapsUrl || null); }
      } catch {}
    })();
  }, [clientId]);

  function copy(key: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  }

  async function draftReplies(payload: { author: string | null; rating: number; text: string }[]): Promise<string[]> {
    const res = await fetch('/api/reviews/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: activeClient?.name, reviews: payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Draft failed');
    const map: Record<number, string> = {};
    for (const d of data.drafts || []) map[d.index] = d.reply;
    return payload.map((_, i) => map[i] || '');
  }

  async function draftManual() {
    const text = mText.trim();
    if (!text) return;
    setMDrafting(true); setError('');
    try {
      const [reply] = await draftReplies([{ author: mName || null, rating: mRating, text }]);
      setManual((prev) => [{ author: mName, rating: mRating, text, draft: reply }, ...prev]);
      setMText(''); setMName('');
    } catch (e: any) { setError(e.message); } finally { setMDrafting(false); }
  }

  async function draftAuto() {
    if (reviews.length === 0) return;
    setAutoDrafting(true); setError('');
    try {
      const replies = await draftReplies(reviews.map((rv) => ({ author: rv.author_name, rating: rv.rating, text: rv.review_text || '' })));
      const map: Record<number, string> = {};
      replies.forEach((rep, i) => { if (rep) map[i] = rep; });
      setDrafts(map);
    } catch (e: any) { setError(e.message); } finally { setAutoDrafting(false); }
  }

  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));

  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>reviews</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Review Responses</h1>
        </div>
        <p className="text-white/60 mt-1 text-sm">
          Paste a review from Google (or GHL) and get a ready-to-send reply for <b className="text-white/80">{activeClient?.shortName}</b> — copy it back into GHL. Nothing is posted automatically.
        </p>
      </div>

      {error && <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

      {/* Automated responder — needs approval queue (from synced Google reviews) */}
      {(() => {
        const flagged = queue.filter((r) => r.reply_status === 'flagged');
        const autoReady = queue.filter((r) => r.reply_status === 'auto').length;
        const approved = queue.filter((r) => r.reply_status === 'approved').length;
        const sent = queue.filter((r) => r.reply_status === 'sent').length;
        if (queue.length === 0) return null;
        return (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">Automated replies</div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">{autoReady} auto-queued (5★)</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{flagged.length} need approval</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">{approved} approved</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50">{sent} sent</span>
                <button onClick={loadQueue} className="text-white/40 hover:text-white/80 px-1" title="Refresh">↻</button>
              </div>
            </div>
            <div className="text-[11px] text-white/45 mb-3">5★ replies auto-post via Make.com. Anything under 5★ is drafted here for your OK first.</div>
            {flagged.length === 0 ? (
              <div className="text-[12px] text-white/40">Nothing waiting on you. 🎉</div>
            ) : (
              <div className="flex flex-col gap-3">
                {flagged.map((r) => {
                  const gid = r.google_review_id;
                  const val = queueEdits[gid] ?? r.reply_text ?? '';
                  return (
                    <div key={gid} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2 text-[12px] mb-1">
                        <span className="text-amber-300">{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(r.rating)))}</span>
                        <span className="text-white/70 font-semibold">{r.author_name || 'Anonymous'}</span>
                      </div>
                      {r.review_text && <div className="text-[12px] text-white/55 italic mb-2">“{r.review_text}”</div>}
                      <textarea
                        value={val}
                        onChange={(e) => setQueueEdits((p) => ({ ...p, [gid]: e.target.value }))}
                        rows={3}
                        className="w-full text-[13px] text-white/90 bg-white/5 rounded-lg p-2.5 border border-white/15 outline-none leading-relaxed"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => actOnReview(gid, 'approve', val)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">Approve &amp; send</button>
                        <button onClick={() => actOnReview(gid, 'save', val)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/15">Save draft</button>
                        <button onClick={() => actOnReview(gid, 'reject')} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-rose-300/80 hover:bg-rose-500/10">Skip</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Paste a review */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-3">Paste a review</div>
        <div className="flex gap-2 mb-2 flex-wrap">
          <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Reviewer name (optional)"
                 className="flex-1 min-w-[160px] text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
          <select value={mRating} onChange={(e) => setMRating(Number(e.target.value))}
                  className="text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
          </select>
        </div>
        <textarea value={mText} onChange={(e) => setMText(e.target.value)} rows={3}
                  placeholder="Paste the review text here…"
                  className="w-full text-[13px] rounded-lg p-2.5 text-white/90 outline-none leading-snug"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }} />
        <div className="mt-2">
          <button onClick={draftManual} disabled={mDrafting || !mText.trim()}
                  className="text-[13px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>auto_awesome</span>
            {mDrafting ? 'Drafting…' : 'Draft reply'}
          </button>
        </div>
      </div>

      {/* Manual drafts */}
      {manual.length > 0 && (
        <div className="flex flex-col gap-3">
          {manual.map((m, i) => {
            const negative = m.rating <= 3;
            return (
              <div key={i} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `4px solid ${negative ? '#f59e0b' : '#10b981'}` }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[13px] font-bold text-white">{m.author || 'Reviewer'}</div>
                  <div className="text-[12px]" style={{ color: negative ? '#fbbf24' : '#34d399' }}>{stars(m.rating)}</div>
                </div>
                {m.text && <div className="text-[12.5px] text-white/70 leading-snug mb-2">“{m.text}”</div>}
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/70">Suggested reply</span>
                    <button onClick={() => copy(`m${i}`, m.draft)} className="text-[10px] font-bold text-white/70 hover:text-white inline-flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
                      {copied === `m${i}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <textarea value={m.draft} onChange={(e) => setManual((prev) => prev.map((x, j) => j === i ? { ...x, draft: e.target.value } : x))}
                            rows={3} className="w-full text-[13px] rounded-lg p-2 text-white/90 outline-none leading-snug"
                            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-pulled Google reviews (only appears if the Places key is live) */}
      {reviews.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">Live Google reviews ({reviews.length})</div>
            <div className="flex items-center gap-2">
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-white/50 hover:text-white">Open in Google</a>}
              <button onClick={draftAuto} disabled={autoDrafting} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
                {autoDrafting ? 'Drafting…' : 'Draft all'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {reviews.map((rv, i) => {
              const negative = rv.rating <= 3;
              return (
                <div key={rv.google_review_id || i} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.22)', borderLeft: `4px solid ${negative ? '#f59e0b' : '#10b981'}` }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-[13px] font-bold text-white">{rv.author_name || 'Anonymous'}</div>
                    <div className="text-[12px]" style={{ color: negative ? '#fbbf24' : '#34d399' }}>{stars(rv.rating)}</div>
                  </div>
                  {rv.review_text && <div className="text-[12px] text-white/70 leading-snug mb-2">“{rv.review_text}”</div>}
                  {drafts[i] !== undefined && (
                    <div className="rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/70">Suggested reply</span>
                        <button onClick={() => copy(`a${i}`, drafts[i])} className="text-[10px] font-bold text-white/70 hover:text-white inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
                          {copied === `a${i}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <textarea value={drafts[i]} onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                                rows={3} className="w-full text-[13px] rounded-lg p-2 text-white/90 outline-none leading-snug"
                                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
