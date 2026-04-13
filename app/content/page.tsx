'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';
import { driveThumbnailUrl, driveViewUrl } from '@/lib/drive';

/** Image with graceful fallback — hides itself if Drive thumbnail fails */
function DriveThumb({ url, className }: { url: string | null | undefined; className?: string }) {
  const thumb = driveThumbnailUrl(url, 600);
  const [failed, setFailed] = useState(false);
  if (!thumb || failed) return null;
  return <img src={thumb} alt="" className={className} onError={() => setFailed(true)} />;
}
import { getPlaybooksForClient } from '@/lib/agents/playbooks';

type ApprovalStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'scheduled';

type ContentItem = {
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

const PLATFORMS = ['Instagram', 'Facebook', 'Meta', 'TikTok', 'LinkedIn', 'YouTube', 'Pinterest', 'X/Twitter'];
const CONTENT_TYPES = ['Reel', 'Carousel', 'Post', 'Story', 'Live', 'Short', 'Video', 'Pin'];

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; bg: string; text: string; strike?: boolean }> = {
  drafting:           { label: 'Drafting',          bg: 'bg-white/5',          text: 'text-white/60 italic' },
  pending_review:     { label: 'Ready for review',  bg: 'bg-amber-400/15',     text: 'text-amber-200' },
  approved:           { label: 'Approved',          bg: 'bg-emerald-400/20',   text: 'text-emerald-200' },
  changes_requested:  { label: 'Changes requested', bg: 'bg-rose-400/20',      text: 'text-rose-200' },
  scheduled:          { label: 'Scheduled',         bg: 'bg-sky-400/20',       text: 'text-sky-200', strike: true },
};

function parseTitle(raw: string | null) {
  if (!raw) return { phase: '', title: '', hook: '', cta: '' };
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const phase = phaseMatch ? phaseMatch[1] : '';
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  const title = hookIdx >= 0 ? rest.slice(0, hookIdx) : rest;
  let hook = '';
  let cta = '';
  if (hookIdx >= 0) {
    const afterHook = rest.slice(hookIdx + ' — Hook:'.length);
    const ctaIdx = afterHook.indexOf('| CTA:');
    if (ctaIdx >= 0) {
      hook = afterHook.slice(0, ctaIdx).trim();
      cta = afterHook.slice(ctaIdx + '| CTA:'.length).trim();
    } else {
      hook = afterHook.trim();
    }
  }
  return { phase, title, hook, cta };
}

/** Normalize a date string (possibly ISO with time) to YYYY-MM-DD. */
function toDateOnly(s: string): string {
  if (!s) return s;
  // If already YYYY-MM-DD, return as-is
  if (s.length === 10) return s;
  // For ISO strings like "2026-04-15T00:00:00.000Z", extract the date part
  // but use UTC values to avoid timezone shift
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

export default function ContentPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const [items, _setItems] = useState<ContentItem[]>([]);
  // Normalize post_date to YYYY-MM-DD on every update to avoid timezone issues
  function setItems(updater: ContentItem[] | ((prev: ContentItem[]) => ContentItem[])) {
    _setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((it) => ({ ...it, post_date: toDateOnly(it.post_date) }));
    });
  }
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [writingId, setWritingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('all');
  const [photoDraft, setPhotoDraft] = useState<Record<string, string>>({});
  const [editingPhoto, setEditingPhoto] = useState<Record<string, boolean>>({});
  const [isStaff, setIsStaff] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ post_date: string; platform: string; content_type: string; title: string }>({ post_date: '', platform: '', content_type: '', title: '' });
  const [editingCaption, setEditingCaption] = useState<Record<string, boolean>>({});
  const [captionDraft, setCaptionDraft] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, boolean>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [showRedoInput, setShowRedoInput] = useState<Record<string, boolean>>({});
  const [redoGuidance, setRedoGuidance] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortAsc, setSortAsc] = useState(true); // sort by date ascending by default
  const [newPostPlatforms, setNewPostPlatforms] = useState<string[]>(['Instagram']);
  const [editPlatforms, setEditPlatforms] = useState<string[]>([]);
  const [newPost, setNewPost] = useState({ post_date: '', platform: 'Instagram', content_type: 'Post', title: '', caption: '' });

  // Detect user role
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setIsStaff(MNA_EMAILS.includes(email));
    });
  }, []);

  async function savePhoto(id: string) {
    const url = photoDraft[id]?.trim() || '';
    try {
      await patchItem(id, { photo_drive_url: url || null });
      setEditingPhoto((e) => ({ ...e, [id]: false }));
    } catch (e: any) { alert(e.message); }
  }

  async function patchItem(id: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/content-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data.item } : it)));
  }

  async function approve(id: string) {
    try { await patchItem(id, { client_approval_status: 'approved' }); }
    catch (e: any) { alert(e.message); }
  }
  async function requestChanges(id: string) {
    const comment = commentDraft[id]?.trim();
    if (!comment) { alert('Add a comment before requesting changes.'); return; }
    try {
      await patchItem(id, { client_approval_status: 'changes_requested', client_comments: comment });
      setCommentDraft((d) => ({ ...d, [id]: '' }));
    } catch (e: any) { alert(e.message); }
  }
  async function markScheduled(id: string) {
    try { await patchItem(id, { client_approval_status: 'scheduled' }); }
    catch (e: any) { alert(e.message); }
  }

  async function writeCopy(id: string, guidance?: string) {
    setWritingId(id);
    try {
      const res = await fetch(`/api/content-calendar/${id}/write-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidance: guidance || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
      setExpanded((e) => ({ ...e, [id]: true }));
      setRedoGuidance((g) => ({ ...g, [id]: '' }));
      setShowRedoInput((s) => ({ ...s, [id]: false }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWritingId(null);
    }
  }

  async function writeAll() {
    for (const it of items) {
      if (it.caption) continue;
      await writeCopy(it.id);
    }
  }

  // Start editing a content item (staff only)
  function startEdit(item: ContentItem) {
    const parsed = parseTitle(item.title);
    setEditingId(item.id);
    setEditPlatforms([item.platform]);
    setEditDraft({
      post_date: item.post_date,
      platform: item.platform,
      content_type: item.content_type || '',
      title: parsed.title || '',
    });
  }

  async function saveEdit(id: string) {
    try {
      await patchItem(id, {
        post_date: editDraft.post_date,
        platform: editPlatforms.length > 0 ? editPlatforms[0] : editDraft.platform,
        content_type: editDraft.content_type || null,
        title: editDraft.title || null,
      });
      setEditingId(null);
    } catch (e: any) { alert(e.message); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this content item?')) return;
    await fetch(`/api/content-calendar?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function addPost() {
    if (!newPost.post_date || newPostPlatforms.length === 0 || !newPost.title) { alert('Date, at least one platform, and title are required'); return; }
    // Create one row per selected platform so each shows independently in the calendar
    const postItems = newPostPlatforms.map((p) => ({
      post_date: newPost.post_date,
      platform: p,
      content_type: newPost.content_type || null,
      title: newPost.title,
      caption: newPost.caption || null,
      status: 'Draft',
      assigned_role: 'Social Media Manager',
    }));
    const res = await fetch('/api/content-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: activeClient.name, items: postItems }),
    });
    if (!res.ok) { alert('Failed to add post'); return; }
    setNewPost({ post_date: '', platform: 'Instagram', content_type: 'Post', title: '', caption: '' });
    setNewPostPlatforms(['Instagram']);
    setShowAddForm(false);
    // Refresh
    const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
    const listData = await listRes.json();
    setItems(listData.items || []);
  }

  useEffect(() => {
    if (!activeClient?.name) return;
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, [activeClient?.name]);

  const platforms = Array.from(new Set(items.map((i) => i.platform)));
  const byApproval: Record<ApprovalStatus, number> = {
    drafting: 0, pending_review: 0, approved: 0, changes_requested: 0, scheduled: 0,
  };
  items.forEach((i) => {
    const s = (i.client_approval_status || 'pending_review') as ApprovalStatus;
    if (byApproval[s] !== undefined) byApproval[s]++;
  });
  const platformFiltered = filter === 'all' ? items : items.filter((i) => i.platform === filter);
  const filtered = approvalFilter === 'all'
    ? platformFiltered
    : platformFiltered.filter((i) => (i.client_approval_status || 'pending_review') === approvalFilter);
  const shown = [...filtered].sort((a, b) => {
    const cmp = a.post_date.localeCompare(b.post_date);
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>grid_view</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Content Tracker</h1>
          </div>
          <p className="text-white/60 mt-1">
            {activeClient?.name || 'No client selected'} · {items.length} posts
            {!isStaff && <span className="ml-2 text-white/40 text-xs">(View only — approve or request changes below)</span>}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            {showAddForm ? 'Cancel' : '+ Add Post'}
          </button>
        )}
      </div>

      {/* Add post form (staff only) */}
      {isStaff && showAddForm && (
        <div className="glass-card p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
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
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Multi-platform select */}
          <div className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Platforms (select multiple)</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const selected = newPostPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPostPlatforms((prev) =>
                      selected ? prev.filter((x) => x !== p) : [...prev, p]
                    )}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-white/15 text-white border-white/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {selected && <span className="mr-1">✓</span>}{p}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            type="text"
            placeholder="Post title..."
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-2"
          />
          <textarea
            placeholder="Caption (optional, leave blank to generate with AI later)..."
            value={newPost.caption}
            onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
            rows={3}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-3"
          />
          <button
            onClick={addPost}
            className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            Add Post
          </button>
        </div>
      )}

      {isStaff && activeClient && items.length === 0 && !loading && (() => {
        const playbooks = getPlaybooksForClient(activeClient.id);
        if (playbooks.length === 0) return null;
        return playbooks.map((pb) => (
          <div key={pb.id} className="glass-card p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-white font-semibold text-sm">{pb.name}</div>
              <div className="text-white/60 text-xs">{pb.description}</div>
            </div>
            <button
              onClick={async () => {
                const res = await fetch('/api/content-calendar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientName: activeClient.name,
                    playbookId: pb.id,
                    startDate: new Date().toISOString().slice(0, 10),
                  }),
                });
                const data = await res.json();
                if (!res.ok) { alert(data.error || 'Seed failed'); return; }
                const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
                const listData = await listRes.json();
                setItems(listData.items || []);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#1c3d6e,#3a7ab5)' }}
            >
              Load Playbook
            </button>
          </div>
        ));
      })()}

      {isStaff && items.length > 0 && items.some((i) => !i.caption) && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm">Bulk generate captions</div>
            <div className="text-white/60 text-xs">Uses the Social Media Manager agent to write 2 caption options for every post missing copy.</div>
          </div>
          <button
            onClick={writeAll}
            disabled={!!writingId}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
          >
            {writingId ? 'Writing...' : 'Write all captions'}
          </button>
        </div>
      )}

      {/* Push to client controls */}
      {isStaff && items.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              Push to Client Portal
            </div>
            <div className="text-white/60 text-xs">
              {items.filter((i) => i.client_visible).length} of {items.length} posts visible to client.
              {items.some((i) => !i.client_visible) && ' Hidden posts won\u2019t appear on the client\u2019s calendar.'}
            </div>
          </div>
          <div className="flex gap-2">
            {items.some((i) => !i.client_visible) && (
              <button
                onClick={async () => {
                  const hidden = items.filter((i) => !i.client_visible);
                  for (const it of hidden) {
                    await patchItem(it.id, { client_visible: true });
                  }
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#059669,#34d399)' }}
              >
                Push all to client
              </button>
            )}
            {items.every((i) => i.client_visible) && (
              <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                All posts are live
              </span>
            )}
          </div>
        </div>
      )}

      {/* Platform filters + sort toggle */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${filter === 'all' ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          All ({items.length})
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${filter === p ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            {p} ({items.filter((i) => i.platform === p).length})
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white/5 text-white/60 border-white/10 hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sort</span>
            Date {sortAsc ? '↑ Oldest first' : '↓ Newest first'}
          </button>
        </div>
      </div>

      {/* Approval status filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mr-2">Approval</span>
        <button
          onClick={() => setApprovalFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${approvalFilter === 'all' ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          All
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

      {loading && <div className="glass-card p-6 text-white/70">Loading...</div>}

      {!loading && shown.length === 0 && (
        <div className="glass-card p-8 text-center text-white/60">
          {isStaff
            ? 'No content yet. Click "+ Add Post" to create one, or load a playbook.'
            : 'No content to review yet. Your agency will share posts here for your approval.'}
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((it) => {
            const parsed = parseTitle(it.title);
            const approval = (it.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[approval];
            const isEditing = editingId === it.id;

            return (
              <div key={it.id} className="glass-card p-5 flex flex-col gap-3 group">
                {/* Edit mode (staff only) */}
                {isStaff && isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="date"
                      value={editDraft.post_date}
                      onChange={(e) => setEditDraft({ ...editDraft, post_date: e.target.value })}
                      className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
                    />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Platform</div>
                      <div className="flex flex-wrap gap-1.5">
                        {PLATFORMS.map((p) => {
                          const sel = editPlatforms.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setEditPlatforms((prev) =>
                                sel ? prev.filter((x) => x !== p) : [...prev, p]
                              )}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                sel ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/40 border-white/10'
                              }`}
                            >
                              {sel && '✓ '}{p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <select
                      value={editDraft.content_type}
                      onChange={(e) => setEditDraft({ ...editDraft, content_type: e.target.value })}
                      className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
                    >
                      <option value="">No type</option>
                      {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      placeholder="Title..."
                      className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(it.id)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/80 text-white">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-white/60">{fmtDate(it.post_date)}</div>
                      <div className="flex items-center gap-2">
                        {parsed.phase && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 uppercase tracking-wider">{parsed.phase}</span>
                        )}
                        {isStaff && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(it)} className="text-white/40 hover:text-white transition-colors" title="Edit">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                            <button onClick={() => deleteItem(it.id)} className="text-white/40 hover:text-red-400 transition-colors" title="Delete">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.platform}</span>
                      {it.content_type && <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.content_type}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>{style.label}</span>
                      {isStaff && (
                        it.client_visible ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>visibility</span>
                            Live to client
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/40 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>visibility_off</span>
                            Hidden from client
                          </span>
                        )
                      )}
                    </div>
                    <div className={`text-white font-bold text-base leading-tight ${style.strike ? 'line-through opacity-60' : ''}`}>{parsed.title || 'Untitled'}</div>
                  </>
                )}

                {/* Photo / Drive link (staff can edit, client can view) */}
                {(() => {
                  const view = driveViewUrl(it.photo_drive_url);
                  const isEditingP = editingPhoto[it.id];
                  return (
                    <div className="space-y-2">
                      {it.photo_drive_url && !isEditingP && (
                        <a href={view!} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-white/10">
                          <DriveThumb url={it.photo_drive_url} className="w-full h-32 object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      {isStaff && isEditingP ? (
                        <div className="flex gap-2">
                          <input
                            value={photoDraft[it.id] ?? it.photo_drive_url ?? ''}
                            onChange={(e) => setPhotoDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                            placeholder="Paste Google Drive share link"
                            className="flex-1 text-[11px] rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30"
                          />
                          <button onClick={() => savePhoto(it.id)} className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-emerald-500/80 text-white">Save</button>
                          <button onClick={() => setEditingPhoto((e) => ({ ...e, [it.id]: false }))} className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-white/10 text-white/80">Cancel</button>
                        </div>
                      ) : isStaff ? (
                        <button
                          onClick={() => {
                            setPhotoDraft((d) => ({ ...d, [it.id]: it.photo_drive_url || '' }));
                            setEditingPhoto((e) => ({ ...e, [it.id]: true }));
                          }}
                          className="text-[10px] font-semibold text-white/60 hover:text-white inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{view ? 'edit' : 'add_photo_alternate'}</span>
                          {view ? 'Edit Drive link' : 'Add Drive link'}
                        </button>
                      ) : null}
                    </div>
                  );
                })()}

                {parsed.hook && !isEditing && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-0.5">Hook</div>
                    <div className="text-white/85 text-sm leading-snug">"{parsed.hook}"</div>
                  </div>
                )}
                {parsed.cta && !isEditing && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-0.5">CTA</div>
                    <div className="text-white/85 text-sm">{parsed.cta}</div>
                  </div>
                )}
                {it.caption && (
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))}
                      className="text-xs text-white/70 font-semibold mb-2 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {expanded[it.id] ? 'expand_less' : 'expand_more'}
                      </span>
                      Caption copy
                      {isStaff && expanded[it.id] && !editingCaption[it.id] && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setCaptionDraft((d) => ({ ...d, [it.id]: it.caption || '' }));
                            setEditingCaption((ec) => ({ ...ec, [it.id]: true }));
                          }}
                          className="material-symbols-outlined ml-1 text-white/40 hover:text-white cursor-pointer"
                          style={{ fontSize: 13 }}
                        >edit</span>
                      )}
                    </button>
                    {expanded[it.id] && (
                      isStaff && editingCaption[it.id] ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={captionDraft[it.id] ?? it.caption ?? ''}
                            onChange={(e) => setCaptionDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                            rows={8}
                            className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-3 text-white placeholder:text-white/30 outline-none leading-relaxed"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await patchItem(it.id, { caption: captionDraft[it.id] });
                                  setEditingCaption((ec) => ({ ...ec, [it.id]: false }));
                                } catch (e: any) { alert(e.message); }
                              }}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/80 text-white"
                            >Save Caption</button>
                            <button
                              onClick={() => setEditingCaption((ec) => ({ ...ec, [it.id]: false }))}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80"
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-white/85 text-xs whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
                          {it.caption}
                        </div>
                      )
                    )}
                  </div>
                )}
                {it.client_comments && (
                  <div className="text-xs bg-rose-400/10 border border-rose-400/30 rounded-lg p-2">
                    <div className="text-[10px] uppercase tracking-wider text-rose-200/80 font-semibold mb-1">Client comments</div>
                    <div className="text-rose-100 whitespace-pre-wrap">{it.client_comments}</div>
                  </div>
                )}
                {it.mna_comments && (
                  <div className="text-xs bg-white/5 border border-white/10 rounded-lg p-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold mb-1">MNA note</div>
                    <div className="text-white/80 whitespace-pre-wrap">{it.mna_comments}</div>
                  </div>
                )}

                {/* Approval controls — always visible for both staff and client */}
                {approval !== 'scheduled' && it.caption && (
                  <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                      {isStaff ? 'Client approval' : 'Your approval'}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => approve(it.id)}
                        disabled={approval === 'approved'}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/80 text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => requestChanges(it.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-500/70 text-white"
                      >
                        Request changes
                      </button>
                      {isStaff && approval === 'approved' && (
                        <button
                          onClick={() => markScheduled(it.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-sky-500/70 text-white"
                        >
                          Mark scheduled
                        </button>
                      )}
                      {isStaff && (approval === 'approved' || approval === 'changes_requested' || approval === 'scheduled') && (
                        <button
                          onClick={() => patchItem(it.id, { client_approval_status: 'pending_review' })}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/15"
                        >
                          ↩ Reset to pending
                        </button>
                      )}
                      {isStaff && approval !== 'drafting' && (
                        <button
                          onClick={() => patchItem(it.id, { client_approval_status: 'drafting' })}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/5 text-white/40 hover:text-white/70"
                        >
                          Back to drafting
                        </button>
                      )}
                    </div>
                    <textarea
                      value={commentDraft[it.id] || ''}
                      onChange={(e) => setCommentDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                      placeholder="Comment (required if requesting changes)"
                      rows={2}
                      className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30"
                    />
                  </div>
                )}

                {/* Staff notes */}
                {isStaff && (
                  <div className="pt-2 border-t border-white/10">
                    {editingNotes[it.id] ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={notesDraft[it.id] ?? it.mna_comments ?? ''}
                          onChange={(e) => setNotesDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                          rows={3}
                          placeholder="Internal notes (not visible to client)"
                          className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30 outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await patchItem(it.id, { mna_comments: notesDraft[it.id] || null });
                                setEditingNotes((e) => ({ ...e, [it.id]: false }));
                              } catch (e: any) { alert(e.message); }
                            }}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/80 text-white"
                          >Save Note</button>
                          <button
                            onClick={() => setEditingNotes((e) => ({ ...e, [it.id]: false }))}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setNotesDraft((d) => ({ ...d, [it.id]: it.mna_comments || '' }));
                          setEditingNotes((e) => ({ ...e, [it.id]: true }));
                        }}
                        className="text-[10px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>note_add</span>
                        {it.mna_comments ? 'Edit note' : 'Add note'}
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-white/50">{it.assigned_role || ''}</span>
                  <div className="flex gap-2">
                    {isStaff && (
                      <button
                        onClick={async () => {
                          try { await patchItem(it.id, { client_visible: !it.client_visible }); }
                          catch (e: any) { alert(e.message); }
                        }}
                        className={`rounded-lg px-3 py-1.5 font-semibold flex items-center gap-1 transition-colors ${
                          it.client_visible
                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            : 'bg-white/5 text-white/60 border border-white/15 hover:bg-white/10'
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {it.client_visible ? 'visibility' : 'visibility_off'}
                        </span>
                        {it.client_visible ? 'Live' : 'Push to client'}
                      </button>
                    )}
                    {isStaff && it.caption && !showRedoInput[it.id] && (
                      <button
                        onClick={() => setShowRedoInput((s) => ({ ...s, [it.id]: true }))}
                        disabled={writingId === it.id}
                        className="rounded-lg px-3 py-1.5 font-semibold text-white/70 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
                      >
                        {writingId === it.id ? 'Rewriting...' : 'Redo copy'}
                      </button>
                    )}
                    {isStaff && !it.caption && (
                      <button
                        onClick={() => writeCopy(it.id)}
                        disabled={writingId === it.id}
                        className="rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                      >
                        {writingId === it.id ? 'Writing...' : 'Write copy'}
                      </button>
                    )}
                  </div>
                </div>
                {isStaff && showRedoInput[it.id] && (
                  <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">What should change?</div>
                    <textarea
                      value={redoGuidance[it.id] || ''}
                      onChange={(e) => setRedoGuidance((g) => ({ ...g, [it.id]: e.target.value }))}
                      placeholder="e.g. make it more casual, shorter, focus on the promo, less salesy..."
                      rows={2}
                      className="w-full text-xs rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => writeCopy(it.id, redoGuidance[it.id])}
                        disabled={writingId === it.id}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                      >
                        {writingId === it.id ? 'Rewriting...' : 'Regenerate'}
                      </button>
                      <button
                        onClick={() => { setShowRedoInput((s) => ({ ...s, [it.id]: false })); setRedoGuidance((g) => ({ ...g, [it.id]: '' })); }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
