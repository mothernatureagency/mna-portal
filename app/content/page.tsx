'use client';
import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';

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
};

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

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export default function ContentPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [writingId, setWritingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('all');

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

  async function writeCopy(id: string) {
    setWritingId(id);
    try {
      const res = await fetch(`/api/content-calendar/${id}/write-copy`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
      setExpanded((e) => ({ ...e, [id]: true }));
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
  const shown = approvalFilter === 'all'
    ? platformFiltered
    : platformFiltered.filter((i) => (i.client_approval_status || 'pending_review') === approvalFilter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>grid_view</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Content Tracker</h1>
        </div>
        <p className="text-white/60 mt-1">
          {activeClient?.name || 'No client selected'} · {items.length} posts
        </p>
      </div>

      {activeClient?.id === 'prime-iv' && items.length === 0 && !loading && (
        <div className="glass-card p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm">Load Spring Reset 45 day plan</div>
            <div className="text-white/60 text-xs">Seeds 22 pre written posts in Prime IV Niceville's approved voice. Starts today, ready for client approval.</div>
          </div>
          <button
            onClick={async () => {
              const res = await fetch('/api/content-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clientName: activeClient.name,
                  playbookId: 'niceville-spring-reset',
                  startDate: new Date().toISOString().slice(0, 10),
                }),
              });
              const data = await res.json();
              if (!res.ok) { alert(data.error || 'Seed failed'); return; }
              // refresh list
              const listRes = await fetch(`/api/content-calendar?client=${encodeURIComponent(activeClient.name)}`);
              const listData = await listRes.json();
              setItems(listData.items || []);
            }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#1c3d6e,#3a7ab5)' }}
          >
            Load Spring Reset
          </button>
        </div>
      )}

      {items.length > 0 && items.some((i) => !i.caption) && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm">Bulk generate captions</div>
            <div className="text-white/60 text-xs">Uses the Social Media Manager agent to write 3 caption variants for every post missing copy.</div>
          </div>
          <button
            onClick={writeAll}
            disabled={!!writingId}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
          >
            {writingId ? 'Writing…' : 'Write all captions'}
          </button>
        </div>
      )}

      {/* Platform filters */}
      <div className="flex gap-2 flex-wrap">
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

      {loading && <div className="glass-card p-6 text-white/70">Loading…</div>}

      {!loading && shown.length === 0 && (
        <div className="glass-card p-8 text-center text-white/60">
          No content yet. Go to <strong className="text-white">Agents → Content Calendar</strong> and click "Load into Pinecrest" or ask the agent to build a plan.
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((it) => {
            const parsed = parseTitle(it.title);
            const approval = (it.client_approval_status || 'pending_review') as ApprovalStatus;
            const style = APPROVAL_STYLES[approval];
            return (
              <div key={it.id} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/60">{fmtDate(it.post_date)}</div>
                  {parsed.phase && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 uppercase tracking-wider">{parsed.phase}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.platform}</span>
                  {it.content_type && <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/80">{it.content_type}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>{style.label}</span>
                </div>
                <div className={`text-white font-bold text-base leading-tight ${style.strike ? 'line-through opacity-60' : ''}`}>{parsed.title || 'Untitled'}</div>
                {parsed.hook && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-0.5">Hook</div>
                    <div className="text-white/85 text-sm leading-snug">"{parsed.hook}"</div>
                  </div>
                )}
                {parsed.cta && (
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
                    </button>
                    {expanded[it.id] && (
                      <div className="text-white/85 text-xs whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
                        {it.caption}
                      </div>
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

                {/* Client approval controls — hidden once scheduled */}
                {approval !== 'scheduled' && it.caption && (
                  <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Client approval</div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => approve(it.id)}
                        disabled={approval === 'approved'}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/80 text-white disabled:opacity-40"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => requestChanges(it.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-500/70 text-white"
                      >
                        Request changes
                      </button>
                      {approval === 'approved' && (
                        <button
                          onClick={() => markScheduled(it.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-sky-500/70 text-white"
                        >
                          Mark scheduled
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

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-white/50">{it.assigned_role || ''}</span>
                  {!it.caption && (
                    <button
                      onClick={() => writeCopy(it.id)}
                      disabled={writingId === it.id}
                      className="rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                    >
                      {writingId === it.id ? 'Writing…' : 'Write copy'}
                    </button>
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
