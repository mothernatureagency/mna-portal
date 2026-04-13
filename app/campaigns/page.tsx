'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';

type CampaignStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'sent' | 'failed';

type Campaign = {
  id: string;
  client_id: string;
  campaign_type: 'email' | 'sms';
  name: string;
  subject: string | null;
  body: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  audience_segment: string | null;
  audience_count: number | null;
  status: CampaignStatus;
  client_visible: boolean;
  client_comments: string | null;
  mna_comments: string | null;
  approved_at: string | null;
  sent_at: string | null;
  revive_campaign_id: string | null;
  created_at: string;
  // Joined metrics
  recipients: number | null;
  delivered: number | null;
  bounced: number | null;
  opened: number | null;
  clicked: number | null;
  unsubscribed: number | null;
  open_rate: number | null;
  click_rate: number | null;
};

const MNA_EMAILS = [
  'mn@mothernatureagency.com',
  'admin@mothernatureagency.com',
  'info@mothernatureagency.com',
];

const STATUS_STYLES: Record<CampaignStatus, { label: string; bg: string; text: string }> = {
  drafting:          { label: 'Drafting',          bg: 'bg-white/5',        text: 'text-white/60 italic' },
  pending_review:    { label: 'Ready for review',  bg: 'bg-amber-400/15',   text: 'text-amber-200' },
  approved:          { label: 'Approved',          bg: 'bg-emerald-400/20', text: 'text-emerald-200' },
  changes_requested: { label: 'Changes requested', bg: 'bg-rose-400/20',    text: 'text-rose-200' },
  sent:              { label: 'Sent',              bg: 'bg-sky-400/20',     text: 'text-sky-200' },
  failed:            { label: 'Failed',            bg: 'bg-red-500/20',     text: 'text-red-300' },
};

const TYPE_STYLES = {
  email: { label: 'Email', icon: 'mail', color: 'bg-violet-500/20 text-violet-300' },
  sms:   { label: 'SMS',   icon: 'sms',  color: 'bg-emerald-500/20 text-emerald-300' },
};

function fmtDate(iso: string) {
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export default function CampaignsPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const { gradientFrom, gradientTo } = activeClient?.branding || { gradientFrom: '#0c6da4', gradientTo: '#4ab8ce' };

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [writingId, setWritingId] = useState<string | null>(null);
  const [showRedoInput, setShowRedoInput] = useState<Record<string, boolean>>({});
  const [redoGuidance, setRedoGuidance] = useState<Record<string, string>>({});
  const [editingBody, setEditingBody] = useState<Record<string, boolean>>({});
  const [bodyDraft, setBodyDraft] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, boolean>>({});

  const [newCampaign, setNewCampaign] = useState({
    campaign_type: 'email' as 'email' | 'sms',
    name: '',
    subject: '',
    scheduled_date: '',
    scheduled_time: '09:00',
    audience_segment: '',
    audience_count: '',
  });

  // Detect staff
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsStaff(MNA_EMAILS.includes(user?.email || ''));
    });
  }, []);

  // Fetch campaigns
  useEffect(() => {
    if (!activeClient?.id) return;
    setLoading(true);
    fetch(`/api/campaigns?clientId=${encodeURIComponent(activeClient.id)}`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .finally(() => setLoading(false));
  }, [activeClient?.id]);

  async function patchCampaign(id: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.campaign } : c)));
  }

  async function createCampaign() {
    if (!newCampaign.name || !newCampaign.scheduled_date) {
      alert('Name and scheduled date are required');
      return;
    }
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: activeClient.id,
        campaignType: newCampaign.campaign_type,
        name: newCampaign.name,
        subject: newCampaign.subject || null,
        scheduledDate: newCampaign.scheduled_date,
        scheduledTime: newCampaign.scheduled_time || null,
        audienceSegment: newCampaign.audience_segment || null,
        audienceCount: newCampaign.audience_count ? Number(newCampaign.audience_count) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed'); return; }
    setCampaigns((prev) => [data.campaign, ...prev]);
    setNewCampaign({ campaign_type: 'email', name: '', subject: '', scheduled_date: '', scheduled_time: '09:00', audience_segment: '', audience_count: '' });
    setShowAddForm(false);
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign?')) return;
    await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  async function writeCopy(id: string, guidance?: string) {
    setWritingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/write-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidance: guidance || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.campaign } : c)));
      setExpanded((e) => ({ ...e, [id]: true }));
      setShowRedoInput((s) => ({ ...s, [id]: false }));
      setRedoGuidance((g) => ({ ...g, [id]: '' }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWritingId(null);
    }
  }

  // Stats
  const byStatus: Record<CampaignStatus, number> = { drafting: 0, pending_review: 0, approved: 0, changes_requested: 0, sent: 0, failed: 0 };
  campaigns.forEach((c) => { if (byStatus[c.status] !== undefined) byStatus[c.status]++; });

  const filtered = useMemo(() => {
    let list = campaigns;
    if (typeFilter !== 'all') list = list.filter((c) => c.campaign_type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    return list.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }, [campaigns, typeFilter, statusFilter]);

  if (!activeClient) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>forward_to_inbox</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Email & SMS</h1>
          </div>
          <p className="text-white/60 mt-1">
            {activeClient.name} · {campaigns.length} campaigns
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            {showAddForm ? 'Cancel' : '+ New Campaign'}
          </button>
        )}
      </div>

      {/* Create campaign form */}
      {isStaff && showAddForm && (
        <div className="glass-card p-5">
          <div className="text-[13px] font-bold text-white mb-3">New Campaign</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setNewCampaign({ ...newCampaign, campaign_type: 'email' })}
                className={`flex-1 text-[12px] font-bold px-3 py-2 rounded-xl border transition-colors ${
                  newCampaign.campaign_type === 'email'
                    ? 'bg-violet-500/20 border-violet-400/40 text-violet-200'
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                📧 Email
              </button>
              <button
                onClick={() => setNewCampaign({ ...newCampaign, campaign_type: 'sms' })}
                className={`flex-1 text-[12px] font-bold px-3 py-2 rounded-xl border transition-colors ${
                  newCampaign.campaign_type === 'sms'
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                💬 SMS
              </button>
            </div>
            <input
              type="date"
              value={newCampaign.scheduled_date}
              onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_date: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
            <input
              type="time"
              value={newCampaign.scheduled_time}
              onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_time: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
            <input
              type="text"
              placeholder="Audience segment"
              value={newCampaign.audience_segment}
              onChange={(e) => setNewCampaign({ ...newCampaign, audience_segment: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
            />
          </div>
          <input
            type="text"
            placeholder="Campaign name (e.g. 'April NAD+ Flash Sale')"
            value={newCampaign.name}
            onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
            className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-2"
          />
          {newCampaign.campaign_type === 'email' && (
            <input
              type="text"
              placeholder="Subject line (optional — can be AI generated)"
              value={newCampaign.subject}
              onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
              className="w-full text-[13px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 mb-2"
            />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={createCampaign}
              className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              Create Campaign
            </button>
            <input
              type="number"
              placeholder="Est. recipients"
              value={newCampaign.audience_count}
              onChange={(e) => setNewCampaign({ ...newCampaign, audience_count: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 w-36"
            />
          </div>
        </div>
      )}

      {/* Push to client controls */}
      {isStaff && campaigns.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              Push to Client Portal
            </div>
            <div className="text-white/60 text-xs">
              {campaigns.filter((c) => c.client_visible).length} of {campaigns.length} campaigns visible to client.
            </div>
          </div>
          <div className="flex gap-2">
            {campaigns.some((c) => !c.client_visible) && (
              <button
                onClick={async () => {
                  const hidden = campaigns.filter((c) => !c.client_visible);
                  for (const c of hidden) {
                    await patchCampaign(c.id, { client_visible: true });
                  }
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#059669,#34d399)' }}
              >
                Push all to client
              </button>
            )}
            {campaigns.every((c) => c.client_visible) && (
              <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                All campaigns live
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status chips */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${typeFilter === 'all' ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          All ({campaigns.length})
        </button>
        <button
          onClick={() => setTypeFilter('email')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${typeFilter === 'email' ? 'bg-violet-500/20 text-violet-200 border-violet-400/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          📧 Email ({campaigns.filter((c) => c.campaign_type === 'email').length})
        </button>
        <button
          onClick={() => setTypeFilter('sms')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${typeFilter === 'sms' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          💬 SMS ({campaigns.filter((c) => c.campaign_type === 'sms').length})
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {(Object.keys(STATUS_STYLES) as CampaignStatus[]).map((s) => (
          byStatus[s] > 0 ? (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                statusFilter === s ? `${STATUS_STYLES[s].bg} ${STATUS_STYLES[s].text} border-white/20` : 'bg-white/5 text-white/50 border-white/10'
              }`}
            >
              {STATUS_STYLES[s].label} ({byStatus[s]})
            </button>
          ) : null
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="text-white/50 text-center py-8">Loading campaigns...</div>}

      {/* Empty state */}
      {!loading && campaigns.length === 0 && (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>campaign</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No campaigns yet</h2>
            <p className="text-white/50 text-sm mt-1">Create your first email or SMS campaign to get started.</p>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-4">
        {filtered.map((c) => {
          const st = STATUS_STYLES[c.status] || STATUS_STYLES.drafting;
          const tp = TYPE_STYLES[c.campaign_type] || TYPE_STYLES.email;
          const isExpanded = expanded[c.id];
          const isWriting = writingId === c.id;

          return (
            <div key={c.id} className="glass-card overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
              >
                {/* Type badge */}
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${tp.color}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{tp.icon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-white truncate">{c.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                    {c.client_visible ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Live to client</span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/40">Hidden</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {fmtDate(c.scheduled_date)}
                    {c.scheduled_time && ` at ${c.scheduled_time}`}
                    {c.audience_segment && ` · ${c.audience_segment}`}
                    {c.audience_count && ` · ~${c.audience_count.toLocaleString()} recipients`}
                    {c.subject && c.campaign_type === 'email' && (
                      <span className="ml-2 text-white/40">Subject: {c.subject}</span>
                    )}
                  </div>
                </div>

                {/* Metrics (if sent) */}
                {c.status === 'sent' && c.delivered != null && (
                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <div className="text-[9px] text-white/40 uppercase">Delivered</div>
                      <div className="text-[13px] font-bold text-white">{c.delivered?.toLocaleString()}</div>
                    </div>
                    {c.open_rate != null && (
                      <div>
                        <div className="text-[9px] text-white/40 uppercase">Open rate</div>
                        <div className="text-[13px] font-bold text-emerald-300">{Number(c.open_rate).toFixed(1)}%</div>
                      </div>
                    )}
                    {c.click_rate != null && (
                      <div>
                        <div className="text-[9px] text-white/40 uppercase">Click rate</div>
                        <div className="text-[13px] font-bold text-sky-300">{Number(c.click_rate).toFixed(1)}%</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expand arrow */}
                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 20, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  expand_more
                </span>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  {/* Copy section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                        {c.campaign_type === 'email' ? 'Email Copy' : 'SMS Copy'}
                      </div>
                      {isStaff && (
                        <div className="flex gap-2">
                          {!c.body && (
                            <button
                              onClick={() => writeCopy(c.id)}
                              disabled={isWriting}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                            >
                              {isWriting ? '✨ Writing...' : '✨ Generate Copy'}
                            </button>
                          )}
                          {c.body && (
                            <>
                              <button
                                onClick={() => setShowRedoInput((s) => ({ ...s, [c.id]: !s[c.id] }))}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/15"
                              >
                                Redo with notes
                              </button>
                              <button
                                onClick={() => {
                                  setBodyDraft((d) => ({ ...d, [c.id]: c.body || '' }));
                                  setEditingBody((e) => ({ ...e, [c.id]: true }));
                                }}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/15"
                              >
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Redo guidance input */}
                    {showRedoInput[c.id] && (
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="What should change? (e.g. 'Make it more urgent', 'Focus on NAD+ benefits')"
                          value={redoGuidance[c.id] || ''}
                          onChange={(e) => setRedoGuidance((g) => ({ ...g, [c.id]: e.target.value }))}
                          className="flex-1 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                        />
                        <button
                          onClick={() => writeCopy(c.id, redoGuidance[c.id])}
                          disabled={isWriting}
                          className="text-[11px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
                          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                        >
                          {isWriting ? 'Writing...' : 'Redo'}
                        </button>
                      </div>
                    )}

                    {/* Body content */}
                    {editingBody[c.id] ? (
                      <div className="space-y-2">
                        <textarea
                          value={bodyDraft[c.id] || ''}
                          onChange={(e) => setBodyDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          rows={10}
                          className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await patchCampaign(c.id, { body: bodyDraft[c.id] });
                              setEditingBody((e) => ({ ...e, [c.id]: false }));
                            }}
                            className="text-[11px] font-bold px-4 py-1.5 rounded-lg text-white"
                            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingBody((e) => ({ ...e, [c.id]: false }))}
                            className="text-[11px] font-semibold px-4 py-1.5 rounded-lg bg-white/10 text-white/60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : c.body ? (
                      <div className="text-[12px] text-white/80 whitespace-pre-wrap bg-white/5 rounded-xl p-4 border border-white/10 max-h-80 overflow-y-auto">
                        {c.body}
                      </div>
                    ) : (
                      <div className="text-[12px] text-white/30 italic py-4 text-center">No copy yet — click &quot;Generate Copy&quot; to write with AI</div>
                    )}
                  </div>

                  {/* Sent metrics detail */}
                  {c.status === 'sent' && c.delivered != null && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Delivery Metrics</div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {[
                          { label: 'Recipients', value: c.recipients },
                          { label: 'Delivered', value: c.delivered },
                          { label: 'Bounced', value: c.bounced },
                          { label: 'Opened', value: c.opened },
                          { label: 'Clicked', value: c.clicked },
                          { label: 'Unsubscribed', value: c.unsubscribed },
                        ].map((m) => (
                          <div key={m.label} className="bg-white/5 rounded-xl p-3 text-center">
                            <div className="text-[9px] font-bold uppercase text-white/40">{m.label}</div>
                            <div className="text-[16px] font-black text-white mt-0.5">{m.value?.toLocaleString() || '0'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client comments */}
                  {c.client_comments && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1">Client Feedback</div>
                      <div className="text-[12px] text-rose-200 bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                        {c.client_comments}
                      </div>
                    </div>
                  )}

                  {/* Internal notes */}
                  {isStaff && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">Internal Notes</div>
                        {!editingNotes[c.id] && (
                          <button
                            onClick={() => {
                              setNotesDraft((d) => ({ ...d, [c.id]: c.mna_comments || '' }));
                              setEditingNotes((e) => ({ ...e, [c.id]: true }));
                            }}
                            className="text-[10px] text-white/40 hover:text-white/70"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingNotes[c.id] ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={notesDraft[c.id] || ''}
                            onChange={(e) => setNotesDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                            className="flex-1 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
                            placeholder="Add internal notes..."
                          />
                          <button
                            onClick={async () => {
                              await patchCampaign(c.id, { mna_comments: notesDraft[c.id] || null });
                              setEditingNotes((e) => ({ ...e, [c.id]: false }));
                            }}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="text-[12px] text-white/40 italic">{c.mna_comments || 'No notes'}</div>
                      )}
                    </div>
                  )}

                  {/* Staff action buttons */}
                  {isStaff && (
                    <div className="flex gap-2 flex-wrap pt-2 border-t border-white/10">
                      {/* Status transitions */}
                      {c.status === 'drafting' && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'pending_review' })}
                          className="text-[11px] font-bold px-4 py-2 rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                        >
                          Mark ready for review
                        </button>
                      )}
                      {(c.status === 'pending_review' || c.status === 'changes_requested') && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'approved' })}
                          className="text-[11px] font-bold px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                        >
                          Approve for sending
                        </button>
                      )}
                      {c.status === 'approved' && !c.sent_at && (
                        <span className="text-[11px] text-sky-300 flex items-center gap-1 px-2">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          Queued — Make.com will pick this up
                        </span>
                      )}

                      {/* Visibility toggle */}
                      <button
                        onClick={() => patchCampaign(c.id, { client_visible: !c.client_visible })}
                        className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${
                          c.client_visible
                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            : 'bg-white/10 text-white/50 hover:bg-white/15'
                        }`}
                      >
                        {c.client_visible ? '✓ Live to client' : 'Push to client'}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteCampaign(c.id)}
                        className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/30 hover:bg-red-500/20 hover:text-red-300 ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
