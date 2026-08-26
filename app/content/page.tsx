'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';
import { driveThumbnailUrl, driveViewUrl } from '@/lib/drive';
import { extractFolderId, type DriveFile } from '@/lib/google-drive-shared';
import { KNOWN_MERGE_FIELDS } from '@/lib/merge-vars';

// Resolve a preview src for a stored photo URL. Google Drive links go through
// the thumbnail endpoint; uploaded images (Supabase public URLs, or any plain
// http(s) image) render directly.
function previewSrc(url: string | null | undefined): string | null {
  const drive = driveThumbnailUrl(url, 600);
  if (drive) return drive;
  const t = (url || '').trim();
  return /^https?:\/\//i.test(t) ? t : null;
}
// Link to open the full photo — Drive view page for Drive links, else the raw URL.
function photoOpenUrl(url: string | null | undefined): string | null {
  return driveViewUrl(url) || (url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);
}

// All photos on a post — the multi-photo list when present, else the legacy
// single-photo column. First entry is the cover.
function photosOf(i: { photo_urls?: string[] | null; photo_drive_url: string | null }): string[] {
  if (Array.isArray(i.photo_urls) && i.photo_urls.length > 0) return i.photo_urls.filter(Boolean);
  return i.photo_drive_url ? [i.photo_drive_url] : [];
}

/** Image with graceful fallback — hides itself if the source fails to load */
function DriveThumb({ url, className }: { url: string | null | undefined; className?: string }) {
  const src = previewSrc(url);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  if (/\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(src) || /-video\./i.test(src)) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={src} className={className} controls playsInline muted preload="metadata" onError={() => setFailed(true)} />;
  }
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

// True when an OS file (not an internal reschedule drag) is being dragged.
function dragHasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

/**
 * Staff-only image drop zone. Wraps a post's photo area so image/video files
 * can be dragged from the desktop and dropped to attach them (several at
 * once), or clicked to browse. Non-staff just see the children (view only).
 */
function PhotoDropZone({
  isStaff, uploading, hasImage, onFiles, className, children,
}: {
  isStaff: boolean;
  uploading: boolean;
  hasImage: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  if (!isStaff) return <>{children}</>;
  return (
    <div
      className={`relative ${className || ''}`}
      onDragOver={(e) => { if (dragHasFiles(e)) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const fs = Array.from(e.dataTransfer.files || []);
        if (fs.length) onFiles(fs);
      }}
    >
      {children}
      {!hasImage && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 hover:border-white/40 text-white/45 hover:text-white/70 transition-colors py-4 text-[11px] font-semibold"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_photo_alternate</span>
          {uploading ? 'Uploading…' : 'Drag images or videos here, or click to upload'}
        </button>
      )}
      {hasImage && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute top-1 right-1 z-10 text-[10px] font-semibold px-2 py-1 rounded-md bg-black/55 text-white/90 hover:bg-black/75 inline-flex items-center gap-1"
          title="Add more photos or videos"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add_photo_alternate</span>
          Add
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) onFiles(fs); e.target.value = ''; }}
      />
      {(over || uploading) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg pointer-events-none"
             style={{ background: 'rgba(12,109,164,0.35)', border: '2px dashed rgba(74,184,206,0.9)' }}>
          <span className="text-[12px] font-bold text-white bg-black/50 px-3 py-1.5 rounded-lg">
            {uploading ? 'Uploading…' : 'Drop to attach'}
          </span>
        </div>
      )}
    </div>
  );
}
import { getPlaybooksForClient } from '@/lib/agents/playbooks';
import { clients as ALL_CLIENTS } from '@/lib/clients';

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
  photo_urls?: string[] | null;
  client_visible: boolean;
  auto_post?: boolean;
  publish_status?: string | null;
  published_at?: string | null;
  publish_error?: string | null;
  scheduled_for?: string | null;
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

// PDM = brand-cascade reference posts. They don't need MNA review and
// should visually stand out so the team knows they're NOT their own work.
function isPdmItem(i: ContentItem): boolean {
  if (i.assigned_role === 'PDM (Brand)') return true;
  return /^\[\s*PDM\b/i.test(i.title || '');
}
const PDM_STYLE = {
  label: 'PDM · Brand',
  chipBg: '#0b2547',
  chipBorder: '#1e3a8a',
  chipText: 'text-blue-100',
  accent: '#60a5fa',
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

export default function ContentPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;

  /**
   * Send the user through Google's consent screen and back. Drive access is
   * per-user, so a teammate who has never connected (or connected before the
   * Drive scope was added) has to do this themselves — there's nothing an
   * admin can grant on their behalf.
   */
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  async function connectGoogle() {
    const email = ctx?.userEmail;
    if (!email) { alert('Sign in again, then retry connecting Google.'); return; }
    setConnectingGoogle(true);
    try {
      const d = await fetch(`/api/google/connect?email=${encodeURIComponent(email)}`).then((r) => r.json());
      if (d?.url) window.location.href = d.url;
      else { alert(d?.error || 'Could not start the Google connection.'); setConnectingGoogle(false); }
    } catch {
      alert('Could not reach Google. Try again in a moment.');
      setConnectingGoogle(false);
    }
  }
  // Other Prime IV locations this client can cross-post to (built-in + custom,
  // via context), filtered against the active client so we never offer self.
  const primeIvClients = (((ctx?.allClients as any[]) || ALL_CLIENTS) as typeof ALL_CLIENTS)
    .filter((c) => c.id === 'prime-iv' || c.id.startsWith('prime-iv-'));
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<{ id: string; platform: string; username: string | null; pageId?: string | null; photo?: string | null }[]>([]);
  const [socialSelected, setSocialSelected] = useState<Set<string>>(new Set());
  const [socialConfigured, setSocialConfigured] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [mergeVars, setMergeVars] = useState<Record<string, string>>({});
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSaved, setMergeSaved] = useState(false);
  const [pdmAutopost, setPdmAutopost] = useState(false);
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
  // Quick-add popup opened by clicking an empty calendar day
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // newest first by default
  // Calendar view: hide past months by default (content is approved ~2 weeks
  // out on a 45-day window, so the current + upcoming months are what matters).
  const [showPastMonths, setShowPastMonths] = useState(false);
  const [newPostPlatforms, setNewPostPlatforms] = useState<string[]>(['Instagram']);
  const [editPlatforms, setEditPlatforms] = useState<string[]>([]);
  // Which platforms the open post goes to. Kept in sync with activeItem's
  // sibling rows so the detail panel can add/remove platforms in place.
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
  const [syncingPlatforms, setSyncingPlatforms] = useState(false);
  // The account list stays folded once accounts are ticked, so a stray click
  // can't silently retarget a client's auto-posting. Opens itself when nothing
  // is ticked yet (i.e. this location still needs setting up).
  const [showAccounts, setShowAccounts] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('calendar');
  const [activeId, setActiveId] = useState<string | null>(null);
  // When crossing over from the calendar to cards view, scroll to this card
  // instead of jumping to the top of the list.
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  // Drag-to-reschedule on the calendar view
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  // Inline date editing on cards / in the modal
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  // Google Drive picker — opens for a specific post ID to attach a file.
  // The folder URL is set per-client and persisted to localStorage so staff
  // only has to paste it once per browser.
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>('');
  const [editingFolder, setEditingFolder] = useState(false);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [pickerFiles, setPickerFiles] = useState<DriveFile[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  // Subfolder navigation inside the picker — breadcrumb trail from the root.
  const [pickerPath, setPickerPath] = useState<{ id: string; name: string }[]>([]);
  const [newPost, setNewPost] = useState({ post_date: '', platform: 'Instagram', content_type: 'Post', title: '', caption: '' });
  // Monthly Specials Planner — enter the month's specials, AI drafts the plan
  const [showPlanner, setShowPlanner] = useState(false);
  const [planMonth, setPlanMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [planSpecials, setPlanSpecials] = useState('');
  const [planPerWeek, setPlanPerWeek] = useState(3);
  const [planDays, setPlanDays] = useState<Set<string>>(new Set());
  const [planResearch, setPlanResearch] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planPreview, setPlanPreview] = useState<any[] | null>(null);
  const [planChecked, setPlanChecked] = useState<Set<number>>(new Set());
  const [planAdding, setPlanAdding] = useState(false);
  // Cross-post: push one post (or a whole filtered batch) to other Prime IV locations
  const [crossPostId, setCrossPostId] = useState<string | null>(null);
  const [crossPostTargets, setCrossPostTargets] = useState<string[]>([]);
  const [crossPosting, setCrossPosting] = useState(false);
  const [showBulkCrossPost, setShowBulkCrossPost] = useState(false);
  const [bulkCrossTargets, setBulkCrossTargets] = useState<string[]>([]);
  const [bulkCrossPosting, setBulkCrossPosting] = useState<{ done: number; total: number } | null>(null);

  // Detect user role
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const email = user?.email || '';
      setIsStaff(MNA_EMAILS.includes(email));
    });
  }, []);

  // Replace a post's full photo list; the first entry becomes the cover.
  async function savePhotos(id: string, urls: string[]) {
    await patchItem(id, { photo_urls: urls, photo_drive_url: urls[0] || null });
  }

  // "Paste link" — appends the pasted URL to the post's photo list.
  async function savePhoto(id: string) {
    const url = photoDraft[id]?.trim() || '';
    try {
      if (url) {
        const item = items.find((i) => i.id === id);
        await savePhotos(id, [...(item ? photosOf(item) : []), url]);
      }
      setPhotoDraft((d) => ({ ...d, [id]: '' }));
      setEditingPhoto((e) => ({ ...e, [id]: false }));
    } catch (e: any) { alert(e.message); }
  }

  async function removePhotoAt(id: string, index: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try { await savePhotos(id, photosOf(item).filter((_, i) => i !== index)); }
    catch (e: any) { alert(e.message); }
  }

  // Upload dropped/selected images OR videos and attach them all to the post.
  // Uploads straight to Supabase Storage via signed URLs so large video files
  // aren't blocked by the serverless request-body limit.
  async function uploadImages(postId: string, files: File[]) {
    const valid = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (valid.length === 0) { alert('Please choose image or video files.'); return; }
    setUploadingId(postId);
    try {
      const uploaded: string[] = [];
      for (const file of valid) {
        // 1. Get a signed upload URL + the eventual public URL.
        const r = await fetch('/api/content-calendar/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not start upload');
        // 2. Send the file straight to Supabase Storage.
        const up = await fetch(d.signedUrl, { method: 'PUT', headers: { 'content-type': file.type, 'x-upsert': 'true' }, body: file });
        if (!up.ok) throw new Error('Upload to storage failed');
        uploaded.push(d.publicUrl);
      }
      // 3. Append the new URLs to the post's photo list.
      const item = items.find((i) => i.id === postId);
      await savePhotos(postId, [...(item ? photosOf(item) : []), ...uploaded]);
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  }

  // Click a calendar day → quick "new post" popup prefilled with that date,
  // right where you are (no scrolling away from the calendar).
  function openNewPostForDate(iso: string) {
    if (!isStaff) return;
    setNewPost((p) => ({ ...p, post_date: iso }));
    setNewPostPlatforms((prev) => (prev.length ? prev : ['Instagram']));
    setShowAddModal(true);
  }

  // Crossing over from the calendar modal to cards view scrolls to the chosen
  // card rather than the top of the list.
  useEffect(() => {
    if (viewMode !== 'cards' || !focusCardId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`card-${focusCardId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.3s';
        el.style.boxShadow = '0 0 0 2px rgba(74,184,206,0.8)';
        setTimeout(() => { el.style.boxShadow = ''; }, 1600);
      }
      setFocusCardId(null);
    }, 80);
    return () => clearTimeout(t);
  }, [viewMode, focusCardId]);

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

  // A post that runs on several platforms is stored as one row per platform
  // (same date + title), which is what the calendar, the platform filter, the
  // duplicate cleanup and per-platform publish status all already assume.
  // So the platform multi-select adds and removes sibling rows rather than
  // writing a list into one field.
  //
  // `next` carries any edits made in the same save (date/title/type), so the
  // siblings follow the anchor instead of drifting out of the group.
  // Anything already published is never auto-deleted.
  async function syncPlatforms(
    anchor: ContentItem,
    desired: string[],
    next: { post_date: string; title: string | null; content_type: string | null },
  ) {
    const want = Array.from(new Set(desired.filter(Boolean)));
    if (want.length === 0) throw new Error('Pick at least one platform.');

    // Matched on the anchor's *current* date/title/type, before this save's edits.
    const siblings = siblingsOf(anchor);
    const bySibPlatform = new Map<string, ContentItem>();
    for (const s of siblings) if (!bySibPlatform.has(s.platform)) bySibPlatform.set(s.platform, s);

    const drop = siblings.filter((s) => !want.includes(s.platform));
    const posted = drop.filter((s) => s.publish_status === 'posted');
    if (posted.length > 0) {
      throw new Error(
        `Can't untick ${posted.map((s) => s.platform).join(', ')} — already published. Delete those posts directly if you really mean to.`,
      );
    }
    if (
      drop.length > 0 &&
      !confirm(
        `Remove this post from ${drop.map((s) => s.platform).join(', ')}? The ${want.join(', ')} cop${want.length === 1 ? 'y' : 'ies'} stay.`,
      )
    ) return;

    // 1. The anchor row keeps the first platform and takes any edits.
    await patchItem(anchor.id, { ...next, platform: want[0] });

    // 2. Sibling rows for platforms that are still ticked follow the edit.
    for (const p of want.slice(1)) {
      const existing = bySibPlatform.get(p);
      if (existing) await patchItem(existing.id, { ...next, platform: p });
    }

    // 3. Newly ticked platforms get their own row, copied from the anchor.
    const fresh = want.slice(1).filter((p) => !bySibPlatform.has(p));
    if (fresh.length > 0) {
      if (!activeClient?.name) throw new Error('No active client.');
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: activeClient.name,
          items: fresh.map((p) => ({
            post_date: next.post_date,
            platform: p,
            content_type: next.content_type,
            title: next.title,
            caption: anchor.caption,
            status: anchor.status || 'Draft',
            assigned_role: anchor.assigned_role || 'Social Media Manager',
          })),
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || 'Failed to add the extra platform rows');
      // The insert doesn't take photos, so carry the anchor's media across —
      // it's the same post, it should go out with the same image.
      if (anchor.photo_drive_url || (anchor.photo_urls && anchor.photo_urls.length > 0)) {
        for (const row of created.inserted || []) {
          await patchItem(row.id, {
            photo_drive_url: anchor.photo_drive_url,
            photo_urls: anchor.photo_urls ?? null,
          }).catch(() => {});
        }
      }
    }

    // 4. Unticked rows go away.
    for (const s of drop) {
      await fetch(`/api/content-calendar?id=${s.id}`, { method: 'DELETE' });
    }
    if (drop.length > 0) {
      const gone = new Set(drop.map((s) => s.id));
      setItems((prev) => prev.filter((it) => !gone.has(it.id)));
      if (activeId && gone.has(activeId)) setActiveId(anchor.id);
    }

    if (fresh.length > 0) await reloadItems();
  }

  // Sibling rows = the same post on another platform. Matched on date + title
  // + type, which is exactly the tuple addPost writes when it fans one post out
  // across platforms.
  //
  // Deliberately strict: a false match here would delete an unrelated post,
  // whereas a missed match only means a newly ticked platform gets its own row
  // instead of joining the group — visible and harmless. An untitled row never
  // groups at all, so two blank drafts on one date can't swallow each other.
  function siblingsOf(item: ContentItem): ContentItem[] {
    if (!(item.title || '').trim()) return [];
    return items.filter(
      (it) =>
        it.id !== item.id &&
        it.post_date === item.post_date &&
        (it.title || '') === (item.title || '') &&
        (it.content_type || '') === (item.content_type || ''),
    );
  }

  // Every platform a post currently runs on. Anchor's own platform comes first
  // so it stays the primary row.
  function platformsForPost(item: ContentItem): string[] {
    return Array.from(new Set([item.platform, ...siblingsOf(item).map((it) => it.platform)]));
  }

  async function reloadItems() {
    if (!activeClient?.name) return;
    const res = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
    const data = await res.json();
    setItems(data.items || []);
  }

  // ── Social auto-posting (Post for Me) ────────────────────────────
  function loadSocialAccounts() {
    if (!activeClient?.id) return;
    // Cache-bust + no-store so a freshly connected account always shows up.
    fetch(`/api/social/accounts?clientId=${encodeURIComponent(activeClient.id)}&_=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setSocialAccounts(Array.isArray(d.accounts) ? d.accounts : []);
        setSocialConfigured(!!d.configured);
        const sel = new Set<string>((Array.isArray(d.selected) ? d.selected : []).map((a: any) => String(a.id)));
        setSocialSelected(sel);
        // Already set up → stay folded. Nothing ticked → open so it's obvious
        // this location still needs accounts chosen.
        setShowAccounts(sel.size === 0);
      })
      .catch(() => { setSocialAccounts([]); setSocialConfigured(false); setSocialSelected(new Set()); });
  }
  useEffect(() => { loadSocialAccounts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeClient?.id]);

  // Per-location merge fields (auto-fill caption tokens like {{linktree}}).
  useEffect(() => {
    if (!activeClient?.id) return;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(activeClient.id)}&key=merge_vars`)
      .then((r) => r.json())
      .then((d) => setMergeVars(d.value && typeof d.value === 'object' && !Array.isArray(d.value) ? d.value : {}))
      .catch(() => setMergeVars({}));
  }, [activeClient?.id]);
  function saveMergeVars(next: Record<string, string>) {
    if (!activeClient?.id) return;
    setMergeVars(next);
    fetch('/api/client-kv', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: activeClient.id, key: 'merge_vars', value: next }) })
      .then(() => { setMergeSaved(true); setTimeout(() => setMergeSaved(false), 1200); })
      .catch(() => {});
  }

  // Opt this location in/out of auto-posting PDM brand-cascade posts.
  useEffect(() => {
    if (!activeClient?.id) return;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(activeClient.id)}&key=pdm_autopost`)
      .then((r) => r.json())
      .then((d) => setPdmAutopost(d.value === true))
      .catch(() => setPdmAutopost(false));
  }, [activeClient?.id]);
  function togglePdmAutopost(v: boolean) {
    if (!activeClient?.id) return;
    setPdmAutopost(v);
    fetch('/api/client-kv', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: activeClient.id, key: 'pdm_autopost', value: v }) }).catch(() => {});
  }
  // Re-check the pool when the user returns from the Post for Me connect tab.
  useEffect(() => {
    const onFocus = () => loadSocialAccounts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeClient?.id]);

  async function connectSocial(platform: string) {
    if (!activeClient?.id) return;
    setConnecting(platform);
    try {
      const res = await fetch('/api/social/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: activeClient.id, platform }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not start connection');
      // Open Post for Me's OAuth in a new tab; refresh the pool when they return.
      window.open(d.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      alert(e.message);
    } finally { setConnecting(null); }
  }

  // Tick/untick which pooled accounts THIS client posts to; save immediately.
  async function toggleSocialAccount(acct: { id: string; platform: string; username: string | null }) {
    if (!activeClient?.id) return;
    const next = new Set(socialSelected);
    if (next.has(acct.id)) next.delete(acct.id); else next.add(acct.id);
    setSocialSelected(next);
    const value = socialAccounts.filter((a) => next.has(a.id)).map((a) => ({ id: a.id, platform: a.platform, username: a.username, pageId: a.pageId ?? null }));
    try {
      await fetch('/api/client-kv', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: activeClient.id, key: 'postforme_accounts', value }) });
    } catch { /* keep optimistic state; user can retry */ }
  }

  async function toggleAutoPost(id: string, val: boolean) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, auto_post: val } : it)));
    try { await patchItem(id, { auto_post: val }); } catch {}
  }

  async function publishNow(id: string) {
    if (!activeClient?.id) return;
    if (!confirm('Publish this post to the connected social accounts now? This posts publicly.')) return;
    setPublishing(id);
    try {
      const res = await fetch('/api/social/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, clientId: activeClient.id }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Publish failed');
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, publish_status: 'posted', published_at: new Date().toISOString(), publish_error: null } : it)));
    } catch (e: any) {
      alert(e.message);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, publish_status: 'failed', publish_error: e.message } : it)));
    } finally { setPublishing(null); }
  }

  // Optimistic move for drag-to-reschedule in the calendar view.
  async function movePost(postId: string, toIso: string) {
    setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, post_date: toIso } : p)));
    try {
      await fetch('/api/content-calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, post_date: toIso }),
      });
    } catch {}
  }

  async function saveDate(id: string, value: string) {
    if (!value) return;
    const clean = toDateOnly(value);
    try { await patchItem(id, { post_date: clean }); }
    catch (e: any) { alert(e.message); }
  }

  // Drive folder is stored per-client in the DB (client_kv) so it follows
  // staff across browsers/devices; localStorage doubles as an instant cache.
  function folderStorageKey(clientName: string) {
    return `mna_drive_folder:${clientName}`;
  }

  useEffect(() => {
    if (!activeClient?.name) return;
    try {
      const saved = localStorage.getItem(folderStorageKey(activeClient.name)) || '';
      setDriveFolderUrl(saved);
    } catch { setDriveFolderUrl(''); }
    // DB copy wins over the local cache when present.
    if (activeClient?.id) {
      fetch(`/api/client-kv?clientId=${encodeURIComponent(activeClient.id)}&key=drive_folder_url`)
        .then((r) => r.json())
        .then((d) => { if (typeof d.value === 'string' && d.value) setDriveFolderUrl(d.value); })
        .catch(() => {});
    }
  }, [activeClient?.name, activeClient?.id]);

  function saveDriveFolderUrl(value: string) {
    setDriveFolderUrl(value);
    if (!activeClient?.name) return;
    try {
      if (value) localStorage.setItem(folderStorageKey(activeClient.name), value);
      else localStorage.removeItem(folderStorageKey(activeClient.name));
    } catch {}
    if (activeClient?.id) {
      fetch('/api/client-kv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: activeClient.id, key: 'drive_folder_url', value: value || null }),
      }).catch(() => {});
    }
  }

  async function loadPickerFiles(folderId: string) {
    setPickerError(null);
    setPickerLoading(true);
    setPickerFiles([]);
    try {
      const res = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Drive list failed');
      setPickerFiles(data.files || []);
    } catch (e: any) {
      setPickerError(e.message);
    } finally {
      setPickerLoading(false);
    }
  }

  async function openDrivePicker(postId: string) {
    setPickerForId(postId);
    setPickerError(null);
    setPickerQuery('');
    setPickerFiles([]);
    setPickerPath([]);
    const folderId = extractFolderId(driveFolderUrl);
    // No folder yet → the picker modal shows an inline folder prompt instead
    // of a dead-end alert.
    if (folderId) await loadPickerFiles(folderId);
  }

  // Click a subfolder in the picker → browse into it (not attach it).
  function enterPickerFolder(f: DriveFile) {
    setPickerPath((p) => [...p, { id: f.id, name: f.name }]);
    setPickerQuery('');
    loadPickerFiles(f.id);
  }
  // Breadcrumb click — idx -1 is the root client folder.
  function gotoPickerCrumb(idx: number) {
    const next = idx < 0 ? [] : pickerPath.slice(0, idx + 1);
    setPickerPath(next);
    setPickerQuery('');
    const fid = next.length > 0 ? next[next.length - 1].id : extractFolderId(driveFolderUrl);
    if (fid) loadPickerFiles(fid);
  }

  async function attachDriveFile(postId: string, file: DriveFile) {
    // Folders are for navigation, never attachment.
    if (file.mimeType === 'application/vnd.google-apps.folder') { enterPickerFolder(file); return; }
    const url = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    try {
      const item = items.find((i) => i.id === postId);
      await savePhotos(postId, [...(item ? photosOf(item) : []), url]);
      setPickerForId(null);
    } catch (e: any) { alert(e.message); }
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
    // Seed with every platform this post already runs on, so opening the editor
    // shows the real set rather than just the row you happened to click.
    setEditPlatforms(platformsForPost(item));
    setEditDraft({
      post_date: item.post_date,
      platform: item.platform,
      content_type: item.content_type || '',
      title: parsed.title || '',
    });
  }

  async function saveEdit(id: string) {
    const anchor = items.find((it) => it.id === id);
    if (!anchor) return;
    try {
      // Every ticked platform is honoured — previously only the first was kept
      // and the rest were dropped without a word.
      await syncPlatforms(
        anchor,
        editPlatforms.length > 0 ? editPlatforms : [editDraft.platform],
        {
          post_date: editDraft.post_date,
          title: editDraft.title || null,
          content_type: editDraft.content_type || null,
        },
      );
      setEditingId(null);
    } catch (e: any) { alert(e.message); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this content item?')) return;
    await fetch(`/api/content-calendar?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function cleanupDuplicates() {
    if (!activeClient?.name) return;
    if (!confirm('Remove duplicate posts (same date + platform + title)? The oldest copy is kept.')) return;
    try {
      const res = await fetch(`/api/content-calendar/cleanup-duplicates?client=${encodeURIComponent(activeClient.name)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cleanup failed');
      // Refetch so the UI reflects the cleaned state
      const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
      const listData = await listRes.json();
      setItems(listData.items || []);
      alert(`Removed ${data.removed} duplicate post${data.removed === 1 ? '' : 's'}.`);
    } catch (e: any) { alert(e.message); }
  }

  // ── Monthly Specials Planner ─────────────────────────────────────
  async function generatePlan() {
    if (!activeClient?.name) return;
    setPlanning(true);
    setPlanError(null);
    try {
      const res = await fetch('/api/content-calendar/plan-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: activeClient.name,
          clientId: activeClient.id,
          month: planMonth,
          specials: planSpecials,
          postsPerWeek: planPerWeek,
          selectedDays: Array.from(planDays),
          research: planResearch,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Planning failed');
      setPlanPreview(d.items || []);
      setPlanChecked(new Set((d.items || []).map((_: unknown, i: number) => i)));
    } catch (e: any) {
      setPlanError(e.message);
    } finally {
      setPlanning(false);
    }
  }

  async function addPlannedPosts() {
    if (!activeClient?.name || !planPreview) return;
    const chosen = planPreview.filter((_, i) => planChecked.has(i));
    if (chosen.length === 0) return;
    setPlanAdding(true);
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: activeClient.name, items: chosen }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not add posts');
      setPlanPreview(null);
      setPlanDays(new Set());
      setPlanSpecials('');
      setShowPlanner(false);
      const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
      const listData = await listRes.json();
      setItems(listData.items || []);
      alert(`Added ${d.count} post${d.count === 1 ? '' : 's'} to the calendar.${d.skipped ? ` (${d.skipped} duplicates skipped.)` : ''}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPlanAdding(false);
    }
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
    setShowAddModal(false);
    // Refresh
    const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
    const listData = await listRes.json();
    setItems(listData.items || []);
  }

  // Push a single post to one or more other Prime IV locations. Creates a
  // copy in each target client's calendar (same date/platform/type/title/
  // caption), letting their team tweak/approve independently.
  async function crossPostItem(item: ContentItem, targetClientNames: string[]) {
    if (targetClientNames.length === 0) return { sent: 0, skipped: 0 };
    let sent = 0, skipped = 0;
    for (const clientName of targetClientNames) {
      try {
        const res = await fetch('/api/content-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName,
            items: [{
              post_date: item.post_date,
              platform: item.platform,
              content_type: item.content_type || null,
              title: item.title || null,
              caption: item.caption || null,
              status: 'Draft',
              assigned_role: 'Social Media Manager',
            }],
          }),
        });
        const data = await res.json();
        if (res.ok) {
          sent += data.count || 0;
          skipped += data.skipped || 0;
        }
      } catch {}
    }
    return { sent, skipped };
  }

  async function runCrossPost(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || crossPostTargets.length === 0) return;
    setCrossPosting(true);
    try {
      const targets = primeIvClients.filter((c) => crossPostTargets.includes(c.id)).map((c) => c.name);
      const { sent, skipped } = await crossPostItem(item, targets);
      alert(`Cross-posted to ${sent} location${sent === 1 ? '' : 's'}.${skipped ? ` (${skipped} already existed and were skipped.)` : ''}`);
      setCrossPostId(null);
      setCrossPostTargets([]);
    } catch (e: any) {
      alert(e.message || 'Cross-post failed');
    } finally {
      setCrossPosting(false);
    }
  }

  // Bulk cross-post: push every currently-filtered/visible post to the
  // selected Prime IV locations in one go. Useful for syncing a whole
  // month's plan across locations that run the same campaigns.
  async function runBulkCrossPost() {
    if (bulkCrossTargets.length === 0 || shown.length === 0) return;
    if (!confirm(`Push all ${shown.length} visible post${shown.length === 1 ? '' : 's'} to ${bulkCrossTargets.length} location${bulkCrossTargets.length === 1 ? '' : 's'}? This creates copies — duplicates (same date+platform+title) are skipped automatically.`)) return;
    setBulkCrossPosting({ done: 0, total: shown.length });
    const targets = primeIvClients.filter((c) => bulkCrossTargets.includes(c.id)).map((c) => c.name);
    let totalSent = 0, totalSkipped = 0;
    for (const item of shown) {
      const { sent, skipped } = await crossPostItem(item, targets);
      totalSent += sent;
      totalSkipped += skipped;
      setBulkCrossPosting((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setBulkCrossPosting(null);
    setShowBulkCrossPost(false);
    setBulkCrossTargets([]);
    alert(`Done. Created ${totalSent} post${totalSent === 1 ? '' : 's'} across ${targets.length} location${targets.length === 1 ? '' : 's'}.${totalSkipped ? ` ${totalSkipped} duplicates were skipped.` : ''}`);
  }

  useEffect(() => {
    if (!activeClient?.name) return;
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`)
      .then((r) => r.json())
      .then(async (d) => {
        let nextItems: ContentItem[] = d.items || [];
        // One-shot idempotent migration: if any items were seeded as
        // "pending_review" before the PDM auto-approve fix, flip them to
        // approved + 'PDM (Brand)' so they render correctly everywhere.
        const needsMigrate = nextItems.some((i) =>
          /^\[\s*PDM\b/i.test(i.title || '') &&
          ((i.client_approval_status || 'pending_review') !== 'approved' || i.assigned_role !== 'PDM (Brand)'),
        );
        if (needsMigrate) {
          try {
            await fetch('/api/content-calendar/migrate-pdm', { method: 'POST' });
            // Reload fresh rows after migration
            const r = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient!.name)}`);
            const fresh = await r.json();
            nextItems = fresh.items || nextItems;
          } catch {}
        }
        setItems(nextItems);
      })
      .finally(() => setLoading(false));
  }, [activeClient?.name]);

  const platforms = Array.from(new Set(items.map((i) => i.platform)));
  // Approval counts exclude PDM reference posts — they aren't part of
  // MNA's approval queue.
  const byApproval: Record<ApprovalStatus, number> = {
    drafting: 0, pending_review: 0, approved: 0, changes_requested: 0, scheduled: 0,
  };
  items.forEach((i) => {
    if (isPdmItem(i)) return;
    const s = (i.client_approval_status || 'pending_review') as ApprovalStatus;
    if (byApproval[s] !== undefined) byApproval[s]++;
  });
  const platformFiltered = filter === 'all' ? items : items.filter((i) => i.platform === filter);
  const filtered = approvalFilter === 'all'
    ? platformFiltered
    : platformFiltered.filter((i) => !isPdmItem(i) && (i.client_approval_status || 'pending_review') === approvalFilter);
  const shown = [...filtered].sort((a, b) => {
    const cmp = a.post_date.localeCompare(b.post_date);
    return sortAsc ? cmp : -cmp;
  });

  // Calendar view: group by month, newest→oldest, with past months hidden
  // unless the user toggles them back in.
  const nowMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const { calendarMonths, pastMonthCount } = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const it of shown) {
      const k = monthKey(it.post_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    // Always newest → oldest
    const all = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const past = all.filter(([k]) => k < nowMonthKey);
    const visible = showPastMonths ? all : all.filter(([k]) => k >= nowMonthKey);
    return { calendarMonths: visible, pastMonthCount: past.length };
  }, [shown, nowMonthKey, showPastMonths]);

  const activeItem = items.find((i) => i.id === activeId) || null;
  // Reseed the detail panel's platform chips whenever a different post opens.
  useEffect(() => {
    setActivePlatforms(activeItem ? platformsForPost(activeItem) : []);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeId, items]);

  // Days in the planner's month that already have posts (planner fills around).
  const planTakenDays = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (monthKey(i.post_date) === planMonth) s.add(i.post_date); });
    return s;
  }, [items, planMonth]);

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
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'cards' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span>
              Cards
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white/15 text-white shadow' : 'text-white/50 hover:text-white/70'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
              Calendar
            </button>
          </div>
          {isStaff && (
            <>
              <button
                onClick={cleanupDuplicates}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white border border-white/10 inline-flex items-center gap-1"
                title="Remove duplicate posts (same date + platform + title)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cleaning_services</span>
                Clean duplicates
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
                style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
              >
                {showAddForm ? 'Cancel' : '+ Add Post'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Social auto-post — connect a pool, then assign per client (staff only) */}
      {isStaff && (
        <div className="glass-card p-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-cyan-400 shrink-0" style={{ fontSize: 18 }}>share</span>
            <div className="text-[11px] text-white/55 shrink-0">Social auto-post ({activeClient?.shortName}) —</div>
            {!socialConfigured ? (
              <div className="text-[11px] text-amber-300/90">Add <code className="text-amber-200">POST_FOR_ME_API_KEY</code> in Vercel to enable posting.</div>
            ) : (
              <>
                <span className="text-[10px] text-white/40 shrink-0">Connect accounts:</span>
                {(['instagram', 'facebook', 'tiktok', 'youtube'] as const).map((pl) => (
                  <button
                    key={pl}
                    onClick={() => connectSocial(pl)}
                    disabled={connecting === pl}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 capitalize bg-white/10 text-white/80 hover:text-white disabled:opacity-50"
                    title={`Connect a ${pl} account to your Post for Me pool`}
                  >
                    + {pl}
                  </button>
                ))}
                <button onClick={loadSocialAccounts} className="text-[11px] text-white/50 hover:text-white/80 px-2 shrink-0" title="Refresh accounts">↻</button>
              </>
            )}
          </div>

          {socialConfigured && (
            <div className="pl-7">
              <button
                type="button"
                onClick={() => setShowAccounts((s) => !s)}
                className="w-full flex items-start gap-2 text-left mb-1.5"
                title={showAccounts ? 'Collapse the account list' : 'Expand to change which accounts get posted to'}
              >
                <span className="text-[10px] text-white/50 flex-1">
                  Post <span className="font-semibold text-white/70">{activeClient?.shortName}</span>&apos;s content ONLY to{' '}
                  {socialSelected.size === 0 ? (
                    <span className="text-amber-300/80">no accounts yet</span>
                  ) : (
                    <span className="font-semibold text-emerald-300">
                      {socialSelected.size} account{socialSelected.size === 1 ? '' : 's'}
                    </span>
                  )}
                  {!showAccounts && socialSelected.size > 0 && (
                    <span className="block text-white/40 mt-0.5">
                      {socialAccounts
                        .filter((a) => socialSelected.has(a.id))
                        .map((a) => `${a.platform.replace('_business', '')} ${a.username ? `@${a.username}` : a.id}`)
                        .join(', ')}
                    </span>
                  )}
                </span>
                <span className="text-white/40 text-[11px] shrink-0">{showAccounts ? '▲' : '▼'}</span>
              </button>
              {showAccounts && (socialAccounts.length === 0 ? (
                <div className="text-[10px] text-white/35">No accounts connected yet — use the buttons above, then hit ↻.</div>
              ) : (
                <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                  {socialAccounts.map((a) => {
                    const on = socialSelected.has(a.id);
                    return (
                      <label key={a.id} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-md cursor-pointer ${on ? 'bg-emerald-500/10 text-emerald-200' : 'text-white/60 hover:bg-white/5'}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleSocialAccount(a)} className="accent-emerald-400" />
                        {a.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.photo} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-white/10 shrink-0" />
                        )}
                        <span className="capitalize font-semibold w-24 shrink-0">{a.platform.replace('_business', '')}</span>
                        <span className="text-white/60 truncate flex-1">{a.username ? `@${a.username}` : a.id}</span>
                        {a.pageId && <span className="text-white/35 text-[9px] font-mono shrink-0" title="Facebook/Instagram Page ID">ID {a.pageId}</span>}
                      </label>
                    );
                  })}
                </div>
              ))}
              {socialSelected.size === 0 && socialAccounts.length > 0 && (
                <div className="text-[10px] text-amber-300/80 mt-1">Nothing ticked — this client won&apos;t auto-post anywhere (safe default).</div>
              )}
            </div>
          )}
          {socialConfigured && (
            <label className="flex items-center gap-2 pl-7 text-[11px] text-white/60 cursor-pointer">
              <input type="checkbox" checked={pdmAutopost} onChange={(e) => togglePdmAutopost(e.target.checked)} className="accent-cyan-400" />
              Also auto-post <span className="text-blue-300 font-semibold">PDM brand posts</span> for this location
              <span className="text-white/35">(for locations corporate isn&apos;t covering)</span>
            </label>
          )}
        </div>
      )}

      {/* Location merge fields — auto-fill caption tokens per client (staff) */}
      {isStaff && (
        <div className="glass-card p-3">
          <button onClick={() => setShowMerge((s) => !s)} className="w-full flex items-center gap-2 text-left">
            <span className="material-symbols-outlined text-cyan-400 shrink-0" style={{ fontSize: 18 }}>alternate_email</span>
            <span className="text-[11px] text-white/55">Location fields ({activeClient?.shortName}) — auto-fill caption tags like <code className="text-cyan-200">{'{{linktree}}'}</code></span>
            {mergeSaved && <span className="text-[10px] text-emerald-300">Saved</span>}
            <span className="ml-auto text-white/40 text-[11px]">{showMerge ? '▲' : '▼'}</span>
          </button>
          {showMerge && (
            <div className="mt-3 space-y-2.5">
              <div className="text-[10px] text-white/45">
                In any caption, type a tag like <code className="text-cyan-200">{'{{linktree}}'}</code> or <code className="text-cyan-200">{'{{location}}'}</code>. When this location posts, the tag is swapped for its value below — so one brand caption localizes itself per location.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {KNOWN_MERGE_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-white/50">{f.label} <code className="text-cyan-300/70">{`{{${f.key}}}`}</code></span>
                    <input
                      defaultValue={mergeVars[f.key] || ''}
                      placeholder={f.placeholder}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (mergeVars[f.key] || '')) saveMergeVars({ ...mergeVars, [f.key]: v }); }}
                      className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/25"
                    />
                  </label>
                ))}
                {Object.keys(mergeVars).filter((k) => !KNOWN_MERGE_FIELDS.some((f) => f.key === k)).map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-white/50 capitalize">{k} <code className="text-cyan-300/70">{`{{${k}}}`}</code></span>
                    <input
                      defaultValue={mergeVars[k] || ''}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (mergeVars[k] || '')) saveMergeVars({ ...mergeVars, [k]: v }); }}
                      className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() => { const key = prompt('Custom field name (letters/numbers only), e.g. "promo":')?.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''); if (key && !mergeVars[key]) saveMergeVars({ ...mergeVars, [key]: '' }); }}
                className="text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200"
              >+ Add custom field</button>
            </div>
          )}
        </div>
      )}

      {/* Monthly Specials Planner — specials in, AI month plan out (staff) */}
      {isStaff && (
        <div className="glass-card p-3" style={{ borderLeft: '3px solid #4ab8ce' }}>
          <button onClick={() => setShowPlanner((s) => !s)} className="w-full flex items-center gap-2 text-left">
            <span className="material-symbols-outlined text-cyan-300 shrink-0" style={{ fontSize: 18 }}>auto_awesome</span>
            <span className="text-[12px] font-semibold text-white/80">Monthly Specials Planner</span>
            <span className="text-[11px] text-white/45">— enter the month&apos;s specials and AI drafts the whole calendar around them</span>
            <span className="ml-auto text-white/40 text-[11px]">{showPlanner ? '▲' : '▼'}</span>
          </button>
          {showPlanner && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Month</span>
                  <input
                    type="month"
                    value={planMonth}
                    onChange={(e) => { setPlanMonth(e.target.value); setPlanDays(new Set()); }}
                    className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Posts per week {planDays.size > 0 && <span className="text-white/35 normal-case">(ignored — you picked days)</span>}</span>
                  <select
                    value={planPerWeek}
                    onChange={(e) => setPlanPerWeek(Number(e.target.value))}
                    disabled={planDays.size > 0}
                    className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none disabled:opacity-40"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n} className="bg-slate-800">{n} / week</option>)}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2 text-[11px] text-white/70 cursor-pointer">
                  <input type="checkbox" checked={planResearch} onChange={(e) => setPlanResearch(e.target.checked)} className="accent-cyan-400" />
                  Pull extra ideas from the website &amp; past posts
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Specials &amp; promos this month</span>
                <textarea
                  value={planSpecials}
                  onChange={(e) => setPlanSpecials(e.target.value)}
                  rows={3}
                  placeholder={'e.g. 20% off NAD+ drips all month · Buy 2 get 1 free memberships week of the 15th · Mother’s Day gift cards'}
                  className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25 leading-relaxed"
                />
              </label>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Post days <span className="text-white/35 normal-case font-semibold">(optional — click days to hand-pick; leave blank and it spreads {planPerWeek}/week around existing posts)</span>
                </div>
                <div className="grid grid-cols-7 gap-1 max-w-md">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                    <div key={`${w}-${i}`} className="text-[9px] font-bold text-white/35 text-center">{w}</div>
                  ))}
                  {Array.from({ length: firstWeekday(planMonth) }).map((_, i) => <div key={`pp-${i}`} />)}
                  {Array.from({ length: daysInMonth(planMonth) }).map((_, i) => {
                    const day = i + 1;
                    const iso = `${planMonth}-${String(day).padStart(2, '0')}`;
                    const picked = planDays.has(iso);
                    const taken = planTakenDays.has(iso);
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setPlanDays((prev) => { const n = new Set(prev); if (n.has(iso)) n.delete(iso); else n.add(iso); return n; })}
                        className={`h-8 rounded-lg text-[10px] font-bold border transition-colors relative ${
                          picked
                            ? 'bg-cyan-500/40 text-white border-cyan-300/60'
                            : 'bg-white/5 text-white/50 border-white/10 hover:border-white/25'
                        }`}
                        title={taken ? 'Already has a post — the plan works around it' : picked ? 'Selected for a new post' : 'Click to post on this day'}
                      >
                        {day}
                        {taken && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-300" />}
                      </button>
                    );
                  })}
                </div>
                {planTakenDays.size > 0 && (
                  <div className="text-[10px] text-white/40 mt-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 mr-1 align-middle" />
                    {planTakenDays.size} day{planTakenDays.size === 1 ? '' : 's'} already {planTakenDays.size === 1 ? 'has' : 'have'} posts — the plan fills around them and won&apos;t duplicate topics.
                  </div>
                )}
              </div>
              {planError && <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">{planError}</div>}
              <button
                onClick={generatePlan}
                disabled={planning || (!planSpecials.trim() && !planResearch)}
                className="text-[12px] font-bold px-5 py-2 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                {planning ? 'Planning the month…' : 'Generate plan'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Planner preview — review the AI plan before it hits the calendar */}
      {isStaff && planPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !planAdding && setPlanPreview(null)}>
          <div
            className="max-w-3xl w-full max-h-[88vh] flex flex-col rounded-2xl"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(74,184,206,0.4)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="text-white font-bold text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-300" style={{ fontSize: 20 }}>auto_awesome</span>
                Proposed plan — {formatMonth(planMonth)}
              </div>
              <button onClick={() => setPlanPreview(null)} className="text-white/40 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="text-[11px] text-white/50 px-5 pt-3">
              Untick anything you don&apos;t want, then add the rest to the calendar as drafts. Nothing is visible to the client until you push it.
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {planPreview.map((p, i) => {
                const on = planChecked.has(i);
                const parsed = parseTitle(p.title);
                return (
                  <label
                    key={`${p.post_date}-${i}`}
                    className={`flex gap-3 items-start rounded-xl border p-3 cursor-pointer transition-colors ${on ? 'bg-white/8 border-cyan-300/30' : 'bg-white/3 border-white/10 opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setPlanChecked((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                      className="mt-1 accent-cyan-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{fmtDate(p.post_date)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">{p.platform}</span>
                        {p.content_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">{p.content_type}</span>}
                        {parsed.phase && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 font-bold uppercase tracking-wider">{parsed.phase}</span>}
                      </div>
                      <div className="text-[13px] font-bold text-white mt-1">{parsed.title}</div>
                      {parsed.hook && <div className="text-[11px] text-amber-200/80 mt-0.5">Hook: {parsed.hook}</div>}
                      {p.caption && <div className="text-[11px] text-white/55 mt-1 line-clamp-2 whitespace-pre-wrap">{p.caption}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-2 flex-wrap">
              <button
                onClick={addPlannedPosts}
                disabled={planAdding || planChecked.size === 0}
                className="text-[13px] font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
              >
                {planAdding ? 'Adding…' : `Add ${planChecked.size} post${planChecked.size === 1 ? '' : 's'} to calendar`}
              </button>
              <button
                onClick={generatePlan}
                disabled={planning || planAdding}
                className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 disabled:opacity-40"
              >
                {planning ? 'Regenerating…' : '↻ Regenerate'}
              </button>
              <button
                onClick={() => setPlanPreview(null)}
                disabled={planAdding}
                className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/50 border border-white/10"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {isStaff && showAddForm && (
        <div id="add-post-form" className="glass-card p-5">
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

      {/* Quick-add popup — opened by clicking an empty day on the calendar */}
      {isStaff && showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowAddModal(false)}>
          <div
            className="max-w-lg w-full rounded-2xl p-6 space-y-3"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-white font-bold text-base flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4ab8ce' }}>add_circle</span>
                New post{newPost.post_date ? ` — ${fmtDate(newPost.post_date)}` : ''}
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
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
                {CONTENT_TYPES.map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Platforms</div>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const selected = newPostPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPostPlatforms((prev) => (selected ? prev.filter((x) => x !== p) : [...prev, p]))}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        selected ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
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
              autoFocus
              placeholder="Post title..."
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && newPost.title.trim()) addPost(); }}
              className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
            />
            <textarea
              placeholder="Caption (optional — leave blank to write with AI later)..."
              value={newPost.caption}
              onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
              rows={3}
              className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
            />
            <div className="flex gap-2">
              <button
                onClick={addPost}
                className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
                style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
              >
                Add Post
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-white/5 text-white/60 border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
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

      {/* Drive Library — folder URL per client, persisted to localStorage */}
      {isStaff && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-white/80" style={{ fontSize: 18 }}>folder_shared</span>
              <div>
                <div className="text-white font-semibold text-sm">Drive Library</div>
                <div className="text-white/55 text-xs">
                  {extractFolderId(driveFolderUrl)
                    ? 'Connected — "Pick from Drive" pulls from this folder.'
                    : 'Paste the client’s Drive folder URL to enable "Pick from Drive" on each card.'}
                </div>
              </div>
            </div>
            {editingFolder || !extractFolderId(driveFolderUrl) ? (
              <div className="flex gap-2 flex-1 max-w-xl">
                <input
                  type="text"
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                />
                <button
                  onClick={() => { saveDriveFolderUrl(driveFolderUrl); setEditingFolder(false); }}
                  className="text-[12px] font-bold px-3 py-2 rounded-lg bg-emerald-500/80 text-white"
                >
                  Save
                </button>
                {extractFolderId(driveFolderUrl) && (
                  <button
                    onClick={() => setEditingFolder(false)}
                    className="text-[12px] font-bold px-3 py-2 rounded-lg bg-white/10 text-white/80"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href={driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-white/70 hover:text-white inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                  Open folder
                </a>
                <button
                  onClick={() => setEditingFolder(true)}
                  className="text-[11px] font-semibold text-white/60 hover:text-white inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  Change
                </button>
                <button
                  onClick={() => { saveDriveFolderUrl(''); setEditingFolder(false); }}
                  className="text-[11px] font-semibold text-white/40 hover:text-rose-300 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="text-white/40 text-[10px] mt-2">
            Tip · "Pick from Drive" needs your own Google account connected — Drive access is granted per person, not by an admin. Connect it from the Drive picker, or on the <a href="/schedule" className="underline text-white/60">Schedule</a> page.
          </div>
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

      {/* Cross-post to other Prime IV locations */}
      {isStaff && items.length > 0 && primeIvClients.some((c) => c.id !== activeClient?.id) && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderLeft: '3px solid #c8a96e' }}>
          <div>
            <div className="text-white font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sync_alt</span>
              Cross-post to other Prime IV locations
            </div>
            <div className="text-white/60 text-xs">
              Push the {shown.length === items.length ? 'whole calendar' : `${shown.length} filtered post${shown.length === 1 ? '' : 's'}`} to other Prime IV clients at once. Each lands as a draft for their team to fine-tune and approve.
            </div>
          </div>
          <button
            onClick={() => { setShowBulkCrossPost(true); setBulkCrossTargets([]); }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shrink-0 inline-flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#c8a96e,#e0c896)', color: '#1c3d6e' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync_alt</span>
            Mass cross-post…
          </button>
        </div>
      )}

      {/* Bulk cross-post modal: choose target locations, then push all `shown` posts */}
      {isStaff && showBulkCrossPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !bulkCrossPosting && setShowBulkCrossPost(false)}>
          <div
            className="max-w-md w-full rounded-2xl p-6 space-y-4"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(200,169,110,0.35)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-white font-bold text-base flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#c8a96e' }}>sync_alt</span>
                Mass cross-post
              </div>
              {!bulkCrossPosting && (
                <button onClick={() => setShowBulkCrossPost(false)} className="text-white/40 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
            <div className="text-white/60 text-[12px]">
              Sending <span className="font-bold text-white/80">{shown.length}</span> post{shown.length === 1 ? '' : 's'} from <span className="font-bold text-white/80">{activeClient?.name}</span> to:
            </div>
            <div className="flex flex-col gap-2">
              {primeIvClients.filter((c) => c.id !== activeClient?.id).map((c) => {
                const sel = bulkCrossTargets.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!!bulkCrossPosting}
                    onClick={() => setBulkCrossTargets((prev) => sel ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                    className={`text-left text-[13px] font-semibold px-4 py-2.5 rounded-xl border transition-colors flex items-center gap-2 ${
                      sel ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className={`material-symbols-outlined`} style={{ fontSize: 18 }}>{sel ? 'check_box' : 'check_box_outline_blank'}</span>
                    {c.shortName || c.name}
                  </button>
                );
              })}
            </div>
            {bulkCrossPosting ? (
              <div className="space-y-2">
                <div className="text-white/70 text-[12px]">Pushing posts… {bulkCrossPosting.done} / {bulkCrossPosting.total}</div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(bulkCrossPosting.done / Math.max(1, bulkCrossPosting.total)) * 100}%`, background: 'linear-gradient(90deg,#c8a96e,#e0c896)' }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={runBulkCrossPost}
                  disabled={bulkCrossTargets.length === 0}
                  className="flex-1 font-bold text-[13px] px-4 py-2.5 rounded-xl disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#c8a96e,#e0c896)', color: '#1c3d6e' }}
                >
                  Push {shown.length} post{shown.length === 1 ? '' : 's'} to {bulkCrossTargets.length || ''} location{bulkCrossTargets.length === 1 ? '' : 's'}
                </button>
                <button
                  onClick={() => setShowBulkCrossPost(false)}
                  className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/60 border border-white/10"
                >
                  Cancel
                </button>
              </div>
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

      {/* Calendar past-months toggle */}
      {!loading && viewMode === 'calendar' && pastMonthCount > 0 && (
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

      {/* Calendar grid view */}
      {!loading && viewMode === 'calendar' && calendarMonths.map(([key, monthItems]) => {
        const total = daysInMonth(key);
        const offset = firstWeekday(key);
        const byDay: Record<number, ContentItem[]> = {};
        for (const it of monthItems) {
          const day = Number(it.post_date.slice(8, 10));
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(it);
        }
        return (
          <div key={key} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-bold text-white">{formatMonth(key)}</div>
              <div className="text-[11px] text-white/40">{monthItems.length} posts</div>
            </div>
            {isStaff && (
              <div className="text-[10px] text-white/45 mb-3">
                Tip · Drag a post to another day to reschedule it.
              </div>
            )}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                <div key={w} className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-center pb-2">{w}</div>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: total }).map((_, i) => {
                const day = i + 1;
                const posts = byDay[day] || [];
                const today = new Date();
                const isToday = key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` && day === today.getDate();
                const iso = `${key}-${String(day).padStart(2, '0')}`;
                const isDragTarget = dragOverIso === iso;
                return (
                  <div
                    key={day}
                    onClick={(e) => { if (isStaff && e.target === e.currentTarget) openNewPostForDate(iso); }}
                    onDragOver={(e) => { if (isStaff && draggingId) { e.preventDefault(); setDragOverIso(iso); } }}
                    onDragLeave={() => setDragOverIso((cur) => (cur === iso ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingId) {
                        movePost(draggingId, iso);
                        setDraggingId(null);
                        setDragOverIso(null);
                      }
                    }}
                    className={`min-h-[100px] rounded-xl border p-1.5 flex flex-col gap-1 ${
                      isToday ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/10 bg-white/5'
                    } ${isStaff ? 'cursor-pointer' : ''}`}
                    style={isDragTarget ? { outline: '2px dashed #4ab8ce', outlineOffset: 2 } : undefined}
                    title={isStaff ? 'Click an empty area to add a post on this day' : undefined}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (isStaff) openNewPostForDate(iso); }}
                      className={`text-[10px] font-bold text-left ${isToday ? 'text-sky-300' : 'text-white/40'} ${isStaff ? 'hover:text-white' : ''}`}
                      title={isStaff ? 'Add a post on this day' : undefined}
                    >
                      {day}
                    </button>
                    {posts.map((p) => {
                      const parsed = parseTitle(p.title);
                      const pdm = isPdmItem(p);
                      const status = (p.client_approval_status || 'pending_review') as ApprovalStatus;
                      const astyle = APPROVAL_STYLES[status];
                      return (
                        <button
                          key={p.id}
                          draggable={isStaff}
                          onDragStart={isStaff ? (e) => { setDraggingId(p.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                          onDragEnd={isStaff ? () => { setDraggingId(null); setDragOverIso(null); } : undefined}
                          onClick={(e) => { e.stopPropagation(); setActiveId(p.id); }}
                          className={`group relative text-left rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition ${pdm ? '' : 'border border-white/10'} ${isStaff ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          style={{
                            ...(pdm
                              ? { background: PDM_STYLE.chipBg, border: `1px solid ${PDM_STYLE.chipBorder}` }
                              : { background: 'rgba(255,255,255,0.06)' }),
                            opacity: draggingId === p.id ? 0.4 : 1,
                          }}
                          title={pdm ? 'PDM · Brand Cascade (reference only, no approval)' : isStaff ? 'Click to open, drag to reschedule' : undefined}
                        >
                          <DriveThumb url={photosOf(p)[0]} className="w-full h-[48px] object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
                          {photosOf(p).length > 1 && (
                            <span className="absolute top-0.5 right-0.5 z-10 text-[8px] font-bold px-1 py-0.5 rounded bg-black/60 text-white/90 inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined" style={{ fontSize: 9 }}>photo_library</span>
                              {photosOf(p).length}
                            </span>
                          )}
                          <div className="px-1.5 py-1">
                            <div className={`text-[9px] font-bold truncate ${pdm ? 'text-blue-100' : 'text-white/80'}`}>
                              {pdm && <span className="text-blue-300 font-bold">PDM · </span>}
                              {parsed.title || p.platform}
                            </div>
                            {pdm ? (
                              <span
                                className="px-1 py-0.5 rounded text-[7px] font-bold mt-0.5 inline-block"
                                style={{ background: 'rgba(96,165,250,0.2)', color: '#93c5fd' }}
                              >
                                {PDM_STYLE.label}
                              </span>
                            ) : (
                              <span className={`${astyle.bg} ${astyle.text} px-1 py-0.5 rounded text-[7px] font-bold mt-0.5 inline-block`}>
                                {astyle.label}
                              </span>
                            )}
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

      {/* Modal when a calendar cell is clicked */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActiveId(null)}>
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl"
            style={{
              background: 'rgba(15,31,46,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(24px) saturate(180%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const parsed = parseTitle(activeItem.title);
              const pdm = isPdmItem(activeItem);
              const status = (activeItem.client_approval_status || 'pending_review') as ApprovalStatus;
              const astyle = APPROVAL_STYLES[status];
              const photos = photosOf(activeItem);
              const driveLink = photoOpenUrl(photos[0]);
              const gallery = photos.length > 0 && (
                <>
                  <a href={driveLink || undefined} target="_blank" rel="noreferrer" className="block bg-black">
                    <DriveThumb url={photos[0]} className="w-full max-h-80 object-contain" />
                  </a>
                  {photos.length > 1 && (
                    <div className="flex gap-1.5 p-2 bg-black/60 overflow-x-auto">
                      {photos.map((u, idx) => (
                        <div key={`${u}-${idx}`} className="relative shrink-0">
                          <a href={photoOpenUrl(u) || undefined} target="_blank" rel="noreferrer" className="block">
                            <DriveThumb url={u} className="h-16 w-16 object-cover rounded-md border border-white/15" />
                          </a>
                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => removePhotoAt(activeItem.id, idx)}
                              className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-black/80 text-white/80 hover:bg-rose-600 hover:text-white flex items-center justify-center"
                              title="Remove this photo"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
              return (
                <>
                  {isStaff ? (
                    <PhotoDropZone
                      isStaff={isStaff}
                      uploading={uploadingId === activeItem.id}
                      hasImage={photos.length > 0}
                      onFiles={(fs) => uploadImages(activeItem.id, fs)}
                      className="block overflow-hidden rounded-t-2xl"
                    >
                      {gallery}
                    </PhotoDropZone>
                  ) : (
                    photos.length > 0 && (
                      <div className="rounded-t-2xl overflow-hidden">{gallery}</div>
                    )
                  )}
                  {isStaff && (
                    <div className="px-6 pt-4 -mb-1 flex items-center gap-3">
                      <button
                        onClick={() => openDrivePicker(activeItem.id)}
                        className="text-[11px] font-semibold text-white/70 hover:text-white inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        title="Pick a file from the client's Drive folder"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder_open</span>
                        Pick from Drive
                      </button>
                      {photos.length > 1 && (
                        <span className="text-[10px] text-white/35 inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>photo_library</span>
                          {photos.length} photos
                        </span>
                      )}
                    </div>
                  )}
                  {pdm && (
                    <div className="px-6 pt-5">
                      <div className="rounded-xl p-3 flex items-center gap-2"
                           style={{ background: PDM_STYLE.chipBg, border: `1px solid ${PDM_STYLE.chipBorder}` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: PDM_STYLE.accent }}>info</span>
                        <div className="text-[12px] text-blue-100 leading-snug">
                          {pdmAutopost ? (
                            <><span className="font-bold">PDM · Brand Cascade.</span> Auto-posting is <span className="font-bold">ON</span> for this location — MNA will publish this brand post to the assigned account(s) at the best time on its date.</>
                          ) : (
                            <><span className="font-bold">PDM · Brand Cascade.</span> Reference only — Prime IV corporate posts this from the brand page, so MNA doesn&apos;t need to approve or publish it. Use it to plan local content around.</>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                        {isStaff && editingDateId === activeItem.id ? (
                          <input
                            type="date"
                            autoFocus
                            defaultValue={activeItem.post_date}
                            onBlur={async (e) => {
                              const v = e.target.value;
                              if (v && v !== activeItem.post_date) await saveDate(activeItem.id, v);
                              setEditingDateId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingDateId(null);
                              else if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/10 border border-white/25 text-white outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => isStaff && setEditingDateId(activeItem.id)}
                            className={`text-[11px] font-bold uppercase tracking-wider text-white/40 ${isStaff ? 'hover:text-white' : ''}`}
                            title={isStaff ? 'Click to edit date' : undefined}
                          >
                            {fmtDate(activeItem.post_date)}
                          </button>
                        )}
                        <span>·&nbsp;</span>
                        {isStaff && (!pdm || pdmAutopost) ? (
                          <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                            {PLATFORMS.map((p) => {
                              const on = activePlatforms.includes(p);
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  disabled={syncingPlatforms}
                                  onClick={async () => {
                                    const next = on
                                      ? activePlatforms.filter((x) => x !== p)
                                      : [...activePlatforms, p];
                                    if (next.length === 0) { alert('A post needs at least one platform.'); return; }
                                    const before = activePlatforms;
                                    setActivePlatforms(next);
                                    setSyncingPlatforms(true);
                                    try {
                                      await syncPlatforms(activeItem, next, {
                                        post_date: activeItem.post_date,
                                        title: activeItem.title,
                                        content_type: activeItem.content_type,
                                      });
                                    } catch (err: any) {
                                      setActivePlatforms(before);
                                      alert(err.message);
                                    } finally { setSyncingPlatforms(false); }
                                  }}
                                  title={on
                                    ? `Posting to ${p} — click to remove`
                                    : `Also post this to ${p}`}
                                  className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border transition-colors disabled:opacity-40 ${
                                    on
                                      ? 'bg-white/15 text-white border-white/30'
                                      : 'bg-transparent text-white/30 border-white/10 hover:text-white/60 hover:border-white/25'
                                  }`}
                                >
                                  {on && '✓ '}{p}
                                </button>
                              );
                            })}
                            {syncingPlatforms && <span className="text-[10px] text-white/40">saving…</span>}
                          </span>
                        ) : (
                          <span>{activePlatforms.length > 1 ? activePlatforms.join(' · ') : activeItem.platform}</span>
                        )}
                        <span>&nbsp;· {activeItem.content_type || 'Post'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isStaff && (
                          <button
                            onClick={() => deleteItem(activeItem.id)}
                            className="text-white/40 hover:text-rose-300 transition-colors p-1"
                            title="Delete this post"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        )}
                        <button onClick={() => setActiveId(null)} className="text-white/40 hover:text-white p-1">
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                    </div>
                    {parsed.phase && (
                      <span
                        className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={pdm
                          ? { background: 'rgba(96,165,250,0.2)', color: '#93c5fd' }
                          : undefined}
                      >
                        {!pdm && <span className="bg-white/10 text-white/60 rounded px-2 py-0.5">{parsed.phase}</span>}
                        {pdm && parsed.phase}
                      </span>
                    )}
                    <div className="text-[20px] font-bold text-white leading-tight">{parsed.title}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {pdm ? (
                        <span
                          className="text-[11px] font-bold px-2 py-1 rounded"
                          style={{ background: PDM_STYLE.chipBg, color: '#93c5fd', border: `1px solid ${PDM_STYLE.chipBorder}` }}
                        >
                          {PDM_STYLE.label}
                        </span>
                      ) : (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded ${astyle.bg} ${astyle.text}`}>{astyle.label}</span>
                      )}
                      {activeItem.client_visible && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Live to client</span>
                      )}
                      {driveLink && (
                        <a href={driveLink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_library</span>
                          View Photo
                        </a>
                      )}
                    </div>
                    {parsed.hook && (
                      <div className="text-[12px] text-amber-200/80 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                        <span className="text-[10px] font-bold uppercase text-amber-300/60 block mb-1">Hook</span>
                        {parsed.hook}
                      </div>
                    )}
                    {parsed.cta && (
                      <div className="text-[12px] text-sky-200/80 bg-sky-500/10 rounded-lg p-3 border border-sky-500/20">
                        <span className="text-[10px] font-bold uppercase text-sky-300/60 block mb-1">CTA</span>
                        {parsed.cta}
                      </div>
                    )}
                    {(activeItem.caption || isStaff) && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Caption</div>
                          {isStaff && !editingCaption[activeItem.id] && (
                            <button
                              onClick={() => { setCaptionDraft((d) => ({ ...d, [activeItem.id]: activeItem.caption || '' })); setEditingCaption((ec) => ({ ...ec, [activeItem.id]: true })); }}
                              className="text-[10px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>{activeItem.caption ? 'Edit' : 'Add caption'}
                            </button>
                          )}
                        </div>
                        {isStaff && editingCaption[activeItem.id] ? (
                          <div>
                            <textarea
                              value={captionDraft[activeItem.id] ?? activeItem.caption ?? ''}
                              onChange={(e) => setCaptionDraft((d) => ({ ...d, [activeItem.id]: e.target.value }))}
                              rows={7}
                              autoFocus
                              className="w-full text-[13px] text-white/90 bg-white/5 rounded-xl p-3 border border-white/15 outline-none leading-relaxed"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => { try { await patchItem(activeItem.id, { caption: captionDraft[activeItem.id] }); } catch (e: any) { alert(e.message); } setEditingCaption((ec) => ({ ...ec, [activeItem.id]: false })); }}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'rgba(16,185,129,0.3)' }}
                              >Save</button>
                              <button onClick={() => setEditingCaption((ec) => ({ ...ec, [activeItem.id]: false }))} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 border border-white/10">Cancel</button>
                            </div>
                          </div>
                        ) : activeItem.caption ? (
                          <div className="text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 max-h-60 overflow-y-auto">
                            {activeItem.caption}
                          </div>
                        ) : (
                          <div className="text-[12px] text-white/30 italic">No caption yet — click “Add caption”.</div>
                        )}
                      </div>
                    )}
                    {isStaff && (!pdm || pdmAutopost) && (
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Social auto-post{pdm ? ' · PDM (opted in)' : ''}</span>
                          {activeItem.publish_status === 'posted' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">✓ Posted</span>
                          ) : activeItem.publish_status === 'scheduled' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">⏱ Scheduled</span>
                          ) : activeItem.publish_status === 'failed' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">Failed</span>
                          ) : activeItem.auto_post ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">Auto-post on</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer">
                            <input type="checkbox" checked={!!activeItem.auto_post} onChange={(e) => toggleAutoPost(activeItem.id, e.target.checked)} />
                            Auto-post at the best time on {fmtDate(activeItem.post_date)}
                          </label>
                          <button
                            onClick={() => publishNow(activeItem.id)}
                            disabled={publishing === activeItem.id}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-1"
                            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                            {publishing === activeItem.id ? 'Posting…' : 'Publish now'}
                          </button>
                        </div>
                        {activeItem.publish_status === 'scheduled' && activeItem.scheduled_for && (
                          <div className="text-[10px] text-violet-300/90 mt-1.5">Scheduled to go out {new Date(activeItem.scheduled_for).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                        )}
                        {activeItem.auto_post && activeItem.publish_status !== 'scheduled' && activeItem.publish_status !== 'posted' && (
                          <div className="text-[10px] text-white/40 mt-1.5">Will post automatically at this location&apos;s best window that day (staggered if several are due).</div>
                        )}
                        {activeItem.publish_error && <div className="text-[10px] text-rose-300 mt-1.5">{activeItem.publish_error}</div>}
                      </div>
                    )}
                    {activeItem.client_comments && (
                      <div className="text-[12px] bg-rose-500/15 border border-rose-500/30 rounded-lg p-3">
                        <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">Client Comments</div>
                        <div className="text-rose-300 whitespace-pre-wrap">{activeItem.client_comments}</div>
                      </div>
                    )}
                    {activeItem.mna_comments && (
                      <div className="text-[12px] bg-sky-500/15 border border-sky-500/30 rounded-lg p-3">
                        <div className="text-[10px] uppercase font-bold text-sky-400 mb-1">Internal Notes</div>
                        <div className="text-sky-300 whitespace-pre-wrap">{activeItem.mna_comments}</div>
                      </div>
                    )}
                    {/* Staff quick actions — hidden for PDM reference posts */}
                    {isStaff && !pdm && status !== 'scheduled' && (
                      <div className="pt-4 border-t border-white/10 flex gap-2 flex-wrap">
                        {(status === 'approved' || status === 'changes_requested') && (
                          <button
                            onClick={async () => { await patchItem(activeItem.id, { client_approval_status: 'pending_review' }); }}
                            className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/15"
                          >
                            ↩ Reset to pending
                          </button>
                        )}
                        {status === 'pending_review' && (
                          <button
                            onClick={async () => { await patchItem(activeItem.id, { client_approval_status: 'approved' }); }}
                            className="text-[11px] font-bold px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Approve
                          </button>
                        )}
                        {status === 'approved' && (
                          <button
                            onClick={async () => { await patchItem(activeItem.id, { client_approval_status: 'scheduled' }); }}
                            className="text-[11px] font-bold px-4 py-2 rounded-lg bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
                          >
                            Mark scheduled
                          </button>
                        )}
                        {primeIvClients.some((c) => c.id !== activeClient?.id) && (
                          <button
                            onClick={() => { setCrossPostId(activeItem.id); setCrossPostTargets([]); }}
                            className="text-[11px] font-semibold px-3 py-2 rounded-lg text-white/70 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1 ml-auto"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_alt</span>
                            Cross-post
                          </button>
                        )}
                        <button
                          onClick={() => { setFocusCardId(activeItem.id); setActiveId(null); setViewMode('cards'); }}
                          className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/40 hover:bg-white/10"
                        >
                          Open in cards view
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Single-post cross-post picker */}
      {isStaff && crossPostId && (() => {
        const item = items.find((i) => i.id === crossPostId);
        if (!item) return null;
        const parsed = parseTitle(item.title);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => !crossPosting && setCrossPostId(null)}>
            <div
              className="max-w-md w-full rounded-2xl p-6 space-y-4"
              style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(200,169,110,0.35)', backdropFilter: 'blur(24px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-bold text-base flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#c8a96e' }}>sync_alt</span>
                  Cross-post
                </div>
                {!crossPosting && (
                  <button onClick={() => setCrossPostId(null)} className="text-white/40 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
              <div className="text-[12px] text-white/60 bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="font-bold text-white/85 text-[13px] truncate">{parsed.title || item.title || 'Untitled'}</div>
                <div className="mt-0.5">{fmtDate(item.post_date)} · {item.platform} · {item.content_type || 'Post'}</div>
              </div>
              <div className="text-white/60 text-[12px]">Send a copy of this post to:</div>
              <div className="flex flex-col gap-2">
                {primeIvClients.filter((c) => c.id !== activeClient?.id).map((c) => {
                  const sel = crossPostTargets.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={crossPosting}
                      onClick={() => setCrossPostTargets((prev) => sel ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                      className={`text-left text-[13px] font-semibold px-4 py-2.5 rounded-xl border transition-colors flex items-center gap-2 ${
                        sel ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{sel ? 'check_box' : 'check_box_outline_blank'}</span>
                      {c.shortName || c.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => runCrossPost(crossPostId)}
                  disabled={crossPosting || crossPostTargets.length === 0}
                  className="flex-1 font-bold text-[13px] px-4 py-2.5 rounded-xl disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#c8a96e,#e0c896)', color: '#1c3d6e' }}
                >
                  {crossPosting ? 'Sending…' : `Send to ${crossPostTargets.length || ''} location${crossPostTargets.length === 1 ? '' : 's'}`}
                </button>
                <button
                  onClick={() => setCrossPostId(null)}
                  disabled={crossPosting}
                  className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-white/5 text-white/60 border border-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Drive file picker modal */}
      {pickerForId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setPickerForId(null)}>
          <div
            className="max-w-4xl w-full max-h-[85vh] flex flex-col rounded-2xl"
            style={{ background: 'rgba(15,31,46,0.97)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>folder_open</span>
                <div>
                  <div className="text-white font-bold text-sm">Pick from Drive</div>
                  <div className="text-white/50 text-[11px]">
                    {!extractFolderId(driveFolderUrl) ? 'Set the client folder below' : pickerLoading ? 'Loading…' : `${pickerFiles.length} files in folder`}
                  </div>
                </div>
              </div>
              <button onClick={() => setPickerForId(null)} className="text-white/40 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {!extractFolderId(driveFolderUrl) ? (
              <div className="p-6 space-y-3">
                <div className="text-white/75 text-[13px] font-semibold">
                  Paste {activeClient?.shortName || 'the client'}&apos;s Google Drive folder link to browse it here.
                </div>
                <div className="text-white/45 text-[11px]">
                  This is saved once per client, so next time the picker opens straight to the folder. In Drive, open the folder → click <b>Share → Copy link</b> (or copy the address bar URL).
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={driveFolderUrl}
                    onChange={(e) => setDriveFolderUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const fid = extractFolderId(driveFolderUrl); if (fid) { saveDriveFolderUrl(driveFolderUrl); loadPickerFiles(fid); } } }}
                    placeholder="https://drive.google.com/drive/folders/…"
                    autoFocus
                    className="flex-1 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    onClick={() => {
                      const fid = extractFolderId(driveFolderUrl);
                      if (!fid) { setPickerError('That doesn’t look like a Drive folder link — it should contain /folders/.'); return; }
                      saveDriveFolderUrl(driveFolderUrl);
                      loadPickerFiles(fid);
                    }}
                    className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                  >
                    Save &amp; browse
                  </button>
                </div>
                {pickerError && <div className="text-rose-300 text-[12px]">{pickerError}</div>}
              </div>
            ) : (
            <>
            <div className="px-4 pt-2.5 flex items-center gap-1 flex-wrap text-[11px]">
              <button
                onClick={() => gotoPickerCrumb(-1)}
                className={`font-semibold inline-flex items-center gap-1 ${pickerPath.length === 0 ? 'text-white' : 'text-cyan-300 hover:text-cyan-200'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>home</span>
                {activeClient?.shortName || 'Main'} folder
              </button>
              {pickerPath.map((p, i) => (
                <React.Fragment key={`${p.id}-${i}`}>
                  <span className="text-white/30">/</span>
                  <button
                    onClick={() => gotoPickerCrumb(i)}
                    className={`font-semibold max-w-[160px] truncate ${i === pickerPath.length - 1 ? 'text-white' : 'text-cyan-300 hover:text-cyan-200'}`}
                  >
                    {p.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="p-3 border-b border-white/10">
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Filter by name…"
                className="w-full text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {pickerError && (
                <div className="text-rose-300 text-sm bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                  {pickerError}
                  {/^Google (not connected|is connected without Drive)/i.test(pickerError) ? (
                    <div className="mt-2">
                      <button
                        onClick={connectGoogle}
                        disabled={connectingGoogle}
                        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
                      >
                        {connectingGoogle ? 'Opening Google…' : 'Connect Google'}
                      </button>
                      <div className="text-rose-200/70 text-[11px] mt-1.5">
                        Drive access is granted per person — only you can approve it for your account.
                      </div>
                    </div>
                  ) : (
                    <div className="text-rose-200/70 text-[11px] mt-1">
                      If this says Google isn’t connected, go to <a href="/schedule" className="underline">Schedule</a> and reconnect.
                    </div>
                  )}
                </div>
              )}
              {!pickerError && pickerLoading && (
                <div className="text-white/50 text-center py-10 text-sm">Loading Drive files…</div>
              )}
              {!pickerError && !pickerLoading && pickerFiles.length === 0 && (
                <div className="text-white/50 text-center py-10 text-sm">No files in this folder.</div>
              )}
              {!pickerError && !pickerLoading && pickerFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[...pickerFiles]
                    .sort((a, b) => {
                      // Folders first, then keep Drive's modified-desc order
                      const af = a.mimeType === 'application/vnd.google-apps.folder' ? 0 : 1;
                      const bf = b.mimeType === 'application/vnd.google-apps.folder' ? 0 : 1;
                      return af - bf;
                    })
                    .filter((f) => !pickerQuery || f.name.toLowerCase().includes(pickerQuery.toLowerCase()))
                    .map((f) => {
                      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                      if (isFolder) {
                        return (
                          <button
                            key={f.id}
                            onClick={() => enterPickerFolder(f)}
                            className="group text-left rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-cyan-300/40 hover:bg-white/10 transition"
                            title="Open folder"
                          >
                            <div className="aspect-video bg-black/30 flex items-center justify-center">
                              <span className="material-symbols-outlined text-amber-300/80 group-hover:text-amber-200 transition" style={{ fontSize: 42 }}>folder</span>
                            </div>
                            <div className="p-2">
                              <div className="text-white text-[11px] font-semibold truncate">{f.name}</div>
                              <div className="text-cyan-300/70 text-[9px] font-semibold inline-flex items-center gap-0.5">
                                Open folder
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>chevron_right</span>
                              </div>
                            </div>
                          </button>
                        );
                      }
                      const thumb = driveThumbnailUrl(`https://drive.google.com/file/d/${f.id}/view`, 400);
                      return (
                        <button
                          key={f.id}
                          onClick={() => attachDriveFile(pickerForId, f)}
                          className="group text-left rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 transition"
                        >
                          <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <span className="material-symbols-outlined text-white/30" style={{ fontSize: 36 }}>description</span>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="text-white text-[11px] font-semibold truncate">{f.name}</div>
                            <div className="text-white/40 text-[9px] truncate">{f.mimeType.replace('application/', '').replace('image/', 'image · ').replace('video/', 'video · ')}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Card grid view */}
      {!loading && viewMode === 'cards' && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((it) => {
            const parsed = parseTitle(it.title);
            const pdm = isPdmItem(it);
            const approval = (it.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[approval];
            const isEditing = editingId === it.id;

            return (
              <div
                key={it.id}
                id={`card-${it.id}`}
                className="glass-card p-5 flex flex-col gap-3 group scroll-mt-24"
                style={pdm ? { borderLeft: `3px solid ${PDM_STYLE.chipBorder}` } : undefined}
              >
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
                      {isStaff && editingDateId === it.id ? (
                        <input
                          type="date"
                          autoFocus
                          defaultValue={it.post_date}
                          onBlur={async (e) => {
                            const v = e.target.value;
                            if (v && v !== it.post_date) await saveDate(it.id, v);
                            setEditingDateId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingDateId(null);
                            else if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/10 border border-white/25 text-white outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => isStaff && setEditingDateId(it.id)}
                          className={`text-xs font-bold uppercase tracking-wider text-white/60 ${isStaff ? 'hover:text-white' : 'cursor-default'}`}
                          title={isStaff ? 'Click to edit date' : undefined}
                        >
                          {fmtDate(it.post_date)}
                        </button>
                      )}
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
                      {pdm ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-md font-bold"
                          style={{ background: PDM_STYLE.chipBg, color: '#93c5fd', border: `1px solid ${PDM_STYLE.chipBorder}` }}
                        >
                          {PDM_STYLE.label}
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>{style.label}</span>
                      )}
                      {isStaff && !pdm && (
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

                {/* Photos — drag-drop upload (multi), Drive pick, or paste link (staff); view only (client) */}
                {(() => {
                  const photos = photosOf(it);
                  const isEditingP = editingPhoto[it.id];
                  return (
                    <div className="space-y-2">
                      {!isEditingP && (
                        <PhotoDropZone
                          isStaff={isStaff}
                          uploading={uploadingId === it.id}
                          hasImage={photos.length > 0}
                          onFiles={(fs) => uploadImages(it.id, fs)}
                        >
                          {photos.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="relative">
                                <a href={photoOpenUrl(photos[0]) || undefined} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-white/10">
                                  <DriveThumb url={photos[0]} className="w-full h-32 object-cover opacity-80 hover:opacity-100 transition-opacity" />
                                </a>
                                {isStaff && (
                                  <button
                                    type="button"
                                    onClick={() => removePhotoAt(it.id, 0)}
                                    className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-black/60 text-white/80 hover:bg-rose-600 hover:text-white flex items-center justify-center"
                                    title="Remove this photo"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                                  </button>
                                )}
                              </div>
                              {photos.length > 1 && (
                                <div className="grid grid-cols-4 gap-1.5">
                                  {photos.slice(1).map((u, idx) => (
                                    <div key={`${u}-${idx}`} className="relative">
                                      <a href={photoOpenUrl(u) || undefined} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border border-white/10">
                                        <DriveThumb url={u} className="w-full h-14 object-cover opacity-80 hover:opacity-100 transition-opacity" />
                                      </a>
                                      {isStaff && (
                                        <button
                                          type="button"
                                          onClick={() => removePhotoAt(it.id, idx + 1)}
                                          className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-black/60 text-white/80 hover:bg-rose-600 hover:text-white flex items-center justify-center"
                                          title="Remove this photo"
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </PhotoDropZone>
                      )}
                      {isStaff && isEditingP ? (
                        <div className="flex gap-2">
                          <input
                            value={photoDraft[it.id] ?? ''}
                            onChange={(e) => setPhotoDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                            placeholder="Paste an image URL or Google Drive share link"
                            className="flex-1 text-[11px] rounded-lg bg-white/5 border border-white/10 p-2 text-white placeholder:text-white/30"
                          />
                          <button onClick={() => savePhoto(it.id)} className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-emerald-500/80 text-white">Add</button>
                          <button onClick={() => setEditingPhoto((e) => ({ ...e, [it.id]: false }))} className="rounded-lg px-3 py-1 text-[11px] font-semibold bg-white/10 text-white/80">Cancel</button>
                        </div>
                      ) : isStaff ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openDrivePicker(it.id)}
                            className="text-[10px] font-semibold text-white/70 hover:text-white inline-flex items-center gap-1"
                            title="Pick a file from the client's Drive folder"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder_open</span>
                            Pick from Drive
                          </button>
                          <button
                            onClick={() => {
                              setPhotoDraft((d) => ({ ...d, [it.id]: '' }));
                              setEditingPhoto((e) => ({ ...e, [it.id]: true }));
                            }}
                            className="text-[10px] font-semibold text-white/40 hover:text-white inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
                            {photos.length > 0 ? 'Add link' : 'Paste link'}
                          </button>
                          {photos.length > 1 && (
                            <span className="text-[10px] text-white/35 ml-auto inline-flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>photo_library</span>
                              {photos.length} photos
                            </span>
                          )}
                        </div>
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
                      {isStaff && (approval === 'approved' || approval === 'changes_requested') && (
                        <button
                          onClick={() => patchItem(it.id, { client_approval_status: 'pending_review' })}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/15"
                        >
                          ↩ Reset to pending
                        </button>
                      )}
                      {isStaff && approval !== 'drafting' && approval !== 'pending_review' && (
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

                {/* Undo for scheduled posts (shown outside the main approval block) */}
                {isStaff && approval === 'scheduled' && (
                  <div className="pt-2 border-t border-white/10 flex gap-2 flex-wrap">
                    <button
                      onClick={() => patchItem(it.id, { client_approval_status: 'pending_review' })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/15"
                    >
                      ↩ Reset to pending
                    </button>
                    <button
                      onClick={() => patchItem(it.id, { client_approval_status: 'drafting' })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/5 text-white/40 hover:text-white/70"
                    >
                      Back to drafting
                    </button>
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
                    {isStaff && primeIvClients.some((c) => c.id !== activeClient?.id) && (
                      <button
                        onClick={() => { setCrossPostId(it.id); setCrossPostTargets([]); }}
                        className="rounded-lg px-3 py-1.5 font-semibold text-white/60 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1 transition-colors"
                        title="Push this post to other Prime IV locations"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_alt</span>
                        Cross-post
                      </button>
                    )}
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
