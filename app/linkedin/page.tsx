'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ApprovalStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'scheduled';

type LinkedInPost = {
  id: string;
  post_date: string;
  platform: string;
  content_type: string | null;
  title: string | null;
  status: string;
  assigned_role: string | null;
  caption: string | null;
  client_approval_status: ApprovalStatus | null;
  client_comments: string | null;
  mna_comments: string | null;
  approved_at: string | null;
  photo_drive_url: string | null;
  client_visible: boolean;
};

const MNA_EMAILS = [
  'mn@mothernatureagency.com',
  'admin@mothernatureagency.com',
  'info@mothernatureagency.com',
];

const MNA_CLIENT_NAME = 'Mother Nature Agency';

const LINKEDIN_POST_TYPES = ['Post', 'Article', 'Poll', 'Document', 'Newsletter', 'Event'];

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; bg: string; text: string; strike?: boolean }> = {
  drafting:           { label: 'Drafting',          bg: 'bg-white/5',          text: 'text-white/60 italic' },
  pending_review:     { label: 'Ready for review',  bg: 'bg-amber-400/15',     text: 'text-amber-200' },
  approved:           { label: 'Approved',          bg: 'bg-emerald-400/20',   text: 'text-emerald-200' },
  changes_requested:  { label: 'Changes requested', bg: 'bg-rose-400/20',      text: 'text-rose-200' },
  scheduled:          { label: 'Scheduled',         bg: 'bg-sky-400/20',       text: 'text-sky-200', strike: true },
};

function toDateOnly(s: string): string {
  if (!s) return s;
  if (s.length === 10) return s;
  try {
    const d = new Date(s);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  } catch { return s.slice(0, 10); }
}

function fmtDate(iso: string) {
  try {
    const clean = toDateOnly(iso);
    const d = new Date(`${clean}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function monthKey(d: string) { return d.slice(0, 7); }
function formatMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function daysInMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function firstWeekday(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).getDay();
}

function parseTitle(raw: string | null) {
  if (!raw) return { phase: '', title: '', hook: '', cta: '' };
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const phase = phaseMatch ? phaseMatch[1] : '';
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  const title = hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
  let hook = '', cta = '';
  if (hookIdx >= 0) {
    const afterHook = rest.slice(hookIdx + ' — Hook:'.length);
    const ctaIdx = afterHook.indexOf('| CTA:');
    if (ctaIdx >= 0) {
      hook = afterHook.slice(0, ctaIdx).trim();
      cta = afterHook.slice(ctaIdx + '| CTA:'.length).trim();
    } else { hook = afterHook.trim(); }
  }
  return { phase, title, hook, cta };
}

// Generate an array of dates for the next N weeks (Mon/Wed/Fri by default)
function suggestDates(count: number, freq: 'mwf' | 'daily' | 'mw' | 'weekly'): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (freq === 'daily') dates.push(d.toISOString().slice(0, 10));
    else if (freq === 'mwf' && (day === 1 || day === 3 || day === 5)) dates.push(d.toISOString().slice(0, 10));
    else if (freq === 'mw' && (day === 1 || day === 3)) dates.push(d.toISOString().slice(0, 10));
    else if (freq === 'weekly' && day === 2) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function LinkedInPage() {
  const [posts, _setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('calendar');
  const [showPastMonths, setShowPastMonths] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('all');

  // AI generate panel
  const [showGenerate, setShowGenerate] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genPostType, setGenPostType] = useState('Post');
  const [genFreq, setGenFreq] = useState<'mwf' | 'daily' | 'mw' | 'weekly'>('mwf');
  const [genCount, setGenCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Add post
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPost, setNewPost] = useState({ post_date: '', content_type: 'Post', title: '', caption: '' });

  // Editing
  const [writingId, setWritingId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  function setPosts(updater: LinkedInPost[] | ((p: LinkedInPost[]) => LinkedInPost[])) {
    _setPosts((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((p) => ({ ...p, post_date: toDateOnly(p.post_date) }));
    });
  }

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsStaff(MNA_EMAILS.includes(user?.email || ''));
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/content-calendar?client=${encodeURIComponent(MNA_CLIENT_NAME)}`);
      const d = await r.json();
      const all: LinkedInPost[] = (d.items || []).filter((p: LinkedInPost) => p.platform === 'LinkedIn');
      setPosts(all);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function patchPost(id: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/content-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.item } : p)));
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this LinkedIn post?')) return;
    await fetch(`/api/content-calendar?id=${id}`, { method: 'DELETE' });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function writeCopy(id: string) {
    setWritingId(id);
    try {
      const res = await fetch(`/api/content-calendar/${id}/write-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPosts((prev) => prev.map((p) => (p.id === id ? data.item : p)));
      setExpanded((e) => ({ ...e, [id]: true }));
    } catch (e: any) { alert(e.message); }
    finally { setWritingId(null); }
  }

  async function generatePlan() {
    if (!genTopic.trim()) { setGenError('Please enter a topic or theme.'); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const days = suggestDates(genCount, genFreq);
      const res = await fetch('/api/content-calendar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: MNA_CLIENT_NAME,
          days,
          topic: genTopic.trim(),
          platform: 'LinkedIn',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setShowGenerate(false);
      setGenTopic('');
      await load();
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function addPost() {
    if (!newPost.post_date || !newPost.title) { alert('Date and title are required'); return; }
    const res = await fetch('/api/content-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: MNA_CLIENT_NAME,
        items: [{
          post_date: newPost.post_date,
          platform: 'LinkedIn',
          content_type: newPost.content_type || null,
          title: newPost.title,
          caption: newPost.caption || null,
          status: 'Draft',
          assigned_role: 'Social Media Manager',
        }],
      }),
    });
    if (!res.ok) { alert('Failed to add post'); return; }
    setNewPost({ post_date: '', content_type: 'Post', title: '', caption: '' });
    setShowAddForm(false);
    await load();
  }

  // Approval counts
  const byApproval: Record<ApprovalStatus, number> = {
    drafting: 0, pending_review: 0, approved: 0, changes_requested: 0, scheduled: 0,
  };
  posts.forEach((p) => {
    const s = (p.client_approval_status || 'pending_review') as ApprovalStatus;
    if (byApproval[s] !== undefined) byApproval[s]++;
  });

  const filtered = approvalFilter === 'all'
    ? posts
    : posts.filter((p) => (p.client_approval_status || 'pending_review') === approvalFilter);

  const shown = [...filtered].sort((a, b) => a.post_date.localeCompare(b.post_date));

  const nowMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { calendarMonths, pastMonthCount } = useMemo(() => {
    const map = new Map<string, LinkedInPost[]>();
    for (const p of shown) {
      const k = monthKey(p.post_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    const all = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const past = all.filter(([k]) => k < nowMonthKey);
    const visible = showPastMonths ? all : all.filter(([k]) => k >= nowMonthKey);
    return { calendarMonths: visible, pastMonthCount: past.length };
  }, [shown, nowMonthKey, showPastMonths]);

  const activePost = posts.find((p) => p.id === activeId) || null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#0077b5' }}
            >
              <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">LinkedIn</h1>
              <p className="text-white/60 text-sm mt-0.5">Mother Nature Agency · {posts.length} posts</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
              Calendar
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span>
              Cards
            </button>
          </div>
          {isStaff && (
            <>
              <button
                onClick={() => { setShowGenerate(!showGenerate); setShowAddForm(false); }}
                className="text-[12px] font-bold px-4 py-2 rounded-xl text-white flex items-center gap-1.5"
                style={{ background: showGenerate ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                AI Generate Plan
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setShowGenerate(false); }}
                className="text-[12px] font-bold px-4 py-2 rounded-xl text-white border border-white/20 bg-white/5 hover:bg-white/10"
              >
                + Add Post
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Generate panel */}
      {isStaff && showGenerate && (
        <div
          className="glass-card p-5 space-y-4"
          style={{ borderLeft: '3px solid #0077b5' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#0077b5]" style={{ fontSize: 20 }}>auto_awesome</span>
            <div className="text-white font-bold text-sm">AI LinkedIn Content Plan</div>
            <div className="text-white/50 text-xs">Generates a full calendar of LinkedIn posts for Mother Nature Agency</div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">Topic / Theme</label>
            <textarea
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="e.g. Agency expertise, wellness marketing insights, client success stories, thought leadership, behind-the-scenes, industry trends..."
              rows={2}
              className="w-full text-[13px] px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">Post Type</label>
              <select
                value={genPostType}
                onChange={(e) => setGenPostType(e.target.value)}
                className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
              >
                {LINKEDIN_POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">Posting Frequency</label>
              <select
                value={genFreq}
                onChange={(e) => setGenFreq(e.target.value as any)}
                className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
              >
                <option value="mwf">3x/week (Mon, Wed, Fri)</option>
                <option value="mw">2x/week (Mon, Wed)</option>
                <option value="weekly">1x/week (Tuesday)</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1.5">Number of Posts</label>
              <select
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
              >
                {[4, 6, 8, 10, 12, 16, 20].map((n) => <option key={n} value={n}>{n} posts</option>)}
              </select>
            </div>
          </div>

          {genError && (
            <div className="text-rose-300 text-[12px] bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{genError}</div>
          )}

          <div className="flex gap-2 items-center">
            <button
              onClick={generatePlan}
              disabled={generating}
              className="font-bold px-5 py-2.5 rounded-xl text-white text-[13px] disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  Generating {genCount} posts…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                  Generate {genCount} LinkedIn Posts
                </>
              )}
            </button>
            <button
              onClick={() => setShowGenerate(false)}
              className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual add form */}
      {isStaff && showAddForm && (
        <div className="glass-card p-5 space-y-3">
          <div className="text-white font-semibold text-sm">Add LinkedIn Post</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={newPost.post_date}
              onChange={(e) => setNewPost({ ...newPost, post_date: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
            <select
              value={newPost.content_type}
              onChange={(e) => setNewPost({ ...newPost, content_type: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            >
              {LINKEDIN_POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input
            type="text"
            placeholder="Post title..."
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
          />
          <textarea
            placeholder="Caption (optional)..."
            value={newPost.caption}
            onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
            rows={3}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 resize-none"
          />
          <button
            onClick={addPost}
            className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
          >
            Add Post
          </button>
        </div>
      )}

      {/* Approval filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mr-1">Status</span>
        <button
          onClick={() => setApprovalFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${approvalFilter === 'all' ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          All ({posts.length})
        </button>
        {(['pending_review', 'changes_requested', 'approved', 'scheduled', 'drafting'] as ApprovalStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setApprovalFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${approvalFilter === s ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            {APPROVAL_STYLES[s].label} ({byApproval[s]})
          </button>
        ))}
      </div>

      {loading && <div className="glass-card p-6 text-white/70 text-sm">Loading LinkedIn posts…</div>}

      {!loading && shown.length === 0 && (
        <div className="glass-card p-10 text-center space-y-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(0,119,181,0.15)', border: '1px solid rgba(0,119,181,0.3)' }}
          >
            <svg viewBox="0 0 24 24" fill="#0077b5" width="28" height="28">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div className="text-white font-semibold text-lg">No LinkedIn posts yet</div>
          <div className="text-white/50 text-sm max-w-sm mx-auto">
            Use <span className="font-bold text-white/70">AI Generate Plan</span> to create a full content calendar in seconds, or add posts manually.
          </div>
          {isStaff && (
            <button
              onClick={() => setShowGenerate(true)}
              className="mt-2 font-bold px-6 py-2.5 rounded-xl text-white text-sm inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              AI Generate Plan
            </button>
          )}
        </div>
      )}

      {/* Past months toggle */}
      {!loading && viewMode === 'calendar' && pastMonthCount > 0 && shown.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowPastMonths((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border bg-white/5 text-white/60 border-white/10 hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showPastMonths ? 'expand_less' : 'history'}</span>
            {showPastMonths ? 'Hide past months' : `Show ${pastMonthCount} past month${pastMonthCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* Calendar view */}
      {!loading && viewMode === 'calendar' && calendarMonths.map(([key, monthPosts]) => {
        const total = daysInMonth(key);
        const offset = firstWeekday(key);
        const byDay: Record<number, LinkedInPost[]> = {};
        for (const p of monthPosts) {
          const day = Number(p.post_date.slice(8, 10));
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(p);
        }
        return (
          <div key={key} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-bold text-white">{formatMonth(key)}</div>
              <div className="text-[11px] text-white/40">{monthPosts.length} posts</div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                <div key={w} className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-center pb-2">{w}</div>
              ))}
              {Array.from({ length: offset }).map((_, i) => <div key={`pad-${i}`} />)}
              {Array.from({ length: total }).map((_, i) => {
                const day = i + 1;
                const dayPosts = byDay[day] || [];
                const today = new Date();
                const isToday = key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` && day === today.getDate();
                return (
                  <div
                    key={day}
                    className={`min-h-[90px] rounded-xl border p-1.5 flex flex-col gap-1 ${isToday ? 'border-[#0077b5]/50 bg-[#0077b5]/10' : 'border-white/10 bg-white/5'}`}
                  >
                    <div className={`text-[10px] font-bold ${isToday ? 'text-[#00a0dc]' : 'text-white/40'}`}>{day}</div>
                    {dayPosts.map((p) => {
                      const parsed = parseTitle(p.title);
                      const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                      const astyle = APPROVAL_STYLES[status];
                      return (
                        <button
                          key={p.id}
                          onClick={() => setActiveId(p.id)}
                          className="text-left rounded-lg overflow-hidden border border-white/10 bg-white/6 hover:ring-2 hover:ring-[#0077b5]/40 transition"
                          style={{ background: 'rgba(0,119,181,0.08)' }}
                        >
                          <div className="px-1.5 py-1">
                            <div className="text-[9px] font-bold truncate text-white/80">{parsed.title || p.content_type || 'Post'}</div>
                            <span className={`${astyle.bg} ${astyle.text} px-1 py-0.5 rounded text-[7px] font-bold mt-0.5 inline-block`}>
                              {astyle.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Cards view */}
      {!loading && viewMode === 'cards' && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((p) => {
            const parsed = parseTitle(p.title);
            const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[status];
            return (
              <div key={p.id} className="glass-card p-5 flex flex-col gap-3 group" style={{ borderLeft: '2px solid rgba(0,119,181,0.4)' }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/60">{fmtDate(p.post_date)}</div>
                  {isStaff && (
                    <button onClick={() => deletePost(p.id)} className="text-white/30 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-md text-white/80" style={{ background: 'rgba(0,119,181,0.2)' }}>{p.content_type || 'Post'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>{style.label}</span>
                </div>
                <div className={`text-white font-bold text-base leading-tight ${style.strike ? 'line-through opacity-60' : ''}`}>{parsed.title || 'Untitled'}</div>
                {parsed.hook && (
                  <div className="text-white/70 text-sm italic">"{parsed.hook}"</div>
                )}
                {p.caption && (
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                      className="text-xs text-white/60 font-semibold flex items-center gap-1 mb-2"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{expanded[p.id] ? 'expand_less' : 'expand_more'}</span>
                      Caption
                    </button>
                    {expanded[p.id] && (
                      <div className="text-white/80 text-xs whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
                        {p.caption}
                      </div>
                    )}
                  </div>
                )}
                <div className="pt-2 border-t border-white/10 flex gap-2 justify-end">
                  {isStaff && !p.caption && (
                    <button
                      onClick={() => writeCopy(p.id)}
                      disabled={writingId === p.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
                    >
                      {writingId === p.id ? 'Writing…' : 'Write copy'}
                    </button>
                  )}
                  {isStaff && status !== 'scheduled' && status !== 'approved' && (
                    <button
                      onClick={() => patchPost(p.id, { client_approval_status: 'approved' })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                    >
                      Approve
                    </button>
                  )}
                  {isStaff && status === 'approved' && (
                    <button
                      onClick={() => patchPost(p.id, { client_approval_status: 'scheduled' })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-sky-500/20 text-sky-200"
                    >
                      Mark scheduled
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post detail modal */}
      {activePost && (() => {
        const parsed = parseTitle(activePost.title);
        const status = (activePost.client_approval_status || 'pending_review') as ApprovalStatus;
        const astyle = APPROVAL_STYLES[status];
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActiveId(null)}>
            <div
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl"
              style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(0,119,181,0.3)', backdropFilter: 'blur(24px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                    {fmtDate(activePost.post_date)} · LinkedIn · {activePost.content_type || 'Post'}
                  </div>
                  <div className="flex gap-1">
                    {isStaff && (
                      <button onClick={() => { deletePost(activePost.id); }} className="text-white/40 hover:text-rose-300 p-1">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                    <button onClick={() => setActiveId(null)} className="text-white/40 hover:text-white p-1">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>
                <div className="text-[22px] font-bold text-white leading-tight">{parsed.title}</div>
                <span className={`inline-block text-[11px] font-bold px-2 py-1 rounded ${astyle.bg} ${astyle.text}`}>{astyle.label}</span>
                {parsed.hook && (
                  <div className="text-[13px] text-amber-200/80 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                    <span className="text-[10px] font-bold uppercase text-amber-300/60 block mb-1">Hook</span>
                    {parsed.hook}
                  </div>
                )}
                {parsed.cta && (
                  <div className="text-[13px] text-sky-200/80 bg-sky-500/10 rounded-lg p-3 border border-sky-500/20">
                    <span className="text-[10px] font-bold uppercase text-sky-300/60 block mb-1">CTA</span>
                    {parsed.cta}
                  </div>
                )}
                {activePost.caption && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Caption</div>
                    <div className="text-[13px] text-white/75 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 max-h-72 overflow-y-auto">
                      {activePost.caption}
                    </div>
                  </div>
                )}
                {activePost.client_comments && (
                  <div className="text-[12px] bg-rose-500/15 border border-rose-500/30 rounded-lg p-3">
                    <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">Comments</div>
                    <div className="text-rose-300 whitespace-pre-wrap">{activePost.client_comments}</div>
                  </div>
                )}
                {isStaff && (
                  <div className="pt-4 border-t border-white/10 flex gap-2 flex-wrap">
                    {!activePost.caption && (
                      <button
                        onClick={() => writeCopy(activePost.id)}
                        disabled={writingId === activePost.id}
                        className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#0077b5,#00a0dc)' }}
                      >
                        {writingId === activePost.id ? 'Writing…' : 'Write copy'}
                      </button>
                    )}
                    {status !== 'approved' && status !== 'scheduled' && (
                      <button
                        onClick={() => patchPost(activePost.id, { client_approval_status: 'approved' })}
                        className="text-[12px] font-bold px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                      >
                        Approve
                      </button>
                    )}
                    {status === 'approved' && (
                      <button
                        onClick={() => patchPost(activePost.id, { client_approval_status: 'scheduled' })}
                        className="text-[12px] font-bold px-4 py-2 rounded-lg bg-sky-500/20 text-sky-200"
                      >
                        Mark scheduled
                      </button>
                    )}
                    {(status === 'approved' || status === 'scheduled') && (
                      <button
                        onClick={() => patchPost(activePost.id, { client_approval_status: 'pending_review' })}
                        className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-white/10 text-white/70"
                      >
                        ↩ Reset to pending
                      </button>
                    )}
                    <button
                      onClick={() => deletePost(activePost.id)}
                      className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
