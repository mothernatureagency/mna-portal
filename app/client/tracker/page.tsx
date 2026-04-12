'use client';

import { useEffect, useState } from 'react';
import { clients, Client } from '@/lib/clients';
import { createClient } from '@/lib/supabase/client';
import { driveViewUrl } from '@/lib/drive';

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
};

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; bg: string; text: string }> = {
  drafting:          { label: 'Drafting',          bg: 'bg-neutral-100',  text: 'text-neutral-500 italic' },
  pending_review:    { label: 'Ready for review',  bg: 'bg-amber-100',    text: 'text-amber-700' },
  approved:          { label: 'Approved',          bg: 'bg-emerald-100',  text: 'text-emerald-700' },
  changes_requested: { label: 'Changes requested', bg: 'bg-rose-100',     text: 'text-rose-700' },
  scheduled:         { label: 'Scheduled',         bg: 'bg-sky-100',      text: 'text-sky-700' },
};

function parseTitle(raw: string | null) {
  if (!raw) return { phase: '', title: '' };
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const phase = phaseMatch ? phaseMatch[1] : '';
  let rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return { phase, title: hookIdx >= 0 ? rest.slice(0, hookIdx) : rest };
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export default function ClientTrackerPage() {
  const [client, setClient] = useState<Client>(clients.find((c) => c.id === 'prime-iv')!);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      const clientId = (meta.client_id as string) || 'prime-iv';
      const found = clients.find((c) => c.id === clientId);
      if (found) setClient(found);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/content-calendar?client=${encodeURIComponent(client.name)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, [client.name]);

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
    if (!comment) { alert('Please describe what you want changed.'); return; }
    try {
      await patchItem(id, { client_approval_status: 'changes_requested', client_comments: comment });
      setCommentDraft((d) => ({ ...d, [id]: '' }));
    } catch (e: any) { alert(e.message); }
  }

  const { gradientFrom, gradientTo } = client.branding;
  const platforms = Array.from(new Set(items.map((i) => i.platform)));
  const byApproval: Record<ApprovalStatus, number> = {
    drafting: 0, pending_review: 0, approved: 0, changes_requested: 0, scheduled: 0,
  };
  items.forEach((i) => {
    const s = (i.client_approval_status || 'pending_review') as ApprovalStatus;
    if (byApproval[s] !== undefined) byApproval[s]++;
  });
  const platformFiltered = filter === 'all' ? items : items.filter((i) => i.platform === filter);
  const shown = approvalFilter === 'all'
    ? platformFiltered
    : platformFiltered.filter((i) => (i.client_approval_status || 'pending_review') === approvalFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold text-neutral-900">Content Tracker</h1>
        <p className="text-[13px] text-neutral-500 mt-1">
          Review each post, approve it, or leave a comment if you want changes. {items.length} posts total.
        </p>
      </div>

      {/* Platform filters */}
      {platforms.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${filter === 'all' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}
          >
            All ({items.length})
          </button>
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${filter === p ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}
            >
              {p} ({items.filter((i) => i.platform === p).length})
            </button>
          ))}
        </div>
      )}

      {/* Approval filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1">Status</span>
        <button
          onClick={() => setApprovalFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${approvalFilter === 'all' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-500 border-neutral-200'}`}
        >
          All
        </button>
        {(['pending_review', 'changes_requested', 'approved', 'scheduled', 'drafting'] as ApprovalStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setApprovalFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${approvalFilter === s ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-500 border-neutral-200'}`}
          >
            {APPROVAL_STYLES[s].label} ({byApproval[s]})
          </button>
        ))}
      </div>

      {loading && <div className="bg-white rounded-2xl p-8 text-center text-neutral-500 shadow-sm border border-black/5">Loading...</div>}

      {!loading && shown.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-neutral-500 shadow-sm border border-black/5">
          <div className="text-[14px] font-semibold">No content to review</div>
          <div className="text-[12px] mt-1">Your agency will share posts here for your approval.</div>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((it) => {
            const parsed = parseTitle(it.title);
            const status = (it.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[status];
            const driveLink = driveViewUrl(it.photo_drive_url);
            return (
              <div key={it.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5 flex flex-col">
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <span>{fmtDate(it.post_date)}</span>
                    <span>{it.platform} · {it.content_type || 'Post'}</span>
                  </div>
                  {parsed.phase && (
                    <span className="self-start text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 uppercase tracking-wider">{parsed.phase}</span>
                  )}
                  <div className="text-[15px] font-bold text-neutral-900 leading-tight">{parsed.title || 'Untitled'}</div>
                  <div className={`inline-block self-start text-[11px] font-bold px-2 py-1 rounded ${style.bg} ${style.text}`}>
                    {style.label}
                  </div>

                  {/* Caption */}
                  {it.caption && (
                    <div>
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))}
                        className="text-[12px] text-neutral-600 font-semibold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {expanded[it.id] ? 'expand_less' : 'expand_more'}
                        </span>
                        Caption
                      </button>
                      {expanded[it.id] && (
                        <div className="text-[12px] text-neutral-600 whitespace-pre-wrap leading-relaxed bg-neutral-50 rounded-lg p-3 border border-neutral-200 mt-2 max-h-48 overflow-y-auto">
                          {it.caption}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Drive link */}
                  {driveLink && (
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold inline-flex items-center gap-1 hover:underline"
                      style={{ color: gradientFrom }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                      Open in Google Drive
                    </a>
                  )}

                  {/* Existing comments */}
                  {it.client_comments && (
                    <div className="text-[12px] bg-rose-50 border border-rose-200 rounded-lg p-3">
                      <div className="text-[10px] uppercase font-bold text-rose-500 mb-1">Your comments</div>
                      <div className="text-rose-700 whitespace-pre-wrap">{it.client_comments}</div>
                    </div>
                  )}
                  {it.mna_comments && (
                    <div className="text-[12px] bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Agency note</div>
                      <div className="text-neutral-700 whitespace-pre-wrap">{it.mna_comments}</div>
                    </div>
                  )}

                  {/* Approve / Request changes */}
                  {status !== 'scheduled' && it.caption && (
                    <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2 mt-auto">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(it.id)}
                          disabled={status === 'approved'}
                          className="flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
                          style={{ background: '#10b981' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => requestChanges(it.id)}
                          className="flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold bg-rose-500 text-white"
                        >
                          Request changes
                        </button>
                      </div>
                      <textarea
                        value={commentDraft[it.id] || ''}
                        onChange={(e) => setCommentDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                        placeholder="Leave a comment (required if requesting changes)"
                        rows={2}
                        className="w-full text-[12px] rounded-lg border border-neutral-200 p-2 outline-none focus:border-neutral-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
