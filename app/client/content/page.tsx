'use client';

import { useCallback, useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

type ShotItem = {
  id: string; title: string; description: string | null; shot_type: string | null;
  platform: string | null; priority: string; status: string;
};
type Concept = { id: string; title: string; body: string | null; tags: string | null; used_at: string | null };
type PostIdea = { title: string; hook: string; caption: string; format: string; platform: string };
type TikTokIdea = { title: string; hook: string; format: string; sound?: string; hashtags?: string[] };
type ShotSuggestion = { title: string; description: string; shotType: string; platform: string; priority: string };
type GenResults = { postIdeas: PostIdea[]; tiktokIdeas: TikTokIdea[]; shotList: ShotSuggestion[] };

const STATUS_META: Record<string, { label: string; cls: string; icon: string }> = {
  needed:    { label: 'To Shoot',  cls: 'bg-white/10 text-white/70',          icon: 'radio_button_unchecked' },
  scheduled: { label: 'Scheduled', cls: 'bg-sky-500/20 text-sky-300',         icon: 'event' },
  captured:  { label: 'Captured',  cls: 'bg-emerald-500/20 text-emerald-300', icon: 'check_circle' },
};
const NEXT_STATUS: Record<string, string> = { needed: 'scheduled', scheduled: 'captured', captured: 'needed' };
const PRIORITY_CLS: Record<string, string> = {
  high: 'bg-rose-500/15 text-rose-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-white/10 text-white/50',
};

function SectionHeader({ title, sub, gradientFrom, gradientTo }: { title: string; sub: string; gradientFrom: string; gradientTo: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-5 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
        <h2 className="text-[16px] font-extrabold text-white tracking-tight">{title}</h2>
      </div>
      <p className="text-[11px] text-white/50 pl-3.5 mt-0.5">{sub}</p>
    </div>
  );
}

export default function ClientContentStudioPage() {
  const { client } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;

  const [shots, setShots] = useState<ShotItem[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);

  // AI generation
  const [focus, setFocus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [results, setResults] = useState<GenResults | null>(null);

  // Add forms
  const [newShot, setNewShot] = useState('');
  const [newIdea, setNewIdea] = useState('');

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([
      fetch(`/api/shot-list?clientId=${encodeURIComponent(client.id)}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/content-concepts?clientId=${encodeURIComponent(client.id)}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setShots(s.items || []);
    setConcepts(c.concepts || []);
  }, [client.id]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function generate() {
    setGenerating(true);
    setGenError('');
    try {
      const r = await fetch('/api/client/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, focus: focus.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generation failed');
      setResults(d);
    } catch (e: any) {
      setGenError(e?.message || 'Generation failed — try again in a minute.');
    } finally {
      setGenerating(false);
    }
  }

  async function addShot(item: { title: string; description?: string; shotType?: string; platform?: string; priority?: string }) {
    await fetch('/api/shot-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, ...item }),
    });
    refresh();
  }

  async function cycleShotStatus(item: ShotItem) {
    const status = NEXT_STATUS[item.status] || 'needed';
    setShots((prev) => prev.map((s) => (s.id === item.id ? { ...s, status } : s)));
    await fetch('/api/shot-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status }),
    });
  }

  async function deleteShot(id: string) {
    setShots((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/shot-list?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function addConcept(c: { title: string; body?: string; tags?: string }) {
    await fetch('/api/content-concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, ...c }),
    });
    refresh();
  }

  async function deleteConcept(id: string) {
    setConcepts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/content-concepts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  function savePostIdea(idea: PostIdea, idx: number) {
    addConcept({
      title: idea.title,
      body: `Hook: ${idea.hook}\n\n${idea.caption}`,
      tags: [idea.format, idea.platform].filter(Boolean).join(', '),
    });
    setResults((r) => r && { ...r, postIdeas: r.postIdeas.filter((_, i) => i !== idx) });
  }

  function saveTikTokIdea(idea: TikTokIdea, idx: number) {
    addConcept({
      title: idea.title,
      body: `Hook: ${idea.hook}${idea.sound ? `\nSound: ${idea.sound}` : ''}${idea.hashtags?.length ? `\nHashtags: ${idea.hashtags.join(' ')}` : ''}`,
      tags: ['tiktok', idea.format].filter(Boolean).join(', '),
    });
    setResults((r) => r && { ...r, tiktokIdeas: r.tiktokIdeas.filter((_, i) => i !== idx) });
  }

  function saveShotSuggestion(s: ShotSuggestion, idx: number) {
    addShot({ title: s.title, description: s.description, shotType: s.shotType, platform: s.platform, priority: s.priority });
    setResults((r) => r && { ...r, shotList: r.shotList.filter((_, i) => i !== idx) });
  }

  const inputCls =
    'bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white placeholder-white/30 focus:outline-none focus:border-white/25 w-full';

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Content Studio</h1>
          <span
            className="text-[15px] font-medium ml-1"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {client.name}
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Plan what to shoot and what to post — your shot list, idea bank, and an AI brainstorm tuned to your business.
        </p>
      </div>

      {/* ── AI Generator ── */}
      <section>
        <SectionHeader
          title="Brainstorm With AI"
          sub="Fresh post ideas, TikTok concepts, and a matching shot list — generated for your business, saved only when you keep them."
          gradientFrom={gradientFrom} gradientTo={gradientTo}
        />
        <div className="glass-card p-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputCls}
              placeholder="Optional focus — e.g. 'holiday promo', 'new service launch', 'behind the scenes'"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) generate(); }}
            />
            <button
              onClick={generate}
              disabled={generating}
              className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              <span className={`material-symbols-outlined ${generating ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
                {generating ? 'progress_activity' : 'auto_awesome'}
              </span>
              {generating ? 'Thinking…' : 'Generate Ideas'}
            </button>
          </div>
          {genError && <div className="text-[11px] text-rose-300 mt-2">{genError}</div>}

          {results && (
            <div className="mt-5 space-y-6">
              {/* Post ideas */}
              {results.postIdeas.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Post Ideas</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {results.postIdeas.map((idea, i) => (
                      <div key={i} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[12px] font-bold text-white">{idea.title}</div>
                          <button
                            onClick={() => savePostIdea(idea, i)}
                            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                          >
                            + Save
                          </button>
                        </div>
                        <div className="text-[11px] text-white/70 mt-1 italic">&ldquo;{idea.hook}&rdquo;</div>
                        <div className="text-[11px] text-white/50 mt-1">{idea.caption}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-white/35 mt-2">{idea.format} · {idea.platform}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TikTok ideas */}
              {results.tiktokIdeas.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">TikTok Concepts</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {results.tiktokIdeas.map((idea, i) => (
                      <div key={i} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[12px] font-bold text-white">{idea.title}</div>
                          <button
                            onClick={() => saveTikTokIdea(idea, i)}
                            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                          >
                            + Save
                          </button>
                        </div>
                        <div className="text-[11px] text-white/70 mt-1 italic">&ldquo;{idea.hook}&rdquo;</div>
                        <div className="text-[10px] text-white/50 mt-1.5">{idea.format}{idea.sound ? ` · ${idea.sound}` : ''}</div>
                        {idea.hashtags && idea.hashtags.length > 0 && (
                          <div className="text-[10px] text-sky-300/80 mt-1">{idea.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shot suggestions */}
              {results.shotList.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Suggested Shots</div>
                  <div className="space-y-2">
                    {results.shotList.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)' }}>
                        <span className="material-symbols-outlined text-white/40 mt-0.5" style={{ fontSize: 18 }}>videocam</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-white">{s.title}</div>
                          <div className="text-[11px] text-white/55 mt-0.5">{s.description}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-white/35 mt-1.5">{s.shotType} · {s.platform} · {s.priority} priority</div>
                        </div>
                        <button
                          onClick={() => saveShotSuggestion(s, i)}
                          className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                        >
                          + Add to Shot List
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Shot List ── */}
      <section>
        <SectionHeader
          title="Shot List"
          sub="Everything to film or photograph next — tap the status to move a shot from To Shoot → Scheduled → Captured."
          gradientFrom={gradientFrom} gradientTo={gradientTo}
        />
        <div className="glass-card p-5">
          <div className="flex gap-2 mb-4">
            <input
              className={inputCls}
              placeholder="Add a shot — e.g. 'Close-up of the treatment room setup'"
              value={newShot}
              onChange={(e) => setNewShot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newShot.trim()) { addShot({ title: newShot.trim() }); setNewShot(''); }
              }}
            />
            <button
              onClick={() => { if (newShot.trim()) { addShot({ title: newShot.trim() }); setNewShot(''); } }}
              className="shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              Add
            </button>
          </div>

          {loading ? (
            <div className="text-[12px] text-white/40 py-4 text-center">Loading…</div>
          ) : shots.length === 0 ? (
            <div className="text-[12px] text-white/40 py-4 text-center">
              No shots yet — add one above or let the AI brainstorm suggest a batch.
            </div>
          ) : (
            <div className="space-y-1.5">
              {shots.map((item) => {
                const meta = STATUS_META[item.status] || STATUS_META.needed;
                return (
                  <div key={item.id} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                    <button
                      onClick={() => cycleShotStatus(item)}
                      title="Change status"
                      className={`shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full transition-colors ${meta.cls}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{meta.icon}</span>
                      {meta.label}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12.5px] font-semibold ${item.status === 'captured' ? 'text-white/40 line-through' : 'text-white'}`}>
                        {item.title}
                      </div>
                      {item.description && <div className="text-[11px] text-white/50 mt-0.5">{item.description}</div>}
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.shot_type && <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">{item.shot_type}</span>}
                        {item.platform && <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">· {item.platform}</span>}
                        <span className={`text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${PRIORITY_CLS[item.priority] || PRIORITY_CLS.low}`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteShot(item.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-rose-300 transition-all"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Idea Bank ── */}
      <section>
        <SectionHeader
          title="Idea Bank"
          sub="Content angles and concepts saved for upcoming posts — the MNA team pulls from this when planning your calendar."
          gradientFrom={gradientFrom} gradientTo={gradientTo}
        />
        <div className="glass-card p-5">
          <div className="flex gap-2 mb-4">
            <input
              className={inputCls}
              placeholder="Add an idea — e.g. 'Client transformation story series'"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newIdea.trim()) { addConcept({ title: newIdea.trim() }); setNewIdea(''); }
              }}
            />
            <button
              onClick={() => { if (newIdea.trim()) { addConcept({ title: newIdea.trim() }); setNewIdea(''); } }}
              className="shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              Add
            </button>
          </div>

          {loading ? (
            <div className="text-[12px] text-white/40 py-4 text-center">Loading…</div>
          ) : concepts.length === 0 ? (
            <div className="text-[12px] text-white/40 py-4 text-center">
              The idea bank is empty — save ideas from the AI brainstorm or add your own above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {concepts.map((c) => (
                <div key={c.id} className="group rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-bold text-white">{c.title}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.used_at && (
                        <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Used</span>
                      )}
                      <button
                        onClick={() => deleteConcept(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-rose-300 transition-all"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                      </button>
                    </div>
                  </div>
                  {c.body && <div className="text-[11px] text-white/55 mt-1 whitespace-pre-line line-clamp-4">{c.body}</div>}
                  {c.tags && <div className="text-[9px] font-bold uppercase tracking-wider text-white/35 mt-2">{c.tags}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
