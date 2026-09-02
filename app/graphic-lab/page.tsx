'use client';

/**
 * Graphic Lab — static creative workspace.
 *
 * The sibling of the Video Lab, with one difference that matters: this one
 * makes the artwork. The Graphic Designer agent builds the piece as a real
 * artboard at export dimensions, you push it around until it's right, and it
 * rasterises to a PNG that lands straight on the content calendar post.
 */

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useClient } from '@/context/ClientContext';
import { GRAPHIC_FORMATS, getFormat } from '@/lib/graphic-formats';

type Project = {
  id: string;
  client_id: string;
  title: string;
  format: string;
  topic: string | null;
  status: string;
  image_url: string | null;
  content_item_id: string | null;
  has_artboard: boolean;
  updated_at: string;
  created_at: string;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  drafting: { bg: 'rgba(245,158,11,0.18)', fg: '#fbbf24' },
  designed: { bg: 'rgba(139,92,246,0.20)', fg: '#c4b5fd' },
  rendered: { bg: 'rgba(16,185,129,0.18)', fg: '#34d399' },
  posted:   { bg: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.7)' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function GraphicLabInner() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const params = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    title: '', format: 'ig-portrait', topic: '', headline: '', cta: '',
  });

  // Deep link from the content tracker: /graphic-lab?title=…&topic=…&postId=…
  const prefillTitle = params.get('title') || '';
  const prefillTopic = params.get('topic') || '';
  const postId = params.get('postId') || '';
  const prefillFormat = params.get('format') || '';

  useEffect(() => {
    fetch(`/api/graphic-projects?clientId=${encodeURIComponent(activeClient.id)}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  }, [activeClient.id]);

  // Coming in from a calendar post that already has a graphic on the go —
  // offer that one rather than quietly starting a second.
  const [existing, setExisting] = useState<Project | null>(null);
  useEffect(() => {
    if (!postId) return;
    fetch(`/api/graphic-projects?contentItemId=${encodeURIComponent(postId)}`)
      .then((r) => r.json())
      .then((d) => setExisting(d.project || null))
      .catch(() => { /* it's only a shortcut */ });
  }, [postId]);

  useEffect(() => {
    if (!prefillTitle && !prefillTopic) return;
    setDraft((d) => ({
      ...d,
      title: prefillTitle || d.title,
      topic: prefillTopic || d.topic,
      format: prefillFormat && GRAPHIC_FORMATS.some((f) => f.id === prefillFormat) ? prefillFormat : d.format,
    }));
    setShowForm(true);
  }, [prefillTitle, prefillTopic, prefillFormat]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/graphic-projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: activeClient.id, ...draft, contentItemId: postId || undefined }),
      });
      const d = await r.json();
      if (r.ok && d.project) {
        window.location.href = `/graphic-lab/${d.project.id}`;
      } else {
        setError(d.error || 'Could not create the project');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not create the project');
    } finally { setBusy(false); }
  }

  const inputStyle = { background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 24 }}>palette</span>
            <h1 className="text-[24px] font-extrabold text-white">Graphic Lab</h1>
          </div>
          <p className="text-[12px] text-white/55 mt-1">
            Static creative workspace · AI builds the artwork on brand · export a PNG straight onto the post
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
        >
          {showForm ? 'Cancel' : '+ New Graphic'}
        </button>
      </div>

      {postId && (
        <div className="glass-card px-4 py-3 text-[12px] text-white/75 flex items-center gap-2 flex-wrap">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: gradientTo }}>link</span>
          Making art for a content calendar post — the finished PNG will attach itself to that post.
          {existing && (
            <Link href={`/graphic-lab/${existing.id}`} className="underline font-semibold text-white hover:text-white/80">
              You already started one for it — pick that back up
            </Link>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="glass-card p-5 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="What is it? (e.g. October Myers Cocktail $99 offer)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border text-white text-[14px] placeholder:text-white/45 focus:outline-none"
            style={inputStyle}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
              style={inputStyle}
            >
              {GRAPHIC_FORMATS.map((f) => (
                <option key={f.id} value={f.id} className="bg-slate-900">
                  {f.label} — {f.width}×{f.height}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Subject / angle (optional)"
              value={draft.topic}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/45 focus:outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Headline, if it's already written (optional)"
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/45 focus:outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Call to action (optional)"
              value={draft.cta}
              onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/45 focus:outline-none"
              style={inputStyle}
            />
          </div>
          {error && <div className="text-[12px] text-rose-300">{error}</div>}
          <button
            type="submit"
            disabled={busy || !draft.title.trim()}
            className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            {busy ? 'Creating…' : 'Open the canvas →'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-[12px] text-white/55 py-10 text-center">Loading graphics…</div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: gradientTo, opacity: 0.5 }}>brush</span>
          <div className="text-[14px] font-bold">No graphics yet</div>
          <p className="text-[12px] text-white/55 mt-1">
            Click <span className="text-white font-semibold">+ New Graphic</span> and the designer agent will build the
            first version on {activeClient.shortName}&apos;s brand.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => {
            const f = getFormat(p.format);
            const s = STATUS_STYLE[p.status] || STATUS_STYLE.posted;
            return (
              <Link
                key={p.id}
                href={`/graphic-lab/${p.id}`}
                className="glass-card p-4 transition hover:scale-[1.02]"
                style={{ borderLeft: `3px solid ${gradientFrom}` }}
              >
                {p.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.image_url}
                    alt={p.title}
                    className="w-full h-36 object-cover rounded-lg mb-3 border border-white/10"
                  />
                )}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                    {f.label}
                  </span>
                  <span className="text-[9px] text-white/45">{f.width}×{f.height}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.fg }}>
                    {p.status}
                  </span>
                  {p.content_item_id && (
                    <span className="text-[9px] text-white/40 inline-flex items-center gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>event</span>
                      on calendar
                    </span>
                  )}
                </div>
                <div className="text-[14px] font-bold text-white">{p.title}</div>
                {p.topic && <div className="text-[11px] text-white/65 mt-1 line-clamp-2">{p.topic}</div>}
                <div className="text-[10px] text-white/40 mt-2">Updated {fmtDate(p.updated_at)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GraphicLabList() {
  return (
    <Suspense fallback={<div className="text-[12px] text-white/55 py-10 text-center">Loading graphics…</div>}>
      <GraphicLabInner />
    </Suspense>
  );
}
