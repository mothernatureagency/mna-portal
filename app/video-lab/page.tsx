'use client';

/**
 * Video Lab — TikTok / YouTube project hub.
 *
 * List of projects per active client. Each project holds a script,
 * shot list, AI voiceover, clip library, and inspiration references.
 * Realistically this covers the pre-production + voiceover side —
 * timeline assembly still happens in CapCut / Descript with the exported
 * script + shot list + voiceover track.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClient } from '@/context/ClientContext';

type Project = {
  id: string;
  client_id: string;
  title: string;
  platform: string;
  duration_sec: number;
  topic: string | null;
  status: string;
  updated_at: string;
  created_at: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  'youtube-shorts': 'YouTube Shorts',
  'youtube-long': 'YouTube (long)',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VideoLabList() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', platform: 'tiktok', duration: 30, topic: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/video-projects?clientId=${encodeURIComponent(activeClient.id)}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  }, [activeClient.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/video-projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: activeClient.id, ...draft }),
      });
      const d = await r.json();
      if (r.ok && d.project) {
        window.location.href = `/video-lab/${d.project.id}`;
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 24 }}>movie</span>
            <h1 className="text-[24px] font-extrabold text-white">Video Lab</h1>
          </div>
          <p className="text-[12px] text-white/55 mt-1">
            TikTok / YouTube project workspace · AI scripts · AI voiceovers · shot lists · footage library
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
        >
          {showForm ? 'Cancel' : '+ New Video Project'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="glass-card p-5 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Project title (e.g. Beach Day at Grayton · Prime IV glow drip)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border text-white text-[14px] placeholder:text-white/45 focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              <option value="tiktok" className="bg-slate-900">TikTok</option>
              <option value="reels" className="bg-slate-900">Instagram Reels</option>
              <option value="youtube-shorts" className="bg-slate-900">YouTube Shorts</option>
              <option value="youtube-long" className="bg-slate-900">YouTube (long)</option>
            </select>
            <input
              type="number" min={10} max={1200}
              value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) || 30 })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              placeholder="Duration (sec)"
            />
            <input
              type="text"
              placeholder="Topic / angle (optional)"
              value={draft.topic}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/45 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !draft.title.trim()}
            className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            {busy ? 'Creating…' : 'Create Project →'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-[12px] text-white/55 py-10 text-center">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: gradientTo, opacity: 0.5 }}>movie_filter</span>
          <div className="text-[14px] font-bold">No video projects yet</div>
          <p className="text-[12px] text-white/55 mt-1">
            Click <span className="text-white font-semibold">+ New Video Project</span> to start your first TikTok or YouTube build.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/video-lab/${p.id}`}
              className="glass-card p-4 transition hover:scale-[1.02]"
              style={{ borderLeft: `3px solid ${gradientFrom}` }}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                  {PLATFORM_LABEL[p.platform] || p.platform}
                </span>
                <span className="text-[9px] text-white/45">{p.duration_sec}s</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: p.status === 'drafting' ? 'rgba(245,158,11,0.18)' : p.status === 'ready' ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)', color: p.status === 'drafting' ? '#fbbf24' : p.status === 'ready' ? '#34d399' : 'rgba(255,255,255,0.6)' }}>
                  {p.status}
                </span>
              </div>
              <div className="text-[14px] font-bold text-white">{p.title}</div>
              {p.topic && <div className="text-[11px] text-white/65 mt-1 line-clamp-2">{p.topic}</div>}
              <div className="text-[10px] text-white/40 mt-2">Updated {fmtDate(p.updated_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
