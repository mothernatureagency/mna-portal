'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

type SpecialStatus = 'drafting' | 'pending_review' | 'approved' | 'denied' | 'changes_requested';

type Special = {
  id: string;
  client_id: string;
  month: string;
  name: string;
  offer: string | null;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  terms: string | null;
  sort_order: number;
  status: SpecialStatus;
  client_visible: boolean;
  client_comments: string | null;
  mna_comments: string | null;
  approved_at: string | null;
};

// Draft rows from an import, before they're saved.
type DraftSpecial = {
  name: string;
  offer: string | null;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  terms: string | null;
};

const VIEW_ONLY_ROLES = ['client', 'contractor', 'student', 'creator'];

const STATUS_STYLES: Record<SpecialStatus, { label: string; bg: string; text: string }> = {
  drafting:          { label: 'Drafting',          bg: 'bg-white/5',        text: 'text-white/55 italic' },
  pending_review:    { label: 'With client',       bg: 'bg-amber-400/15',   text: 'text-amber-200' },
  approved:          { label: 'Approved',          bg: 'bg-emerald-400/20', text: 'text-emerald-200' },
  denied:            { label: 'Denied',            bg: 'bg-red-500/20',     text: 'text-red-300' },
  changes_requested: { label: 'Changes requested', bg: 'bg-rose-400/20',    text: 'text-rose-200' },
};

function monthLabel(month: string) {
  try {
    return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch { return month; }
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtRange(s: Special | DraftSpecial) {
  if (!s.starts_on && !s.ends_on) return null;
  const f = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (s.starts_on && s.ends_on) return `${f(s.starts_on)} – ${f(s.ends_on)}`;
  return s.starts_on ? `from ${f(s.starts_on)}` : `until ${f(s.ends_on!)}`;
}

const BLANK: DraftSpecial = { name: '', offer: null, description: null, starts_on: null, ends_on: null, terms: null };

export default function SpecialsPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const { gradientFrom, gradientTo } = activeClient?.branding || { gradientFrom: '#0c6da4', gradientTo: '#4ab8ce' };

  const [isStaff, setIsStaff] = useState(false);
  const [items, setItems] = useState<Special[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    // Specials get planned ahead, so default to next month.
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Import + manual add
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [drafts, setDrafts] = useState<DraftSpecial[] | null>(null);
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<DraftSpecial>(BLANK);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
      setIsStaff(!!user && !VIEW_ONLY_ROLES.includes(role));
    });
  }, []);

  const load = useCallback(async () => {
    if (!activeClient?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/specials?clientId=${encodeURIComponent(activeClient.id)}&month=${month}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch { setItems([]); }
    setLoading(false);
  }, [activeClient?.id, month]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: items.length };
    for (const i of items) c[i.status] = (c[i.status] || 0) + 1;
    return c;
  }, [items]);

  const unpushed = items.filter((i) => !i.client_visible).length;
  const approved = items.filter((i) => i.status === 'approved');

  async function runImport(input: { file?: File; driveUrl?: string }) {
    setImporting(true);
    setImportError(null);
    try {
      const url = `/api/specials/import?month=${month}`;
      const res = input.file
        ? await fetch(url, { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', input.file!); return fd; })() })
        : await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driveUrl: input.driveUrl }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setDrafts(data.items);
      setDraftSource(data.source || null);
      setDriveUrl('');
    } catch (e: any) {
      setImportError(e.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveDrafts() {
    if (!drafts || drafts.length === 0 || !activeClient?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: activeClient.id, month, items: drafts.filter((d) => d.name.trim()) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setDrafts(null);
      setDraftSource(null);
      await load();
    } catch (e: any) {
      setImportError(e.message || 'Could not save');
    } finally { setSaving(false); }
  }

  async function patchSpecial(id: string, patch: Record<string, unknown>) {
    const res = await fetch('/api/specials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Update failed'); return; }
    setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
  }

  async function pushMonth() {
    if (!activeClient?.id || unpushed === 0) return;
    if (!confirm(`Send ${unpushed} special${unpushed === 1 ? '' : 's'} to ${activeClient.name} for approval? They'll get an email.`)) return;
    setPushing(true);
    try {
      const res = await fetch('/api/specials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushMonth: true, clientId: activeClient.id, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Push failed');
      await load();
      alert(`Sent ${data.pushed} special${data.pushed === 1 ? '' : 's'} to ${activeClient.name}.`);
    } catch (e: any) {
      alert(e.message || 'Push failed');
    } finally { setPushing(false); }
  }

  async function removeSpecial(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    await fetch(`/api/specials?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function startEdit(s: Special) {
    setEditingId(s.id);
    setEdit({ name: s.name, offer: s.offer, description: s.description, starts_on: s.starts_on, ends_on: s.ends_on, terms: s.terms });
  }

  async function saveEdit() {
    if (!editingId) return;
    await patchSpecial(editingId, { ...edit, name: edit.name.trim() || 'Untitled' });
    setEditingId(null);
  }

  // Hand the approved specials to the month planner as the text it expects.
  function approvedAsText(): string {
    return approved.map((s) => {
      const bits = [s.name, s.offer].filter(Boolean).join(' — ');
      const range = fmtRange(s);
      return [bits, range ? `(${range})` : '', s.terms ? `· ${s.terms}` : '', s.description ? `· ${s.description}` : '']
        .filter(Boolean).join(' ');
    }).join('\n');
  }

  function planContent() {
    // The planner reads this on mount and clears it, so the handoff survives
    // the navigation without a query string full of copy.
    try {
      sessionStorage.setItem('mna:plan-specials', JSON.stringify({ month, specials: approvedAsText(), clientId: activeClient?.id }));
    } catch {}
    window.location.href = '/content';
  }

  if (!activeClient) return <div className="p-8 text-white/60">Loading…</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 30, color: gradientTo }}>local_offer</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Monthly Specials</h1>
          </div>
          <p className="text-white/60 mt-1">
            {activeClient.name} · plan the month&apos;s offers, get them approved, then build content around them
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm min-w-[150px] text-center">
            {monthLabel(month)}
          </div>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Status strip */}
      {items.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(['drafting', 'pending_review', 'approved', 'changes_requested', 'denied'] as SpecialStatus[]).map((s) => {
            const n = counts[s] || 0;
            if (!n) return null;
            const st = STATUS_STYLES[s];
            return (
              <span key={s} className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${st.bg} ${st.text}`}>
                {n} {st.label.toLowerCase()}
              </span>
            );
          })}
        </div>
      )}

      {/* Import / add */}
      {isStaff && (
        <div className="glass-card p-4 space-y-3">
          <div className="text-white font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: gradientTo }}>note_add</span>
            Add {monthLabel(month)}&apos;s specials
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) runImport({ file: f }); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
              Import from flyer or sheet
            </button>
            <span className="text-white/25 text-[12px]">or</span>
            <input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && driveUrl.trim() && !importing) { e.preventDefault(); runImport({ driveUrl: driveUrl.trim() }); } }}
              disabled={importing}
              placeholder="paste a Google Drive link…"
              className="flex-1 min-w-[220px] text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25 disabled:opacity-40"
            />
            <button
              onClick={() => runImport({ driveUrl: driveUrl.trim() })}
              disabled={importing || !driveUrl.trim()}
              className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 disabled:opacity-40"
            >
              Read
            </button>
            <button
              onClick={() => setDrafts((d) => [...(d || []), { ...BLANK }])}
              className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Add by hand
            </button>
            {importing && (
              <span className="text-[12px] text-cyan-300 inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                Reading…
              </span>
            )}
          </div>
          {importError && (
            <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">{importError}</div>
          )}
        </div>
      )}

      {/* Draft review — nothing reaches the client until these are saved */}
      {isStaff && drafts && (
        <div className="glass-card p-4 space-y-3" style={{ borderLeft: `3px solid ${gradientTo}` }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-white font-semibold text-sm">
                {drafts.length} special{drafts.length === 1 ? '' : 's'} ready to add
                {draftSource && <span className="text-white/45 font-normal"> · from {draftSource}</span>}
              </div>
              <div className="text-white/50 text-[12px]">Check the prices and dates before saving — this is read off the file, not typed by a person.</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveDrafts}
                disabled={saving || drafts.every((d) => !d.name.trim())}
                className="text-[12px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                {saving ? 'Saving…' : `Save ${drafts.filter((d) => d.name.trim()).length} to ${monthLabel(month)}`}
              </button>
              <button onClick={() => { setDrafts(null); setDraftSource(null); }} className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/60 border border-white/10">
                Discard
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="rounded-xl bg-white/[0.04] border border-white/10 p-3 grid gap-2 md:grid-cols-2">
                <input
                  value={d.name}
                  onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Special name"
                  className="text-[13px] font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25"
                />
                <input
                  value={d.offer || ''}
                  onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, offer: e.target.value || null } : x)))}
                  placeholder="Offer — $50 off, 20% off, buy 2 get 1"
                  className="text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25"
                />
                <div className="flex gap-2">
                  <input type="date" value={d.starts_on || ''} onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, starts_on: e.target.value || null } : x)))}
                    className="flex-1 text-[12px] px-2 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                  <input type="date" value={d.ends_on || ''} onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, ends_on: e.target.value || null } : x)))}
                    className="flex-1 text-[12px] px-2 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                </div>
                <input
                  value={d.terms || ''}
                  onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, terms: e.target.value || null } : x)))}
                  placeholder="Terms — members only, first-time guests…"
                  className="text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25"
                />
                <textarea
                  value={d.description || ''}
                  onChange={(e) => setDrafts((prev) => prev!.map((x, j) => (j === i ? { ...x, description: e.target.value || null } : x)))}
                  placeholder="What it includes (optional)"
                  rows={2}
                  className="md:col-span-2 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25"
                />
                <button
                  onClick={() => setDrafts((prev) => prev!.filter((_, j) => j !== i))}
                  className="md:col-span-2 justify-self-start text-[11px] font-semibold text-white/40 hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send to client / plan content */}
      {isStaff && items.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white font-semibold text-sm">
              {unpushed > 0
                ? `${unpushed} special${unpushed === 1 ? '' : 's'} not sent to ${activeClient.name} yet`
                : `${activeClient.name} has all ${items.length} — ${approved.length} approved`}
            </div>
            <div className="text-white/55 text-xs">
              {approved.length > 0
                ? 'Approved specials can go straight into the month planner as the brief.'
                : 'Once they approve, you can plan the month’s content off what survived.'}
            </div>
          </div>
          <div className="flex gap-2">
            {unpushed > 0 && (
              <button
                onClick={pushMonth}
                disabled={pushing}
                className="text-[12px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-1.5"
                style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                {pushing ? 'Sending…' : `Send ${unpushed} for approval`}
              </button>
            )}
            {approved.length > 0 && (
              <button
                onClick={planContent}
                className="text-[12px] font-bold px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_calendar</span>
                Plan content from {approved.length} approved
              </button>
            )}
          </div>
        </div>
      )}

      {/* The month */}
      {loading && <div className="text-white/50 text-sm">Loading…</div>}
      {!loading && items.length === 0 && !drafts && (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined text-white/20" style={{ fontSize: 42 }}>local_offer</span>
          <div className="text-white/70 font-semibold mt-2">No specials for {monthLabel(month)} yet</div>
          <div className="text-white/40 text-[13px] mt-1">
            {isStaff ? 'Import the owner’s flyer above, or add them by hand.' : 'Nothing here yet.'}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => {
          const st = STATUS_STYLES[s.status] || STATUS_STYLES.drafting;
          const range = fmtRange(s);
          const isEditing = editingId === s.id;
          return (
            <div key={s.id} className="glass-card p-4 flex flex-col gap-2.5">
              {isEditing ? (
                <div className="grid gap-2">
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    className="text-[14px] font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                  <input value={edit.offer || ''} onChange={(e) => setEdit({ ...edit, offer: e.target.value || null })} placeholder="Offer"
                    className="text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <input type="date" value={edit.starts_on || ''} onChange={(e) => setEdit({ ...edit, starts_on: e.target.value || null })}
                      className="flex-1 text-[12px] px-2 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                    <input type="date" value={edit.ends_on || ''} onChange={(e) => setEdit({ ...edit, ends_on: e.target.value || null })}
                      className="flex-1 text-[12px] px-2 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none" />
                  </div>
                  <input value={edit.terms || ''} onChange={(e) => setEdit({ ...edit, terms: e.target.value || null })} placeholder="Terms"
                    className="text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25" />
                  <textarea value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value || null })} rows={2} placeholder="Details"
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}>Save</button>
                    <button onClick={() => setEditingId(null)} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/60 border border-white/10">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white font-bold text-[15px] leading-tight">{s.name}</div>
                      {s.offer && <div className="text-[13px] font-semibold mt-0.5" style={{ color: gradientTo }}>{s.offer}</div>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded ${st.bg} ${st.text}`}>{st.label}</span>
                  </div>

                  {(range || s.terms) && (
                    <div className="flex gap-2 flex-wrap text-[11px] text-white/50">
                      {range && <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>calendar_month</span>{range}</span>}
                      {s.terms && <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>{s.terms}</span>}
                    </div>
                  )}
                  {s.description && <div className="text-[12px] text-white/60 leading-relaxed">{s.description}</div>}

                  {s.client_comments && (
                    <div className="text-[12px] bg-rose-500/10 border border-rose-500/25 rounded-lg p-2.5">
                      <div className="text-[10px] uppercase font-bold text-rose-300/80 mb-0.5">{activeClient.shortName || 'Client'} said</div>
                      <div className="text-rose-200 whitespace-pre-wrap">{s.client_comments}</div>
                    </div>
                  )}

                  {isStaff && (
                    <div className="flex items-center gap-2 flex-wrap pt-1 mt-auto border-t border-white/5">
                      <button onClick={() => startEdit(s)} className="text-[11px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1 pt-2">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span> Edit
                      </button>
                      {!s.client_visible && (
                        <button onClick={() => patchSpecial(s.id, { client_visible: true, status: 'pending_review' })} className="text-[11px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1 pt-2">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span> Send
                        </button>
                      )}
                      {s.status === 'changes_requested' && (
                        <button onClick={() => patchSpecial(s.id, { status: 'pending_review', client_comments: null })} className="text-[11px] font-semibold text-amber-300/80 hover:text-amber-200 inline-flex items-center gap-1 pt-2">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span> Re-submit
                        </button>
                      )}
                      <button onClick={() => removeSpecial(s.id, s.name)} className="text-[11px] font-semibold text-white/30 hover:text-rose-300 ml-auto pt-2">
                        Delete
                      </button>
                    </div>
                  )}

                  {isStaff && (
                    <input
                      value={noteDraft[s.id] ?? s.mna_comments ?? ''}
                      onChange={(e) => setNoteDraft((p) => ({ ...p, [s.id]: e.target.value }))}
                      onBlur={() => {
                        const v = noteDraft[s.id];
                        if (v !== undefined && v !== (s.mna_comments || '')) patchSpecial(s.id, { mna_comments: v || null });
                      }}
                      placeholder="Note for the client (shown with this special)…"
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white/70 outline-none placeholder:text-white/20"
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
