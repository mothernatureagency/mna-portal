'use client';

/**
 * Video Lab project workspace — tabs for Script, Voiceover, Shot List,
 * Footage Library, and Reference Inspiration.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { speak, cancelSpeak } from '@/lib/voice';

type Shot = { t: number; shot: string; voCopy: string; brollIdea: string };
type Clip = { id: string; url: string; name: string; tags: string; notes?: string };
type Reference = {
  id: string; url: string; notes?: string;
  summary?: string; hookPattern?: string; paceNotes?: string;
  audioStyle?: string; visualStyle?: string; replicateSteps?: string[];
  loading?: boolean; error?: string;
};

type Project = {
  id: string; client_id: string; title: string; platform: string;
  duration_sec: number; topic: string | null; script: string | null;
  shot_list: Shot[] | null; clips: Clip[] | null;
  references_list: Reference[] | null;
  voiceover_url: string | null; voiceover_voice: string | null;
  status: string;
};

type Tab = 'script' | 'voiceover' | 'shotlist' | 'clips' | 'refs';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'script',    label: 'Script',     icon: 'edit_note' },
  { id: 'voiceover', label: 'Voiceover',  icon: 'record_voice_over' },
  { id: 'shotlist',  label: 'Shot List',  icon: 'shutter_speed' },
  { id: 'clips',     label: 'Footage',    icon: 'video_library' },
  { id: 'refs',      label: 'References', icon: 'bookmark' },
];

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

export default function VideoLabProject() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('script');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    fetch(`/api/video-projects?id=${encodeURIComponent(params.id)}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function save(patch: Partial<Project>) {
    if (!project) return;
    setSaveMsg('Saving…');
    const r = await fetch('/api/video-projects', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, ...patch }),
    });
    const d = await r.json();
    if (r.ok && d.project) {
      setProject((prev) => prev ? { ...prev, ...d.project } : d.project);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 1500);
    } else {
      setSaveMsg(`Error: ${d.error || 'save failed'}`);
    }
  }

  if (loading) return <div className="text-white/55 text-center py-20 text-sm">Loading project…</div>;
  if (!project) return (
    <div className="text-white/55 text-center py-20 text-sm">
      Project not found. <Link href="/video-lab" className="underline">Back to Video Lab</Link>
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/video-lab" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Video Lab
        </Link>
        <div className="flex-1" />
        {saveMsg && <span className="text-[11px] text-white/60">{saveMsg}</span>}
      </div>

      {/* Title / meta */}
      <div className="glass-card p-5">
        <input
          type="text"
          value={project.title}
          onChange={(e) => setProject({ ...project, title: e.target.value })}
          onBlur={() => save({ title: project.title })}
          className="w-full text-[22px] font-extrabold text-white bg-transparent outline-none"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Platform</div>
            <select
              value={project.platform}
              onChange={(e) => { setProject({ ...project, platform: e.target.value }); save({ platform: e.target.value }); }}
              className="w-full px-3 py-1.5 rounded-lg border text-white text-[13px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              <option value="tiktok" className="bg-slate-900">TikTok</option>
              <option value="reels" className="bg-slate-900">Instagram Reels</option>
              <option value="youtube-shorts" className="bg-slate-900">YouTube Shorts</option>
              <option value="youtube-long" className="bg-slate-900">YouTube (long)</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Duration (sec)</div>
            <input
              type="number" min={10} max={1200}
              value={project.duration_sec}
              onChange={(e) => setProject({ ...project, duration_sec: Number(e.target.value) || 30 })}
              onBlur={() => save({ duration_sec: project.duration_sec })}
              className="w-full px-3 py-1.5 rounded-lg border text-white text-[13px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Status</div>
            <select
              value={project.status}
              onChange={(e) => { setProject({ ...project, status: e.target.value }); save({ status: e.target.value }); }}
              className="w-full px-3 py-1.5 rounded-lg border text-white text-[13px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              <option value="drafting" className="bg-slate-900">Drafting</option>
              <option value="in-edit" className="bg-slate-900">In Edit</option>
              <option value="ready" className="bg-slate-900">Ready to Post</option>
              <option value="posted" className="bg-slate-900">Posted</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Topic / Angle</div>
          <input
            type="text"
            value={project.topic || ''}
            onChange={(e) => setProject({ ...project, topic: e.target.value })}
            onBlur={() => save({ topic: project.topic })}
            placeholder="e.g. Beach Day Glow Drip — feeling refreshed after hot sand"
            className="w-full px-3 py-1.5 rounded-lg border text-white text-[13px] placeholder:text-white/40 focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition ${tab === t.id ? 'text-white' : 'text-white/65 hover:text-white/95 hover:bg-white/10'}`}
            style={tab === t.id ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'script' && <ScriptTab project={project} save={save} setProject={setProject} />}
      {tab === 'voiceover' && <VoiceoverTab project={project} save={save} setProject={setProject} />}
      {tab === 'shotlist' && <ShotListTab project={project} save={save} setProject={setProject} />}
      {tab === 'clips' && <ClipsTab project={project} save={save} setProject={setProject} />}
      {tab === 'refs' && <RefsTab project={project} save={save} setProject={setProject} />}
    </div>
  );
}

// ─── Script tab ────────────────────────────────────────────────────
function ScriptTab({ project, save, setProject }: { project: Project; save: (p: Partial<Project>) => void; setProject: (p: Project) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function generate() {
    setBusy(true); setErr('');
    try {
      const refs = (project.references_list || []).map((r) => r.url).slice(0, 5);
      const r = await fetch('/api/video-projects/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: project.topic || project.title,
          platform: project.platform,
          durationSec: project.duration_sec,
          references: refs,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generation failed');
      const patch: Partial<Project> = {
        script: d.script,
        shot_list: d.shotList || [],
      };
      setProject({ ...project, ...(patch as Project) });
      save(patch);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[14px] font-bold">Script</div>
          <div className="text-[11px] text-white/55">Spoken voiceover — no stage directions, no markdown</div>
        </div>
        <button
          onClick={generate} disabled={busy}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          {busy ? 'Generating…' : `✨ Generate Script${(project.references_list || []).length ? ' (using ' + (project.references_list || []).length + ' references)' : ''}`}
        </button>
      </div>
      {err && <div className="text-[11px] text-rose-300">{err}</div>}
      <textarea
        value={project.script || ''}
        onChange={(e) => setProject({ ...project, script: e.target.value })}
        onBlur={() => save({ script: project.script })}
        rows={14}
        placeholder={`Write or generate the spoken script here. Target ~${Math.round((project.duration_sec || 30) * 2.3)} words for ${project.duration_sec}s.`}
        className="w-full px-3 py-3 rounded-xl border text-white text-[14px] placeholder:text-white/40 focus:outline-none resize-none font-mono leading-relaxed"
        style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
      />
      <div className="flex items-center gap-3 text-[10px] text-white/45">
        <span>{(project.script || '').split(/\s+/).filter(Boolean).length} words</span>
        <span>~{Math.round((project.script || '').split(/\s+/).filter(Boolean).length / 2.5)}s spoken</span>
      </div>
    </div>
  );
}

// ─── Voiceover tab ─────────────────────────────────────────────────
function VoiceoverTab({ project, save, setProject }: { project: Project; save: (p: Partial<Project>) => void; setProject: (p: Project) => void }) {
  const [voices, setVoices] = useState<any[]>([]);
  const [voiceId, setVoiceId] = useState<string>(project.voiceover_voice || '21m00Tcm4TlvDq8ikWAM');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(project.voiceover_url);
  const [keyMissing, setKeyMissing] = useState(false);

  useEffect(() => {
    fetch('/api/video-projects/voiceover').then((r) => r.json()).then((d) => {
      if (d.voices) setVoices(d.voices);
      if (d.error) setKeyMissing(true);
    }).catch(() => {});
  }, []);

  async function generate() {
    if (!project.script?.trim()) { setErr('Write or generate a script first.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/video-projects/voiceover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: project.script, voiceId }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Voiceover failed');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setProject({ ...project, voiceover_url: url, voiceover_voice: voiceId });
      // Note: object URL is in-browser only — re-generation needed after a reload.
      // For persistent storage we'd upload the blob to Cloudinary/R2; future enhancement.
      save({ voiceover_voice: voiceId });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function previewBrowser() {
    if (!project.script) return;
    cancelSpeak();
    speak(project.script, { rate: 0.95, pitch: 1.0 });
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <div className="text-[14px] font-bold">AI Voiceover</div>
        <div className="text-[11px] text-white/55">Powered by ElevenLabs · falls back to browser speech if the key isn't set</div>
      </div>

      {keyMissing && (
        <div className="rounded-xl p-3 text-[11px]" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <span className="font-bold text-amber-200">ElevenLabs key not set.</span>
          <span className="text-white/70"> Add <code className="text-white">ELEVENLABS_API_KEY</code> to Vercel env vars for natural AI voiceovers. Browser preview still works below.</span>
        </div>
      )}

      {voices.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Voice</div>
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-white text-[13px] focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id} className="bg-slate-900">
                {v.name} {v.labels?.gender ? `· ${v.labels.gender}` : ''} {v.labels?.accent ? `· ${v.labels.accent}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={generate}
          disabled={busy || !project.script}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          {busy ? 'Generating…' : '🎙️ Generate Voiceover'}
        </button>
        <button
          onClick={previewBrowser}
          disabled={!project.script}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          🔊 Browser Preview
        </button>
        {audioUrl && (
          <a href={audioUrl} download={`${project.title.replace(/[^\w]+/g, '-').toLowerCase()}-vo.mp3`}
             className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
             style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(52,211,153,0.4)' }}>
            ⬇️ Download MP3
          </a>
        )}
      </div>
      {err && <div className="text-[11px] text-rose-300">{err}</div>}

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full mt-2 rounded-lg" />
      )}

      <div className="text-[10px] text-white/40 leading-relaxed pt-2 border-t border-white/10">
        The MP3 preview above is in-memory only for this session. Download it to your machine
        (or drop into CapCut/Descript as the voiceover track) — we don't stash audio on our
        server. For persistent storage, upload to Cloudinary/Drive and paste the URL in Footage.
      </div>
    </div>
  );
}

// ─── Shot List tab ─────────────────────────────────────────────────
function ShotListTab({ project, save, setProject }: { project: Project; save: (p: Partial<Project>) => void; setProject: (p: Project) => void }) {
  const shots: Shot[] = project.shot_list || [];

  function update(idx: number, patch: Partial<Shot>) {
    const next = shots.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setProject({ ...project, shot_list: next });
    save({ shot_list: next });
  }
  function add() {
    const next = [...shots, { t: shots.length ? shots[shots.length - 1].t + 5 : 0, shot: '', voCopy: '', brollIdea: '' }];
    setProject({ ...project, shot_list: next });
    save({ shot_list: next });
  }
  function remove(idx: number) {
    const next = shots.filter((_, i) => i !== idx);
    setProject({ ...project, shot_list: next });
    save({ shot_list: next });
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[14px] font-bold">Shot List</div>
          <div className="text-[11px] text-white/55">{shots.length} shots · {project.duration_sec}s total</div>
        </div>
        <button
          onClick={add}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          + Add Shot
        </button>
      </div>
      {shots.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-6">
          No shots yet — generate a script on the Script tab to auto-fill this list.
        </div>
      ) : (
        <div className="space-y-2">
          {shots.map((s, i) => (
            <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/45">Shot {i + 1}</span>
                <input
                  type="number" min={0} max={project.duration_sec}
                  value={s.t}
                  onChange={(e) => update(i, { t: Number(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 rounded text-white text-[11px] outline-none"
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}
                />
                <span className="text-[10px] text-white/45">sec</span>
                <button onClick={() => remove(i)} className="ml-auto text-white/30 hover:text-rose-400">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
              <input
                type="text"
                value={s.shot}
                onChange={(e) => update(i, { shot: e.target.value })}
                placeholder="Shot description"
                className="w-full px-3 py-1.5 rounded-lg border text-white text-[13px] placeholder:text-white/40 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <textarea
                value={s.voCopy}
                onChange={(e) => update(i, { voCopy: e.target.value })}
                placeholder="VO line spoken during this shot"
                rows={2}
                className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none resize-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <input
                type="text"
                value={s.brollIdea}
                onChange={(e) => update(i, { brollIdea: e.target.value })}
                placeholder="B-roll / text overlay idea"
                className="w-full px-3 py-1.5 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Footage tab ───────────────────────────────────────────────────
function ClipsTab({ project, save, setProject }: { project: Project; save: (p: Partial<Project>) => void; setProject: (p: Project) => void }) {
  const clips: Clip[] = project.clips || [];
  const [draft, setDraft] = useState<Omit<Clip, 'id'>>({ url: '', name: '', tags: '', notes: '' });

  function add() {
    if (!draft.url.trim()) return;
    const next = [...clips, { id: uid(), ...draft }];
    setProject({ ...project, clips: next });
    save({ clips: next });
    setDraft({ url: '', name: '', tags: '', notes: '' });
  }
  function remove(id: string) {
    const next = clips.filter((c) => c.id !== id);
    setProject({ ...project, clips: next });
    save({ clips: next });
  }
  function update(id: string, patch: Partial<Clip>) {
    const next = clips.map((c) => c.id === id ? { ...c, ...patch } : c);
    setProject({ ...project, clips: next });
    save({ clips: next });
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div>
        <div className="text-[14px] font-bold">Footage Library</div>
        <div className="text-[11px] text-white/55">Drop URLs to clips hosted on Drive / Dropbox / Cloudinary. Videos themselves stay where they are — we track metadata.</div>
      </div>

      <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <input
          type="url"
          placeholder="Clip URL (Drive share link, Cloudinary, etc.)"
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/40 focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text" placeholder="Name (e.g. Grayton sunrise run)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          <input
            type="text" placeholder="Tags (beach, woman, sunset)"
            value={draft.tags}
            onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
        </div>
        <button
          onClick={add}
          disabled={!draft.url.trim()}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          Add Clip
        </button>
      </div>

      {clips.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-6">No clips tracked yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {clips.map((c) => (
            <div key={c.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate">{c.name || 'Untitled clip'}</div>
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-300 hover:text-sky-200 truncate block">{c.url}</a>
                  {c.tags && <div className="text-[10px] text-white/50 mt-1">{c.tags}</div>}
                </div>
                <button onClick={() => remove(c.id)} className="text-white/30 hover:text-rose-400 shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── References tab ────────────────────────────────────────────────
function RefsTab({ project, save, setProject }: { project: Project; save: (p: Partial<Project>) => void; setProject: (p: Project) => void }) {
  const refs: Reference[] = project.references_list || [];
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  async function analyze() {
    if (!url.trim()) return;
    const pending: Reference = { id: uid(), url: url.trim(), notes: notes.trim() || undefined, loading: true };
    const next = [pending, ...refs];
    setProject({ ...project, references_list: next });
    save({ references_list: next });
    setUrl(''); setNotes('');
    try {
      const r = await fetch('/api/video-projects/references', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pending.url, notes: pending.notes }),
      });
      const d = await r.json();
      const updated = next.map((x) => x.id === pending.id
        ? { ...x, loading: false, ...(d.error ? { error: d.error } : d) }
        : x);
      setProject({ ...project, references_list: updated });
      save({ references_list: updated });
    } catch (e: any) {
      const updated = next.map((x) => x.id === pending.id ? { ...x, loading: false, error: e.message } : x);
      setProject({ ...project, references_list: updated });
      save({ references_list: updated });
    }
  }

  function remove(id: string) {
    const next = refs.filter((r) => r.id !== id);
    setProject({ ...project, references_list: next });
    save({ references_list: next });
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div>
        <div className="text-[14px] font-bold">Reference Inspiration</div>
        <div className="text-[11px] text-white/55">Drop URLs of TikToks, Reels, or channels like viralvacations.com — AI breaks down the style to replicate.</div>
      </div>
      <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <input
          type="url"
          placeholder="Reference URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/40 focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
        />
        <textarea
          rows={2}
          placeholder="Notes (optional — what do you like about it?)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/40 focus:outline-none resize-none"
          style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
        />
        <button
          onClick={analyze}
          disabled={!url.trim()}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          ✨ Add + Analyze
        </button>
      </div>

      {refs.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-6">No references yet.</div>
      ) : (
        <div className="space-y-2">
          {refs.map((r) => (
            <div key={r.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #4ab8ce' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-300 hover:text-sky-200 truncate flex-1">{r.url}</a>
                <button onClick={() => remove(r.id)} className="text-white/30 hover:text-rose-400 shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
              {r.loading && <div className="text-[11px] text-white/55">Analyzing…</div>}
              {r.error && <div className="text-[11px] text-rose-300">Error: {r.error}</div>}
              {!r.loading && !r.error && r.summary && (
                <div className="space-y-2 text-[12px]">
                  <div className="text-white/85 font-semibold">{r.summary}</div>
                  {r.hookPattern && <Bit label="Hook" val={r.hookPattern} />}
                  {r.paceNotes && <Bit label="Pace" val={r.paceNotes} />}
                  {r.audioStyle && <Bit label="Audio" val={r.audioStyle} />}
                  {r.visualStyle && <Bit label="Visual" val={r.visualStyle} />}
                  {r.replicateSteps && r.replicateSteps.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/45 mb-1">Replicate Steps</div>
                      <ul className="space-y-0.5">
                        {r.replicateSteps.map((s, i) => (
                          <li key={i} className="text-[11px] text-white/75">· {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bit({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-wider font-bold text-white/45">{label}: </span>
      <span className="text-[11px] text-white/75">{val}</span>
    </div>
  );
}
