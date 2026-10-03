'use client';

/**
 * Graphic Lab canvas.
 *
 * The artboard is a self-contained HTML document laid out at the format's real
 * export size. It previews in a sandboxed iframe (scaled down to fit, never
 * resized — what you see is the actual pixels) and exports by rasterising that
 * same document, so the PNG and the preview can't drift apart.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toPng } from 'html-to-image';
import { GRAPHIC_FORMATS, getFormat } from '@/lib/graphic-formats';
import { IMAGERY_STYLES } from '@/lib/graphic-imagery';

type Asset = { url: string; label?: string };
type Version = { html: string; at: string; note?: string };

type Project = {
  id: string; client_id: string; title: string; format: string;
  topic: string | null; brief: string | null;
  headline: string | null; subhead: string | null; cta: string | null;
  assets: Asset[] | null; html: string | null; versions: Version[] | null;
  image_url: string | null; content_item_id: string | null; status: string;
  updated_at: string;
};

type Tab = 'direction' | 'assets' | 'revise' | 'code';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'direction', label: 'Direction', icon: 'tune' },
  { id: 'assets',    label: 'Assets',    icon: 'image' },
  { id: 'revise',    label: 'Revise',    icon: 'auto_fix_high' },
  { id: 'code',      label: 'Artboard',  icon: 'code' },
];

const QUICK_REVISIONS = [
  'Make the headline much bigger and tighten the tracking',
  'More negative space — everything is too crowded',
  'Push the contrast: the copy is getting lost',
  'Try a completely different composition',
  'Warmer palette, keep the brand colours',
  'Move the CTA to the bottom and make it a solid button',
];

/** Point every remote image at our own origin so the export can read it. */
function sameOriginAssets(html: string): string {
  if (typeof window === 'undefined') return html;
  const origin = window.location.origin;
  return html.replace(/(src|href)\s*=\s*(["'])(https?:\/\/[^"']+)\2/gi, (full, attr, q, url) => {
    if (url.startsWith(origin)) return full;
    // Stylesheets (Google Fonts) load fine cross-origin; only images need relaying.
    if (/^href$/i.test(attr)) return full;
    return `${attr}=${q}${origin}/api/graphic-projects/proxy-image?url=${encodeURIComponent(url)}${q}`;
  }).replace(/url\(\s*(["']?)(https?:\/\/[^)"']+)\1\s*\)/gi, (full, q, url) => {
    if (url.startsWith(origin) || /fonts\.(googleapis|gstatic)\.com/.test(url)) return full;
    // Font files go direct: our bucket already serves them CORS-open, and the
    // proxy only passes images.
    if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return full;
    return `url(${q}${origin}/api/graphic-projects/proxy-image?url=${encodeURIComponent(url)}${q})`;
  });
}

export default function GraphicLabCanvas() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('direction');
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  const [designing, setDesigning] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [keepLayout, setKeepLayout] = useState(true);
  const [briefBusy, setBriefBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportScale, setExportScale] = useState(1);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [codeDraft, setCodeDraft] = useState('');

  const [newAsset, setNewAsset] = useState('');
  const [assetBusy, setAssetBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState('portrait');
  const [aiCopySpace, setAiCopySpace] = useState<'top' | 'bottom' | 'left' | 'right' | 'none'>('bottom');
  // Generated options waiting to be picked. Choosing an expression beats
  // re-rolling until one happens to land.
  const [candidates, setCandidates] = useState<{ url: string }[]>([]);
  // The brand kit's imagery direction, so generated photos match the house look.
  const [kitImagery, setKitImagery] = useState('');

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [stageWidth, setStageWidth] = useState(0);

  const fmt = useMemo(() => getFormat(project?.format), [project?.format]);

  useEffect(() => {
    fetch(`/api/graphic-projects?id=${encodeURIComponent(params.id)}`)
      .then((r) => r.json())
      .then((d) => {
        setProject(d.project);
        setCodeDraft(d.project?.html || '');
        if (d.project?.client_id) {
          fetch(`/api/brand-kits?clientId=${encodeURIComponent(d.project.client_id)}`)
            .then((r) => r.json())
            .then((k) => setKitImagery(k?.resolved?.fields?.imagery || ''))
            .catch(() => { /* a kit is optional */ });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  // Track the stage width so "fit" stays honest as the window resizes.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageWidth(el.clientWidth));
    ro.observe(el);
    setStageWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [loading]);

  const scale = zoom === 'fit'
    ? Math.min(1, stageWidth ? (stageWidth - 8) / fmt.width : 1)
    : zoom;

  const save = useCallback(async (patch: Partial<Project>) => {
    if (!project) return;
    setSaveMsg('Saving…');
    try {
      const r = await fetch('/api/graphic-projects', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, ...patch }),
      });
      const d = await r.json();
      if (r.ok && d.project) {
        setProject((prev) => (prev ? { ...prev, ...d.project } : d.project));
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 1500);
      } else {
        setSaveMsg('');
        setError(d.error || 'Save failed');
      }
    } catch (e: any) {
      setSaveMsg('');
      setError(e?.message || 'Save failed');
    }
  }, [project]);

  async function design(withInstruction?: string) {
    if (!project) return;
    setDesigning(true);
    setError('');
    try {
      const r = await fetch('/api/graphic-projects/design', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          instruction: withInstruction ?? (instruction.trim() || undefined),
          keepLayout,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'The designer could not build that'); return; }
      setProject((prev) => (prev ? { ...prev, ...d.project } : d.project));
      setCodeDraft(d.html || '');
      setInstruction('');
    } catch (e: any) {
      setError(e?.message || 'The designer could not build that');
    } finally { setDesigning(false); }
  }

  async function draftBrief() {
    if (!project) return;
    setBriefBusy(true);
    setError('');
    try {
      const r = await fetch('/api/graphic-projects/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, note: project.topic || '', save: true }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not draft the brief'); return; }
      setProject((prev) => (prev ? { ...prev, brief: d.brief } : prev));
    } catch (e: any) {
      setError(e?.message || 'Could not draft the brief');
    } finally { setBriefBusy(false); }
  }

  function revertTo(v: Version) {
    if (!project) return;
    const rest = (project.versions || []).filter((x) => x !== v);
    const versions = project.html
      ? [{ html: project.html, at: new Date().toISOString(), note: 'before revert' }, ...rest].slice(0, 8)
      : rest;
    setCodeDraft(v.html);
    save({ html: v.html, versions });
  }

  // ── Assets ────────────────────────────────────────────────────────────
  function setAssets(next: Asset[]) {
    setProject((prev) => (prev ? { ...prev, assets: next } : prev));
    save({ assets: next });
  }

  function addAssetUrl() {
    if (!project || !newAsset.trim()) return;
    setAssets([...(project.assets || []), { url: newAsset.trim(), label: 'photo' }]);
    setNewAsset('');
  }

  async function uploadAsset(file: File) {
    if (!project) return;
    setAssetBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/content-calendar/upload', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok || !d.url) { setError(d.error || 'Upload failed'); return; }
      setAssets([...(project.assets || []), { url: d.url, label: file.name.replace(/\.[^.]+$/, '') }]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally { setAssetBusy(false); }
  }

  async function generateImages() {
    if (!project || !aiPrompt.trim()) return;
    setAssetBusy(true);
    setError('');
    setCandidates([]);
    try {
      const r = await fetch('/api/graphic-projects/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: aiPrompt.trim(),
          styleId: aiStyle,
          copySpace: aiCopySpace,
          brandNote: [project.title, project.topic, kitImagery].filter(Boolean).join(' — '),
          aspect: fmt.height > fmt.width ? 'portrait' : fmt.width > fmt.height ? 'landscape' : 'square',
          count: 2,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.images?.length) { setError(d.error || 'Could not generate that image'); return; }
      setCandidates(d.images);
      if (d.warning) setError(d.warning);
    } catch (e: any) {
      setError(e?.message || 'Could not generate that image');
    } finally { setAssetBusy(false); }
  }

  function keepCandidate(url: string) {
    if (!project) return;
    setAssets([...(project.assets || []), { url, label: aiPrompt.trim().slice(0, 40) || 'generated photo' }]);
    setCandidates([]);
  }

  // ── Export ────────────────────────────────────────────────────────────
  /**
   * Rasterise in a throwaway iframe at true size. The preview iframe is under
   * a CSS transform to fit the panel, and capturing a transformed node is how
   * you get a blurry, half-cropped PNG.
   */
  async function rasterise(html: string): Promise<string> {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    Object.assign(frame.style, {
      position: 'fixed', left: '-10000px', top: '0',
      width: `${fmt.width}px`, height: `${fmt.height}px`, border: '0',
      visibility: 'hidden',
    } as CSSStyleDeclaration);
    document.body.appendChild(frame);

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The artboard took too long to load')), 30000);
        frame.onload = () => { clearTimeout(timer); resolve(); };
        frame.srcdoc = sameOriginAssets(html);
      });

      const doc = frame.contentDocument;
      if (!doc) throw new Error('Could not read the artboard');

      // Webfonts and photos have to be fully in before the snapshot.
      try { await (doc as any).fonts?.ready; } catch { /* no font API, carry on */ }
      await Promise.all(
        Array.from(doc.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          }),
        ),
      );
      await new Promise((r) => setTimeout(r, 250));

      const node = doc.getElementById('artboard') || doc.body;
      return await toPng(node as HTMLElement, {
        width: fmt.width,
        height: fmt.height,
        pixelRatio: exportScale,
        cacheBust: true,
      });
    } finally {
      frame.remove();
    }
  }

  async function exportPng(alsoAttach: boolean) {
    if (!project?.html) return;
    setExporting(true);
    setError('');
    try {
      const dataUrl = await rasterise(project.html);
      const r = await fetch('/api/graphic-projects/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, dataUrl, attach: alsoAttach }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not save the render'); return; }
      setProject((prev) => (prev ? { ...prev, image_url: d.url, status: d.project?.status || prev.status } : prev));
      setSaveMsg(d.attached ? 'Rendered and attached to the post' : 'Rendered');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setError(e?.message || 'The render failed. Try again, or download the artboard and open it in a browser.');
    } finally { setExporting(false); }
  }

  async function downloadPng() {
    if (!project?.html) return;
    setExporting(true);
    setError('');
    try {
      const dataUrl = await rasterise(project.html);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${project.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${fmt.width}x${fmt.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      setError(e?.message || 'The render failed');
    } finally { setExporting(false); }
  }

  if (loading) return <div className="text-white/55 text-center py-20 text-sm">Loading canvas…</div>;
  if (!project) return (
    <div className="text-white/55 text-center py-20 text-sm">
      Graphic not found. <Link href="/graphic-lab" className="underline">Back to Graphic Lab</Link>
    </div>
  );

  const inputStyle = { background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' };
  const assets = project.assets || [];
  const versions = project.versions || [];

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/graphic-lab" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Graphic Lab
        </Link>
        {project.content_item_id && (
          <Link href="/content" className="text-[11px] text-white/50 hover:text-white/80 inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>event</span>
            linked to a calendar post
          </Link>
        )}
        <div className="flex-1" />
        {saveMsg && <span className="text-[11px] text-white/60">{saveMsg}</span>}
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[12px] text-rose-200 flex items-start gap-2"
             style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-rose-200/60 hover:text-rose-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        {/* ── Canvas ────────────────────────────────────────────────── */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/45">
              {fmt.label} · {fmt.width}×{fmt.height}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {(['fit', 0.25, 0.5, 1] as const).map((z) => (
                <button
                  key={String(z)}
                  onClick={() => setZoom(z)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md ${zoom === z ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:text-white/80'}`}
                >
                  {z === 'fit' ? 'Fit' : `${z * 100}%`}
                </button>
              ))}
            </div>
          </div>

          <div ref={stageRef} className="rounded-xl overflow-auto" style={{ background: 'rgba(0,0,0,0.35)', maxHeight: '72vh' }}>
            {project.html ? (
              <div
                className="mx-auto"
                style={{ width: fmt.width * scale, height: fmt.height * scale, overflow: 'hidden' }}
              >
                <iframe
                  ref={frameRef}
                  title="Artboard"
                  sandbox="allow-same-origin"
                  srcDoc={sameOriginAssets(project.html)}
                  style={{
                    width: fmt.width, height: fmt.height, border: 0,
                    transform: `scale(${scale})`, transformOrigin: 'top left',
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <div className="py-24 text-center px-6">
                <span className="material-symbols-outlined block mb-3 text-white/25" style={{ fontSize: 44 }}>draw</span>
                <div className="text-[14px] font-bold text-white">Nothing on the canvas yet</div>
                <p className="text-[12px] text-white/50 mt-1 max-w-sm mx-auto">
                  Fill in whatever direction you have on the right, then build the first version.
                  You can also go straight to it — the designer will write the copy.
                </p>
                <button
                  onClick={() => design()}
                  disabled={designing}
                  className="mt-4 text-[12px] font-bold px-5 py-2.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                >
                  {designing ? 'Designing…' : '✨ Build the artwork'}
                </button>
              </div>
            )}
          </div>

          {project.html && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => design()}
                disabled={designing}
                className="text-[11px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>autorenew</span>
                {designing ? 'Designing…' : 'Start over'}
              </button>
              <button
                onClick={() => exportPng(true)}
                disabled={exporting || designing}
                className="text-[11px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-1"
                style={{ background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.45)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>done_all</span>
                {exporting ? 'Rendering…' : project.content_item_id ? 'Render + attach to post' : 'Render PNG'}
              </button>
              <button
                onClick={downloadPng}
                disabled={exporting || designing}
                className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-50 inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                Download
              </button>
              <select
                value={exportScale}
                onChange={(e) => setExportScale(Number(e.target.value))}
                title="Export scale"
                className="px-2 py-2 rounded-lg border text-white text-[11px] focus:outline-none"
                style={inputStyle}
              >
                <option value={1} className="bg-slate-900">1× ({fmt.width}px)</option>
                <option value={2} className="bg-slate-900">2× ({fmt.width * 2}px)</option>
              </select>
            </div>
          )}

          {project.image_url && (
            <div className="text-[11px] text-white/50 flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: 14 }}>check_circle</span>
              Last render saved ·
              <a href={project.image_url} target="_blank" rel="noreferrer" className="underline hover:text-white/80">open the PNG</a>
            </div>
          )}
        </div>

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div className="glass-card p-4 space-y-4">
          <input
            type="text"
            value={project.title}
            onChange={(e) => setProject({ ...project, title: e.target.value })}
            onBlur={() => save({ title: project.title })}
            className="w-full text-[17px] font-extrabold text-white bg-transparent outline-none"
          />

          <div className="flex border-b border-white/10 -mx-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 px-1 py-2 text-[11px] font-bold inline-flex items-center justify-center gap-1 border-b-2 transition ${
                  tab === t.id ? 'border-white text-white' : 'border-transparent text-white/45 hover:text-white/75'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'direction' && (
            <div className="space-y-3">
              <Field label="Format">
                <select
                  value={project.format}
                  onChange={(e) => { setProject({ ...project, format: e.target.value }); save({ format: e.target.value }); }}
                  className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={inputStyle}
                >
                  {GRAPHIC_FORMATS.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900">{f.label} — {f.width}×{f.height}</option>
                  ))}
                </select>
                {project.html && (
                  <p className="text-[10px] text-white/40 mt-1">
                    Changing the size doesn&apos;t redraw the artboard — hit Start over after switching.
                  </p>
                )}
              </Field>

              <Field label="Subject / angle">
                <textarea
                  rows={2}
                  value={project.topic || ''}
                  onChange={(e) => setProject({ ...project, topic: e.target.value })}
                  onBlur={() => save({ topic: project.topic })}
                  placeholder="What this piece is about — the offer, the message, the feeling"
                  className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                  style={inputStyle}
                />
              </Field>

              <div className="grid grid-cols-1 gap-2">
                <Field label="Headline">
                  <input
                    type="text"
                    value={project.headline || ''}
                    onChange={(e) => setProject({ ...project, headline: e.target.value })}
                    onBlur={() => save({ headline: project.headline })}
                    placeholder="Leave blank and the designer writes it"
                    className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Subhead">
                  <input
                    type="text"
                    value={project.subhead || ''}
                    onChange={(e) => setProject({ ...project, subhead: e.target.value })}
                    onBlur={() => save({ subhead: project.subhead })}
                    className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] focus:outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Call to action">
                  <input
                    type="text"
                    value={project.cta || ''}
                    onChange={(e) => setProject({ ...project, cta: e.target.value })}
                    onBlur={() => save({ cta: project.cta })}
                    placeholder="Book now · Link in bio · Call (850) …"
                    className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Brief">
                <textarea
                  rows={project.brief ? 10 : 3}
                  value={project.brief || ''}
                  onChange={(e) => setProject({ ...project, brief: e.target.value })}
                  onBlur={() => save({ brief: project.brief })}
                  placeholder="Optional. The written spec — concept, palette, layout, copy."
                  className="w-full px-3 py-2 rounded-lg border text-white text-[11px] leading-relaxed placeholder:text-white/35 focus:outline-none font-mono"
                  style={inputStyle}
                />
                <button
                  onClick={draftBrief}
                  disabled={briefBusy}
                  className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                  {briefBusy ? 'Drafting…' : 'Draft the brief first'}
                </button>
              </Field>

              <button
                onClick={() => design()}
                disabled={designing}
                className="w-full text-[12px] font-bold px-4 py-2.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
              >
                {designing ? 'Designing…' : project.html ? '✨ Rebuild from this direction' : '✨ Build the artwork'}
              </button>
            </div>
          )}

          {tab === 'assets' && (
            <div className="space-y-3">
              <p className="text-[11px] text-white/50 leading-relaxed">
                Photos the designer is allowed to place. Give it one and the piece is built around
                it — bled to the edge, type set in the quiet part of the frame. With none, it falls
                back to typography and shapes, which suits a pure offer but won&apos;t carry a spa.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAsset}
                  onChange={(e) => setNewAsset(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAssetUrl(); } }}
                  placeholder="Paste an image or Drive link"
                  className="flex-1 px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                  style={inputStyle}
                />
                <button onClick={addAssetUrl} disabled={!newAsset.trim()}
                        className="text-[11px] font-bold px-3 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-40">
                  Add
                </button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f); e.target.value = ''; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={assetBusy}
                className="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>
                {assetBusy ? 'Working…' : 'Upload a photo'}
              </button>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/45">Generate a photograph</div>

                <div className="grid grid-cols-2 gap-1.5">
                  {IMAGERY_STYLES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setAiStyle(st.id)}
                      title={st.hint}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] leading-tight transition ${
                        aiStyle === st.id
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/85'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  {IMAGERY_STYLES.find((st) => st.id === aiStyle)?.hint}
                </p>

                <textarea
                  rows={2}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Who or what is in the photo? e.g. a woman in her thirties resting after a drip, eyes closed"
                  className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                  style={inputStyle}
                />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/45 whitespace-nowrap">Leave room for type</span>
                  <select
                    value={aiCopySpace}
                    onChange={(e) => setAiCopySpace(e.target.value as typeof aiCopySpace)}
                    className="flex-1 px-2 py-1.5 rounded-lg border text-white text-[11px] focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="bottom" className="bg-slate-900">at the bottom</option>
                    <option value="top" className="bg-slate-900">at the top</option>
                    <option value="left" className="bg-slate-900">on the left</option>
                    <option value="right" className="bg-slate-900">on the right</option>
                    <option value="none" className="bg-slate-900">anywhere — fill the frame</option>
                  </select>
                </div>

                <button
                  onClick={generateImages}
                  disabled={assetBusy || !aiPrompt.trim()}
                  className="w-full text-[11px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-40 inline-flex items-center justify-center gap-1"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#c026d3)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                  {assetBusy ? 'Shooting…' : 'Generate 2 options'}
                </button>

                {candidates.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-white/50">Pick one — the expression is the whole job.</div>
                    <div className="grid grid-cols-2 gap-2">
                      {candidates.map((c) => (
                        <button
                          key={c.url}
                          onClick={() => keepCandidate(c.url)}
                          className="relative rounded-lg overflow-hidden border border-white/15 hover:border-white/60 transition group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.url} alt="Option" className="w-full h-32 object-cover" />
                          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[11px] font-bold text-white">
                            Use this
                          </span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setCandidates([])} className="text-[10px] text-white/40 hover:text-white/70">
                      Discard both
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-white/35 leading-relaxed">
                  Imagery only — every word on the piece stays live text on the artboard, so nothing
                  comes back misspelled.
                </p>
              </div>

              {assets.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {assets.map((a, i) => (
                    <div key={`${a.url}-${i}`} className="relative group rounded-lg overflow-hidden border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/graphic-projects/proxy-image?url=${encodeURIComponent(a.url)}`}
                        alt={a.label || 'asset'}
                        className="w-full h-20 object-cover"
                      />
                      <button
                        onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white/80 text-[11px] leading-none opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'revise' && (
            <div className="space-y-3">
              <textarea
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Tell the designer what to change. Plain English — “drop the photo, make it type only”."
                className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/35 focus:outline-none"
                style={inputStyle}
              />
              <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer">
                <input type="checkbox" checked={keepLayout} onChange={(e) => setKeepLayout(e.target.checked)} />
                Keep the current layout — change only what I asked for
              </label>
              <button
                onClick={() => design()}
                disabled={designing || !instruction.trim() || !project.html}
                className="w-full text-[12px] font-bold px-4 py-2.5 rounded-lg text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
              >
                {designing ? 'Reworking…' : 'Apply the change'}
              </button>

              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1.5">Quick notes</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REVISIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInstruction(q)}
                      className="text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/60 hover:text-white hover:bg-white/15 text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {versions.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1.5">
                    Earlier versions
                  </div>
                  <div className="space-y-1.5">
                    {versions.map((v, i) => (
                      <div key={`${v.at}-${i}`} className="flex items-center gap-2 text-[11px] text-white/60">
                        <span className="flex-1 truncate" title={v.note}>
                          {new Date(v.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {v.note && v.note !== 'previous' ? ` · ${v.note}` : ''}
                        </span>
                        <button onClick={() => revertTo(v)} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80">
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'code' && (
            <div className="space-y-2">
              <p className="text-[11px] text-white/50">
                The artboard itself. Nudge a hex, a font size, a word — it renders exactly what&apos;s here.
              </p>
              <textarea
                rows={22}
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg border text-white/85 text-[10px] leading-[1.5] font-mono focus:outline-none"
                style={inputStyle}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => save({ html: codeDraft })}
                  disabled={!codeDraft.trim() || codeDraft === project.html}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                >
                  Apply to canvas
                </button>
                <button
                  onClick={() => setCodeDraft(project.html || '')}
                  className="text-[11px] text-white/50 hover:text-white/80 px-2"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/45">Status</span>
            <select
              value={project.status}
              onChange={(e) => { setProject({ ...project, status: e.target.value }); save({ status: e.target.value }); }}
              className="flex-1 px-3 py-1.5 rounded-lg border text-white text-[11px] focus:outline-none"
              style={inputStyle}
            >
              <option value="drafting" className="bg-slate-900">Drafting</option>
              <option value="designed" className="bg-slate-900">Designed</option>
              <option value="rendered" className="bg-slate-900">Rendered</option>
              <option value="posted" className="bg-slate-900">Posted</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">{label}</div>
      {children}
    </div>
  );
}
