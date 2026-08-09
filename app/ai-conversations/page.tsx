'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';

/**
 * AI Conversations — control center for the Revive/GHL AI response layer
 * and the Google Reviews AI module. Three tabs:
 *   Conversations → live feed + approval queue + human takeover controls
 *   Reviews       → Google review reply queue
 *   Locations     → per-location knowledge base & AI settings (multi-tenant)
 */

type Loc = {
  id: string;
  client_id: string | null;
  ghl_location_id: string;
  name: string;
  has_token: boolean;
  has_webhook_secret: boolean;
  business_phone: string | null;
  timezone: string | null;
  business_hours: string | null;
  address: string | null;
  website: string | null;
  booking_url: string | null;
  services: Array<{ name: string; description?: string; price?: string }>;
  pricing: string | null;
  offers: string | null;
  faqs: string | null;
  membership_info: string | null;
  approved_language: string | null;
  restricted_language: string | null;
  tone_instructions: string | null;
  restricted_claims: string | null;
  escalation_instructions: string | null;
  escalation_keywords: string | null;
  custom_prompt: string | null;
  auto_respond_enabled: boolean;
  confidence_threshold: number;
  response_delay_seconds: number;
  ai_paused: boolean;
  polling_enabled: boolean;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_auth_email: string | null;
  review_auto_enabled: boolean;
  review_auto_3_star: boolean;
};

type Msg = {
  id: string;
  ghl_location_id: string;
  location_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  inbound_body: string | null;
  suggested_response: string | null;
  final_response: string | null;
  confidence: number | null;
  intent: string | null;
  category: string | null;
  status: string;
  escalation_reason: string | null;
  detected_service: string | null;
  detected_offer: string | null;
  needs_human_review: boolean | null;
  human_takeover: boolean | null;
  contact_ai_paused: boolean | null;
  opted_out: boolean | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

type Review = {
  id: string;
  ghl_location_id: string;
  location_name: string | null;
  author_name: string | null;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  suggested_response: string | null;
  final_response: string | null;
  status: string;
  escalation_reason: string | null;
  confidence: number | null;
  error: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  auto_sent: 'bg-emerald-100 text-emerald-700',
  sent_manual: 'bg-emerald-100 text-emerald-700',
  awaiting_approval: 'bg-amber-100 text-amber-700',
  escalated: 'bg-red-100 text-red-700',
  human_takeover: 'bg-purple-100 text-purple-700',
  pending: 'bg-blue-100 text-blue-600',
  processing: 'bg-blue-100 text-blue-600',
  canceled: 'bg-gray-100 text-gray-500',
  skipped: 'bg-gray-100 text-gray-500',
  rejected: 'bg-gray-200 text-gray-600',
  failed: 'bg-red-100 text-red-700',
  auto_posted: 'bg-emerald-100 text-emerald-700',
  posted: 'bg-emerald-100 text-emerald-700',
};

function StatusBadge({ s }: { s: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[s] || 'bg-gray-100 text-gray-500'}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

function Conf({ v }: { v: number | null }) {
  if (v == null) return <span className="text-gray-300">—</span>;
  const n = Number(v);
  const color = n >= 0.8 ? 'text-emerald-600' : n >= 0.6 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-semibold ${color}`}>{Math.round(n * 100)}%</span>;
}

function fmtTime(ts: string | null) {
  if (!ts) return '—';
  const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AiConversationsPage() {
  const [tab, setTab] = useState<'conversations' | 'reviews' | 'locations'>('conversations');
  const [locations, setLocations] = useState<Loc[]>([]);
  const [toast, setToast] = useState('');

  const notify = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500); };

  const loadLocations = useCallback(async () => {
    try {
      const d = await fetch('/api/ai-crm/locations').then((r) => r.json());
      setLocations(d.locations || []);
    } catch {}
  }, []);
  useEffect(() => { loadLocations(); }, [loadLocations]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">AI Conversations</h1>
          <p className="text-sm text-gray-400 mt-0.5">Revive / GoHighLevel AI response layer — auto-replies, approvals, and escalations</p>
        </div>
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {(['conversations', 'reviews', 'locations'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">{toast}</div>}

      {tab === 'conversations' && <ConversationsTab locations={locations} notify={notify} />}
      {tab === 'reviews' && <ReviewsTab locations={locations} notify={notify} />}
      {tab === 'locations' && <LocationsTab locations={locations} reload={loadLocations} notify={notify} />}
    </div>
  );
}

// ── Conversations ─────────────────────────────────────────────────────────

function ConversationsTab({ locations, notify }: { locations: Loc[]; notify: (t: string) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ location: '', status: '', category: '', minConfidence: '', from: '', to: '', q: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    try {
      const d = await fetch(`/api/ai-crm/messages?${qs.toString()}`).then((r) => r.json());
      setMessages(d.messages || []);
      const c: Record<string, number> = {};
      (d.counts || []).forEach((row: any) => { c[row.status] = row.n; });
      setCounts(c);
    } catch {}
    setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function open(m: Msg) {
    setSelected(m);
    setEditText(m.final_response || m.suggested_response || '');
    setDetail(null);
    try {
      const d = await fetch(`/api/ai-crm/messages?id=${m.id}`).then((r) => r.json());
      setDetail(d);
    } catch {}
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai-crm/messages/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      notify(action === 'approve' ? 'Sent ✓' : action === 'reject' ? 'Rejected' : 'Done ✓');
      setSelected(null);
      load();
    } catch (e: any) { notify(e.message); }
    setBusy(false);
  }

  async function takeover(action: string) {
    if (!selected?.contact_id) return;
    setBusy(true);
    try {
      await fetch('/api/ai-crm/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghlLocationId: selected.ghl_location_id, contactId: selected.contact_id, action }),
      });
      notify(action === 'takeover' ? 'Conversation is now human-managed' : action === 'release' ? 'AI resumed' : 'Updated');
      load();
    } catch {}
    setBusy(false);
  }

  const needsAttention = (counts.awaiting_approval || 0) + (counts.escalated || 0);

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          ['awaiting_approval', 'Awaiting approval'],
          ['escalated', 'Escalated'],
          ['auto_sent', 'Auto-sent'],
          ['human_takeover', 'Human takeover'],
          ['failed', 'Failed'],
        ].map(([s, label]) => (
          <button key={s} onClick={() => setF((p) => ({ ...p, status: p.status === s ? '' : s }))}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${f.status === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {label} · {counts[s] || 0}
          </button>
        ))}
        {needsAttention > 0 && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            {needsAttention} need{needsAttention === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select value={f.location} onChange={(e) => setF((p) => ({ ...p, location: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.ghl_location_id} value={l.ghl_location_id}>{l.name}</option>)}
          </select>
          <select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">All categories</option>
            {['booking', 'pricing', 'hours', 'services', 'offers', 'membership', 'support', 'complaint', 'medical', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={f.minConfidence} onChange={(e) => setF((p) => ({ ...p, minConfidence: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="">Any confidence</option>
            <option value="0.9">≥ 90%</option>
            <option value="0.75">≥ 75%</option>
            <option value="0.5">≥ 50%</option>
          </select>
          <input type="date" value={f.from} onChange={(e) => setF((p) => ({ ...p, from: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white" />
          <input type="date" value={f.to} onChange={(e) => setF((p) => ({ ...p, to: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white" />
          <input placeholder="Search name / phone…" value={f.q} onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white flex-1 min-w-[160px]" />
          <button onClick={load} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-2">↻</button>
        </div>
      </Card>

      {/* Feed */}
      <Card className="overflow-hidden">
        {loading && messages.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            No AI conversations yet. Connect a location in the Locations tab, then point its Revive webhook at this portal.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((m) => (
              <button key={m.id} onClick={() => open(m)} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{m.contact_name || m.contact_phone || 'Unknown contact'}</span>
                    <span className="text-xs text-gray-400">{m.location_name || m.ghl_location_id}</span>
                    <StatusBadge s={m.status} />
                    {m.human_takeover && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">👤 human-managed</span>}
                    {m.opted_out && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">opted out</span>}
                    {m.category && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{m.category}</span>}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate">💬 {m.inbound_body || '(no text)'}</div>
                  {(m.final_response || m.suggested_response) && (
                    <div className="text-sm text-gray-400 mt-0.5 truncate">🤖 {m.final_response || m.suggested_response}</div>
                  )}
                  {m.escalation_reason && <div className="text-xs text-red-500 mt-0.5">⚠ {m.escalation_reason}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs"><Conf v={m.confidence} /></div>
                  <div className="text-[11px] text-gray-400 mt-1">{fmtTime(m.sent_at || m.created_at)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-lg text-gray-900">{selected.contact_name || selected.contact_phone || 'Unknown contact'}</div>
                <div className="text-sm text-gray-400">{selected.contact_phone} · {selected.location_name || selected.ghl_location_id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge s={selected.status} />
              <span className="text-xs text-gray-500">Confidence: <Conf v={selected.confidence} /></span>
              {selected.intent && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">intent: {selected.intent}</span>}
              {selected.detected_service && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{selected.detected_service}</span>}
              {selected.detected_offer && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{selected.detected_offer}</span>}
            </div>
            {selected.escalation_reason && (
              <div className="text-sm bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2">⚠ {selected.escalation_reason}</div>
            )}
            {selected.error && (
              <div className="text-sm bg-amber-50 border border-amber-100 text-amber-700 rounded-xl px-3 py-2">{selected.error}</div>
            )}

            {/* Thread */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Conversation history</div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(detail?.thread || [selected]).map((t: any) => (
                  <div key={t.id} className="space-y-1.5">
                    {t.inbound_body && (
                      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-800 max-w-[85%]">{t.inbound_body}
                        <div className="text-[10px] text-gray-400 mt-0.5">{fmtTime(t.created_at)}</div>
                      </div>
                    )}
                    {(t.final_response || t.suggested_response) && (
                      <div className={`rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[85%] ml-auto ${['auto_sent', 'sent_manual'].includes(t.status) ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 border border-dashed border-blue-200'}`}>
                        {t.final_response || t.suggested_response}
                        <div className={`text-[10px] mt-0.5 ${['auto_sent', 'sent_manual'].includes(t.status) ? 'text-blue-200' : 'text-blue-400'}`}>
                          {['auto_sent', 'sent_manual'].includes(t.status) ? `sent ${fmtTime(t.sent_at)}` : `${t.status.replace(/_/g, ' ')} — not sent`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Response editor + actions */}
            {!['auto_sent', 'sent_manual'].includes(selected.status) && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Response</div>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Reply to the customer…" />
                <div className="flex gap-2 flex-wrap">
                  <button disabled={busy || !editText.trim()} onClick={() => act('approve', { text: editText.trim() })}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
                    Approve & Send
                  </button>
                  <button disabled={busy} onClick={() => act('reject')}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-40">
                    Reject
                  </button>
                  {selected.status === 'failed' && (
                    <button disabled={busy} onClick={() => act('retry')}
                      className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold disabled:opacity-40">
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Takeover controls */}
            {selected.contact_id && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">AI control for this contact</div>
                <div className="flex gap-2 flex-wrap">
                  {selected.human_takeover || selected.contact_ai_paused ? (
                    <button disabled={busy} onClick={() => takeover('release')}
                      className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">Resume AI</button>
                  ) : (
                    <>
                      <button disabled={busy} onClick={() => takeover('takeover')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold">Mark human-managed</button>
                      <button disabled={busy} onClick={() => takeover('pause')}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">Pause AI for contact</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Decision / audit trail */}
            {detail?.audit && detail.audit.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">AI decision log</div>
                <div className="space-y-1.5">
                  {detail.audit.map((a: any, i: number) => (
                    <div key={i} className="text-xs text-gray-500 flex gap-2">
                      <span className="text-gray-300 shrink-0">{fmtTime(a.created_at)}</span>
                      <span className="font-semibold text-gray-600">{a.event.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400">{a.actor !== 'system' ? `by ${a.actor}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────

function ReviewsTab({ locations, notify }: { locations: Loc[]; notify: (t: string) => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('awaiting_approval');
  const [location, setLocation] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (location) qs.set('location', location);
    try {
      const d = await fetch(`/api/ai-crm/reviews?${qs.toString()}`).then((r) => r.json());
      setReviews(d.reviews || []);
    } catch {}
    setLoading(false);
  }, [status, location]);
  useEffect(() => { load(); }, [load]);

  async function act(r: Review, action: 'approve' | 'reject') {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/ai-crm/reviews/${r.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text: edits[r.id] ?? r.suggested_response }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      notify(action === 'approve' ? 'Reply posted ✓' : 'Rejected');
      load();
    } catch (e: any) { notify(e.message); }
    setBusy(null);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch('/api/ai-crm/reviews/sync', { method: 'POST' });
      notify('Sync complete');
      load();
    } catch { notify('Sync failed'); }
    setSyncing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">All statuses</option>
          {['awaiting_approval', 'auto_posted', 'posted', 'pending', 'rejected', 'failed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.ghl_location_id} value={l.ghl_location_id}>{l.name}</option>)}
        </select>
        <button onClick={syncNow} disabled={syncing}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50">
          {syncing ? 'Syncing…' : 'Sync reviews now'}
        </button>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-gray-400 text-sm">Loading…</Card>
      ) : reviews.length === 0 ? (
        <Card className="p-10 text-center text-gray-400 text-sm">
          No reviews here. Map a Google Business Profile to a location (Locations tab → GBP account & location IDs), then sync.
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{r.author_name || 'Anonymous'}</span>
                    <span className="text-amber-500 text-sm">{'★'.repeat(r.rating || 0)}<span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - (r.rating || 0)))}</span></span>
                    <span className="text-xs text-gray-400">{r.location_name || r.ghl_location_id} · {fmtTime(r.review_date)}</span>
                  </div>
                  {r.escalation_reason && <div className="text-xs text-red-500 mt-0.5">⚠ {r.escalation_reason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge s={r.status} />
                  {r.confidence != null && <span className="text-xs"><Conf v={r.confidence} /></span>}
                </div>
              </div>
              {r.review_text && <div className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{r.review_text}</div>}
              {r.status === 'awaiting_approval' ? (
                <div className="space-y-2">
                  <textarea rows={3} value={edits[r.id] ?? r.suggested_response ?? ''}
                    onChange={(e) => setEdits((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button disabled={busy === r.id} onClick={() => act(r, 'approve')}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">Post reply</button>
                    <button disabled={busy === r.id} onClick={() => act(r, 'reject')}
                      className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-40">Reject</button>
                  </div>
                </div>
              ) : (r.final_response || r.suggested_response) ? (
                <div className="text-sm text-gray-500 border-l-2 border-emerald-200 pl-3">↳ {r.final_response || r.suggested_response}</div>
              ) : null}
              {r.error && <div className="text-xs text-red-500">{r.error}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Locations (knowledge base + settings) ─────────────────────────────────

const EMPTY_LOC: Partial<Loc> & { token?: string } = {
  name: '', ghl_location_id: '', client_id: '', business_phone: '', timezone: 'America/Chicago',
  business_hours: '', address: '', website: '', booking_url: '', services: [], pricing: '',
  offers: '', faqs: '', membership_info: '', approved_language: '', restricted_language: '',
  tone_instructions: '', restricted_claims: '', escalation_instructions: '', escalation_keywords: '',
  custom_prompt: '', auto_respond_enabled: false, confidence_threshold: 0.75,
  response_delay_seconds: 60, ai_paused: false, polling_enabled: false,
  gbp_account_id: '', gbp_location_id: '', gbp_auth_email: '', review_auto_enabled: false, review_auto_3_star: false,
};

function LocationsTab({ locations, reload, notify }: { locations: Loc[]; reload: () => void; notify: (t: string) => void }) {
  const [editing, setEditing] = useState<(Partial<Loc> & { id?: string; token?: string; webhook_secret?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [servicesText, setServicesText] = useState('');

  function startEdit(loc?: Loc) {
    const base = loc ? { ...loc, token: '' } : { ...EMPTY_LOC };
    setEditing(base);
    setServicesText((loc?.services || []).map((s) => [s.name, s.price, s.description].filter(Boolean).join(' | ')).join('\n'));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const services = servicesText.split('\n').map((line) => {
        const [name, price, description] = line.split('|').map((s) => s?.trim());
        return name ? { name, price: price || undefined, description: description || undefined } : null;
      }).filter(Boolean);
      const payload: any = { ...editing, services };
      if (!payload.token) delete payload.token;
      const res = await fetch('/api/ai-crm/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      notify('Location saved ✓');
      setEditing(null);
      reload();
    } catch (e: any) { notify(e.message); }
    setSaving(false);
  }

  const set = (k: string, v: unknown) => setEditing((p) => (p ? { ...p, [k]: v } : p));

  const Field = ({ label, k, type = 'text', placeholder, rows }: { label: string; k: string; type?: string; placeholder?: string; rows?: number }) => (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      {rows ? (
        <textarea rows={rows} value={(editing as any)?.[k] ?? ''} placeholder={placeholder}
          onChange={(e) => set(k, e.target.value)}
          className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
      ) : (
        <input type={type} value={(editing as any)?.[k] ?? ''} placeholder={placeholder}
          onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
          className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
      )}
    </label>
  );

  const Toggle = ({ label, k, hint }: { label: string; k: string; hint?: string }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!(editing as any)?.[k]} onChange={(e) => set(k, e.target.checked)} className="w-4 h-4" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );

  if (editing) {
    const webhookUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/api/ai-crm/webhook?key=<webhook secret>`
      : '/api/ai-crm/webhook?key=<webhook secret>';
    return (
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">{editing.id ? `Edit — ${editing.name}` : 'Connect a location'}</h2>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Business name *" k="name" />
          <Field label="Revive / GHL Location ID *" k="ghl_location_id" placeholder="e.g. ve9EPM428h8vShlRW1KT" />
          <Field label="Portal client ID (optional)" k="client_id" placeholder="e.g. prime-iv" />
          <Field label="Business phone" k="business_phone" />
          <Field label="Timezone" k="timezone" placeholder="America/Chicago" />
          <Field label="Address" k="address" />
          <Field label="Website" k="website" />
          <Field label="Booking URL" k="booking_url" />
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">API credentials (stored encrypted, server-side only)</div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Private Integration token {editing.id && (locations.find((l) => l.id === editing.id)?.has_token ? '(saved — enter to replace)' : '(not set)')}</span>
              <input type="password" value={editing.token ?? ''} autoComplete="new-password"
                onChange={(e) => set('token', e.target.value)} placeholder="pit-…"
                className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
            </label>
            <Field label="Webhook secret (for the webhook URL)" k="webhook_secret" placeholder="any random string" />
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            In Revive, add a workflow: <b>Customer Replied → Webhook</b> → <code className="bg-white px-1 rounded">{webhookUrl}</code> (include locationId, contactId, conversationId, messageId, body, direction). No webhook access on your plan? Enable polling below instead.
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Knowledge base (the only facts the AI may use)</div>
          <Field label="Business hours" k="business_hours" rows={2} placeholder="Mon–Fri 9am–7pm, Sat 10am–4pm, closed Sun" />
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Services — one per line: Name | Price | Description</span>
            <textarea rows={4} value={servicesText} onChange={(e) => setServicesText(e.target.value)}
              placeholder={'Myers Cocktail | $189 | Classic vitamin & mineral IV\nB12 Shot | $35 |'}
              className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono" />
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Pricing notes" k="pricing" rows={2} />
            <Field label="Current offers / promotions" k="offers" rows={2} />
            <Field label="Membership info" k="membership_info" rows={2} />
            <Field label="FAQs" k="faqs" rows={4} placeholder={'Q: Do you take walk-ins?\nA: Yes, but booking is faster…'} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Voice & guardrails</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Tone instructions" k="tone_instructions" rows={2} placeholder="Warm, upbeat, texts like a friendly front-desk person" />
            <Field label="Approved language / phrases" k="approved_language" rows={2} />
            <Field label="Restricted language (never use)" k="restricted_language" rows={2} placeholder="cure, guaranteed results, medical-grade…" />
            <Field label="Restricted claims (never state)" k="restricted_claims" rows={2} />
            <Field label="Escalation keywords (comma separated)" k="escalation_keywords" rows={2} placeholder="manager, corporate, allergic" />
            <Field label="Escalation instructions" k="escalation_instructions" rows={2} />
          </div>
          <Field label="Custom system prompt additions" k="custom_prompt" rows={3} />
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">AI behavior</div>
          <div className="flex gap-6 flex-wrap items-end">
            <Toggle label="Auto-respond enabled" k="auto_respond_enabled" hint="off = every reply needs approval" />
            <Toggle label="AI paused (whole location)" k="ai_paused" />
            <Toggle label="Polling fallback" k="polling_enabled" hint="if webhooks aren't available" />
            <label className="block w-36">
              <span className="text-xs font-semibold text-gray-500">Confidence threshold</span>
              <input type="number" min={0} max={1} step={0.05} value={editing.confidence_threshold ?? 0.75}
                onChange={(e) => set('confidence_threshold', Number(e.target.value))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
            </label>
            <label className="block w-36">
              <span className="text-xs font-semibold text-gray-500">Response delay (sec)</span>
              <input type="number" min={0} max={600} value={editing.response_delay_seconds ?? 60}
                onChange={(e) => set('response_delay_seconds', Number(e.target.value))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Google Reviews AI (optional)</div>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="GBP account ID" k="gbp_account_id" placeholder="123456789" />
            <Field label="GBP location ID" k="gbp_location_id" placeholder="987654321" />
            <Field label="Google account email (OAuth)" k="gbp_auth_email" placeholder="mn@mothernatureagency.com" />
          </div>
          <div className="flex gap-6 flex-wrap">
            <Toggle label="Auto-post 4–5★ replies" k="review_auto_enabled" />
            <Toggle label="Also auto-post 3★" k="review_auto_3_star" />
          </div>
          <div className="text-xs text-gray-400">1–2★ and flagged reviews (medical, legal, privacy, billing, discrimination) always require approval.</div>
        </div>

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !editing.name || !editing.ghl_location_id}
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
            {saving ? 'Saving…' : 'Save location'}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => startEdit()} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">
        + Connect location
      </button>
      {locations.length === 0 ? (
        <Card className="p-10 text-center text-gray-400 text-sm">
          No locations connected yet. Each Revive/GHL subaccount gets its own token, knowledge base, and AI rules — data never crosses locations.
        </Card>
      ) : (
        locations.map((l) => (
          <Card key={l.id} className="p-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold text-gray-900">{l.name}</div>
              <div className="text-xs text-gray-400">{l.ghl_location_id}{l.business_phone ? ` · ${l.business_phone}` : ''}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
              <span className={`px-2 py-0.5 rounded-full ${l.has_token ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{l.has_token ? 'token ✓' : 'no token'}</span>
              <span className={`px-2 py-0.5 rounded-full ${l.ai_paused ? 'bg-gray-200 text-gray-600' : l.auto_respond_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {l.ai_paused ? 'AI paused' : l.auto_respond_enabled ? 'auto-respond on' : 'approval-only'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">threshold {Math.round(Number(l.confidence_threshold) * 100)}%</span>
              {l.gbp_location_id && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">reviews ✓</span>}
              {l.polling_enabled && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">polling</span>}
            </div>
            <button onClick={() => startEdit(l)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Edit</button>
          </Card>
        ))
      )}
    </div>
  );
}
