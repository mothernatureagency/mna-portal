'use client';

/**
 * Client portal — Content tab.
 *
 * Three sections, each shareable per client like the Overview sections:
 *   • Shot list — what we need captured at their location. Staff edit the
 *     list; the client ticks items off as they get them.
 *   • Content ideas — the client types a topic and gets a shot list and
 *     short scripts back.
 *   • Video performance — their top TikTok and YouTube videos.
 */

import { useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';
import { usePortalEdit } from '@/components/client-portal/PortalEditContext';
import PortalSection from '@/components/client-portal/PortalSection';
import { EditableText, EditButton } from '@/components/client-portal/PortalEditable';
import TikTokAnalytics from '@/components/dashboard/TikTokAnalytics';
import YouTubeAnalytics from '@/components/dashboard/YouTubeAnalytics';
import {
  DEFAULT_SHOT_LIST,
  SHOT_KINDS,
  SHOT_LIST_KEY,
  type ShotItem,
} from '@/lib/portal-layout';

type Ideas = {
  shotList: { shot: string; type: string; why: string }[];
  scripts: { title: string; hook: string; body: string; cta: string; length: string }[];
  hooks: string[];
  tips: string[];
};

export default function ClientContentPage() {
  const { client, isStaffPreview } = useClientPortal();
  const { editMode, title, setTitle } = usePortalEdit();
  const { gradientFrom, gradientTo } = client.branding;

  // ── Shot list ──
  const [shots, setShots] = useState<ShotItem[] | null>(null);
  const [savingShots, setSavingShots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=${SHOT_LIST_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setShots(Array.isArray(d?.value) && d.value.length ? d.value : DEFAULT_SHOT_LIST);
      })
      .catch(() => { if (!cancelled) setShots(DEFAULT_SHOT_LIST); });
    return () => { cancelled = true; };
  }, [client.id]);

  async function saveShots(next: ShotItem[]) {
    setShots(next);
    setSavingShots(true);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, key: SHOT_LIST_KEY, value: next }),
    }).catch(() => {});
    setSavingShots(false);
  }

  function patchShot(i: number, patch: Partial<ShotItem>) {
    if (!shots) return;
    saveShots(shots.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addShot() {
    if (!shots) return;
    saveShots([...shots, { id: `shot-${Date.now()}`, label: 'New shot', detail: '', kind: 'photo', done: false }]);
  }
  function removeShot(i: number) {
    if (!shots) return;
    saveShots(shots.filter((_, idx) => idx !== i));
  }

  const captured = shots?.filter((s) => s.done).length || 0;
  const total = shots?.length || 0;

  // ── Content ideas ──
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasErr, setIdeasErr] = useState<string | null>(null);

  async function generateIdeas() {
    const t = topic.trim();
    if (!t || ideasBusy) return;
    setIdeasBusy(true);
    setIdeasErr(null);
    setIdeas(null);
    try {
      const r = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: t,
          clientName: client.name,
          industry: client.industry,
          location: client.location,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setIdeasErr(d?.error || 'Could not generate ideas.'); return; }
      setIdeas(d);
    } catch {
      setIdeasErr('Could not reach the idea generator. Try again in a moment.');
    } finally {
      setIdeasBusy(false);
    }
  }

  // ── Social handles — only show the analytics we actually have ──
  const [handles, setHandles] = useState<{ tiktok?: string; youtube?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=tiktok_handle`).then((r) => r.json()).catch(() => null),
      fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=youtube_handle`).then((r) => r.json()).catch(() => null),
    ]).then(([tt, yt]) => {
      if (cancelled) return;
      setHandles({
        tiktok: typeof tt?.value === 'string' ? tt.value : undefined,
        youtube: typeof yt?.value === 'string' ? yt.value : undefined,
      });
    });
    return () => { cancelled = true; };
  }, [client.id]);

  const inputCls =
    'w-full px-3 py-2 rounded-lg text-white text-[13px] placeholder:text-white/40 focus:outline-none';
  const inputStyle = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Content</h1>
          <span
            className="text-[15px] font-medium ml-1"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {client.name}
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          What we need from you, ideas for what to make, and how your videos are doing.
        </p>
      </div>

      {/* ── Shot list ── */}
      <PortalSection id="content.shot-list">
        <div className="glass-card p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <EditableText
              value={title('content.shot-list', 'Shot list')}
              onChange={(v) => setTitle('content.shot-list', v)}
              className="text-[15px] font-bold text-white"
              placeholder="Section title"
              minCh={10}
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/50">
                {captured}/{total} captured{savingShots ? ' · saving…' : ''}
              </span>
              {editMode && <EditButton icon="add" label="Add shot" tone="accent" onClick={addShot} />}
            </div>
          </div>
          <p className="text-[11.5px] text-white/50 mb-4">
            Tick each one off as you get it — we&apos;ll see it update on our end.
          </p>

          {/* Progress */}
          {total > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(captured / total) * 100}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
              />
            </div>
          )}

          {shots === null ? (
            <div className="text-[12px] text-white/50 py-6 text-center">Loading…</div>
          ) : (
            <div className="space-y-2">
              {shots.map((s, i) => {
                const kind = SHOT_KINDS[s.kind] || SHOT_KINDS.photo;
                return (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                    style={{
                      background: s.done ? 'rgba(16,185,129,.10)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${s.done ? 'rgba(16,185,129,.28)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => patchShot(i, { done: !s.done })}
                      aria-label={s.done ? 'Mark as not captured' : 'Mark as captured'}
                      className="mt-0.5 w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        background: s.done ? '#10b981' : 'transparent',
                        border: s.done ? 'none' : '1.5px solid rgba(255,255,255,.35)',
                      }}
                    >
                      {s.done && (
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>check</span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EditableText
                          value={s.label}
                          onChange={(v) => patchShot(i, { label: v })}
                          className={`text-[13px] font-semibold ${s.done ? 'text-white/60 line-through' : 'text-white'}`}
                          placeholder="What to capture"
                          fullWidth={editMode}
                        />
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 shrink-0"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{kind.icon}</span>
                          {kind.label}
                        </span>
                      </div>
                      <EditableText
                        value={s.detail}
                        onChange={(v) => patchShot(i, { detail: v })}
                        className="text-[11.5px] text-white/55 block mt-0.5"
                        placeholder="Detail — framing, what matters"
                        fullWidth={editMode}
                      />
                      {editMode && (
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={s.kind}
                            onChange={(e) => patchShot(i, { kind: e.target.value })}
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg text-white focus:outline-none"
                            style={inputStyle}
                          >
                            {Object.entries(SHOT_KINDS).map(([k, v]) => (
                              <option key={k} value={k} className="bg-slate-900">{v.label}</option>
                            ))}
                          </select>
                          <EditButton icon="delete" label="Remove" tone="danger" onClick={() => removeShot(i)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {shots.length === 0 && (
                <div className="text-[12px] text-white/40 italic">Nothing on the shot list right now.</div>
              )}
            </div>
          )}
        </div>
      </PortalSection>

      {/* ── Content ideas ── */}
      <PortalSection id="content.ideas">
        <div className="glass-card p-4 md:p-6">
          <EditableText
            value={title('content.ideas', 'Content ideas')}
            onChange={(v) => setTitle('content.ideas', v)}
            className="text-[15px] font-bold text-white block"
            placeholder="Section title"
            minCh={12}
          />
          <p className="text-[11.5px] text-white/50 mt-0.5 mb-4">
            Tell us a topic and we&apos;ll turn it into a shot list and scripts you can film.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') generateIdeas(); }}
              placeholder="e.g. why hydration matters before the holidays"
              className={inputCls}
              style={inputStyle}
            />
            <button
              onClick={generateIdeas}
              disabled={!topic.trim() || ideasBusy}
              className="shrink-0 text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              {ideasBusy ? 'Thinking…' : 'Get ideas'}
            </button>
          </div>

          {ideasErr && <div className="text-[11.5px] text-rose-300 mt-2">{ideasErr}</div>}

          {ideasBusy && (
            <div className="text-[12px] text-white/50 py-6 text-center">
              Working out what to shoot and what to say…
            </div>
          )}

          {ideas && (
            <div className="mt-5 space-y-5">
              {ideas.shotList.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/45 mb-2">Shots to get</div>
                  <div className="space-y-2">
                    {ideas.shotList.map((s, i) => {
                      const kind = SHOT_KINDS[s.type] || SHOT_KINDS.photo;
                      return (
                        <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-white/40 mt-0.5 shrink-0" style={{ fontSize: 15 }}>{kind.icon}</span>
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-semibold text-white">{s.shot}</div>
                              {s.why && <div className="text-[11px] text-white/50 mt-0.5">{s.why}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {ideas.scripts.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/45 mb-2">Scripts</div>
                  <div className="space-y-2">
                    {ideas.scripts.map((sc, i) => (
                      <div key={i} className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="text-[12.5px] font-bold text-white">{sc.title}</div>
                          {sc.length && <span className="text-[10px] text-white/40 shrink-0">{sc.length}</span>}
                        </div>
                        <div className="text-[12px] text-white/85 leading-relaxed">
                          <span className="text-white/45">Hook · </span>{sc.hook}
                        </div>
                        <div className="text-[12px] text-white/75 leading-relaxed mt-1.5">{sc.body}</div>
                        {sc.cta && (
                          <div className="text-[12px] text-white/85 leading-relaxed mt-1.5">
                            <span className="text-white/45">Close · </span>{sc.cta}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ideas.hooks.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/45 mb-2">Other opening lines</div>
                  <ul className="space-y-1">
                    {ideas.hooks.map((h, i) => (
                      <li key={i} className="text-[12px] text-white/75 flex gap-2">
                        <span className="text-white/25">·</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ideas.tips.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/45 mb-1.5">Production notes</div>
                  <ul className="space-y-1">
                    {ideas.tips.map((t, i) => (
                      <li key={i} className="text-[11.5px] text-white/65 flex gap-2">
                        <span className="text-white/25">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </PortalSection>

      {/* ── Video performance ── */}
      <PortalSection id="content.analytics">
        <div className="space-y-4">
          {handles === null ? (
            <div className="glass-card p-6 text-[12px] text-white/50 text-center">Loading your video stats…</div>
          ) : !handles.tiktok && !handles.youtube && !isStaffPreview ? null : (
            <>
              {(handles.tiktok || isStaffPreview) && (
                <TikTokAnalytics
                  ownerKey={client.id}
                  kvClientId={client.id}
                  label={client.shortName}
                  gradientFrom={gradientFrom}
                  gradientTo={gradientTo}
                  niche={client.industry}
                  editable={isStaffPreview}
                />
              )}
              {(handles.youtube || isStaffPreview) && (
                <YouTubeAnalytics
                  ownerKey={client.id}
                  kvClientId={client.id}
                  label={client.shortName}
                  gradientFrom={gradientFrom}
                  gradientTo={gradientTo}
                  editable={isStaffPreview}
                />
              )}
            </>
          )}
        </div>
      </PortalSection>
    </div>
  );
}
