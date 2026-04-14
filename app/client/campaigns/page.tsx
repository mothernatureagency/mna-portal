'use client';
import React, { useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

export const dynamic = 'force-dynamic';

type CampaignStatus = 'drafting' | 'pending_review' | 'approved' | 'changes_requested' | 'sent' | 'failed';

type Campaign = {
  id: string;
  campaign_type: 'email' | 'sms';
  name: string;
  subject: string | null;
  body: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  audience_segment: string | null;
  audience_count: number | null;
  status: CampaignStatus;
  client_comments: string | null;
  sent_at: string | null;
  // Joined metrics
  recipients: number | null;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
  open_rate: number | null;
  click_rate: number | null;
};

const STATUS_STYLES: Record<CampaignStatus, { label: string; dot: string }> = {
  drafting:          { label: 'Drafting',          dot: '#6b7280' },
  pending_review:    { label: 'Ready for review',  dot: '#f59e0b' },
  approved:          { label: 'Approved',          dot: '#10b981' },
  changes_requested: { label: 'Changes requested', dot: '#f43f5e' },
  sent:              { label: 'Sent',              dot: '#38bdf8' },
  failed:            { label: 'Failed',            dot: '#ef4444' },
};

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export default function ClientCampaignsPage() {
  const { client } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [selectedNonMemberTier, setSelectedNonMemberTier] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/campaigns?clientId=${encodeURIComponent(client.id)}&visible=1`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .finally(() => setLoading(false));
  }, [client.id]);

  async function approve(id: string) {
    const res = await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved' }),
    });
    const data = await res.json();
    if (res.ok) setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.campaign } : c)));
  }

  async function requestChanges(id: string) {
    const comment = commentDraft[id]?.trim();
    if (!comment) { alert('Please add a comment before requesting changes.'); return; }
    const res = await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'changes_requested', client_comments: comment }),
    });
    const data = await res.json();
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.campaign } : c)));
      setCommentDraft((d) => ({ ...d, [id]: '' }));
    }
  }

  const filtered = typeFilter === 'all' ? campaigns : campaigns.filter((c) => c.campaign_type === typeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Email & SMS</h1>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Review and approve upcoming email and SMS copies before they send.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'email', 'sms'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-4 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
              typeFilter === t ? 'bg-white/15 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10'
            }`}
          >
            {t === 'all' ? `All (${campaigns.length})` : t === 'email' ? `📧 Email (${campaigns.filter((c) => c.campaign_type === 'email').length})` : `💬 SMS (${campaigns.filter((c) => c.campaign_type === 'sms').length})`}
          </button>
        ))}
      </div>

      {loading && <div className="text-white/40 text-center py-8 text-[13px]">Loading campaigns...</div>}

      {!loading && campaigns.length === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="text-[14px] font-semibold text-white/60">No campaigns yet</div>
          <div className="text-[12px] text-white/40 mt-1">Your team will push campaigns here for your review.</div>
        </div>
      )}

      {/* Campaign cards */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const st = STATUS_STYLES[c.status];
          const isExpanded = expanded[c.id];

          return (
            <div key={c.id} className="glass-card overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  c.campaign_type === 'email' ? 'bg-violet-500/20 text-violet-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {c.campaign_type === 'email' ? 'mail' : 'sms'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-white truncate">{c.name}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.dot }} />
                    <span className="text-[10px] text-white/50">{st.label}</span>
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {fmtDate(c.scheduled_date)}
                    {c.scheduled_time && ` at ${c.scheduled_time}`}
                    {c.campaign_type === 'email' && c.subject && ` · "${c.subject}"`}
                  </div>
                </div>

                {/* Sent metrics */}
                {c.status === 'sent' && c.open_rate != null && (
                  <div className="hidden sm:flex gap-4 text-right shrink-0">
                    <div>
                      <div className="text-[9px] text-white/40">Opens</div>
                      <div className="text-[13px] font-bold text-emerald-300">{Number(c.open_rate).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/40">Clicks</div>
                      <div className="text-[13px] font-bold text-sky-300">{Number(c.click_rate).toFixed(1)}%</div>
                    </div>
                  </div>
                )}

                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 18, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  expand_more
                </span>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  {/* Copy preview */}
                  {c.body && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                        {c.campaign_type === 'email' ? 'Email Preview' : 'SMS Preview'}
                      </div>
                      {c.campaign_type === 'sms' && c.body ? (
                        /* SMS: split Member / Non-Member */
                        (() => {
                          const body = c.body || '';
                          const memberMatch = body.match(/MEMBER\s*(?:COPY)?[:\s]*\n?([\s\S]*?)(?=NON[- ]?MEMBER|$)/i);
                          const nonMemberMatch = body.match(/NON[- ]?MEMBER\s*(?:COPY)?[:\s]*\n?([\s\S]*?)$/i);
                          const memberCopy = memberMatch ? memberMatch[1].trim() : '';
                          const nonMemberCopy = nonMemberMatch ? nonMemberMatch[1].trim() : '';
                          const hasSplit = memberCopy || nonMemberCopy;

                          const calcSegments = (text: string) => {
                            const len = text.length;
                            return len === 0 ? 1 : len <= 160 ? 1 : Math.ceil(len / 153);
                          };
                          const rate = 0.0079;
                          const memberSegments = calcSegments(memberCopy);
                          const nonMemberSegments = calcSegments(nonMemberCopy);
                          const nonMemberTiers = [500, 1000, 2500, 5000];

                          return (
                            <div className="space-y-4">
                              {hasSplit ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>loyalty</span>
                                      Member
                                    </div>
                                    <div className="rounded-2xl bg-emerald-600/15 border border-emerald-500/25 p-4">
                                      <div className="text-[13px] text-white whitespace-pre-wrap">{memberCopy}</div>
                                    </div>
                                    <div className="text-[10px] text-white/40 mt-1">{memberCopy.length} chars · {memberSegments} segment{memberSegments > 1 ? 's' : ''}</div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
                                      Non-Member
                                    </div>
                                    <div className="rounded-2xl bg-amber-600/15 border border-amber-500/25 p-4">
                                      <div className="text-[13px] text-white whitespace-pre-wrap">{nonMemberCopy}</div>
                                    </div>
                                    <div className="text-[10px] text-white/40 mt-1">{nonMemberCopy.length} chars · {nonMemberSegments} segment{nonMemberSegments > 1 ? 's' : ''}</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="max-w-xs mx-auto">
                                  <div className="rounded-2xl bg-emerald-600/20 border border-emerald-500/30 p-4">
                                    <div className="text-[13px] text-white whitespace-pre-wrap">{body}</div>
                                  </div>
                                </div>
                              )}

                              {/* Cost Breakdown */}
                              <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                                  SMS Cost Estimate
                                  <span className="text-[9px] font-normal text-white/30 ml-2">SMS only · does not include MMS</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Member */}
                                  <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/15">
                                    <div className="text-[11px] font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>loyalty</span>
                                      Member Cost
                                      <span className="text-[9px] font-normal text-white/30 ml-1">per 100 members</span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                      <span className="text-[11px] text-white/60">{memberSegments} seg × 100 × $0.0079</span>
                                      <span className="text-[18px] font-black text-emerald-300">${(memberSegments * 100 * rate).toFixed(2)}</span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                                      {[100, 200, 500, 1000].map((n) => (
                                        <div key={n} className="bg-white/5 rounded-lg py-1.5 px-1">
                                          <div className="text-[9px] text-white/40">{n}</div>
                                          <div className="text-[11px] font-bold text-white">${(memberSegments * n * rate).toFixed(2)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {/* Non-Member */}
                                  {(() => {
                                    const selected = selectedNonMemberTier[c.id] || 0;
                                    return (
                                      <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/15">
                                        <div className="text-[11px] font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
                                          Non-Member Cost
                                          <span className="text-[9px] font-normal text-white/30 ml-1">select quantity</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center mb-3">
                                          {nonMemberTiers.map((n) => (
                                            <button
                                              key={n}
                                              onClick={() => setSelectedNonMemberTier((prev) => ({ ...prev, [c.id]: n }))}
                                              className={`rounded-lg py-2 px-1 transition-all border ${
                                                selected === n
                                                  ? 'bg-amber-500/20 border-amber-400/40 ring-1 ring-amber-400/30'
                                                  : 'bg-white/5 border-white/10 hover:bg-white/10'
                                              }`}
                                            >
                                              <div className={`text-[10px] font-bold ${selected === n ? 'text-amber-200' : 'text-white/50'}`}>{n.toLocaleString()}</div>
                                              <div className="text-[9px] text-white/30">sms</div>
                                            </button>
                                          ))}
                                        </div>
                                        {selected > 0 ? (
                                          <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                            <div className="flex items-baseline justify-between">
                                              <span className="text-[11px] text-white/60">{nonMemberSegments} seg × {selected.toLocaleString()} × $0.0079</span>
                                              <span className="text-[20px] font-black text-amber-200">${(nonMemberSegments * selected * rate).toFixed(2)}</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-[11px] text-white/30 text-center py-1">Select a quantity above to calculate</div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : c.campaign_type === 'sms' ? (
                        <div className="max-w-xs mx-auto">
                          <div className="rounded-2xl bg-emerald-600/20 border border-emerald-500/30 p-4">
                            <div className="text-[13px] text-white whitespace-pre-wrap">{c.body}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px] text-white/80 whitespace-pre-wrap bg-white/5 rounded-xl p-4 border border-white/10 max-h-72 overflow-y-auto">
                          {c.body}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sent metrics detail */}
                  {c.status === 'sent' && c.delivered != null && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Delivered', value: c.delivered?.toLocaleString() },
                        { label: 'Opened', value: c.opened?.toLocaleString() },
                        { label: 'Clicked', value: c.clicked?.toLocaleString() },
                        { label: 'Open Rate', value: `${Number(c.open_rate).toFixed(1)}%` },
                      ].map((m) => (
                        <div key={m.label} className="bg-white/5 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-bold uppercase text-white/40">{m.label}</div>
                          <div className="text-[16px] font-black text-white mt-0.5">{m.value || '0'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approve / Request Changes */}
                  {(c.status === 'pending_review' || c.status === 'changes_requested') && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(c.id)}
                          className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
                          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                        >
                          ✓ Approve Campaign
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add feedback or change requests..."
                          value={commentDraft[c.id] || ''}
                          onChange={(e) => setCommentDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          className="flex-1 text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                        />
                        <button
                          onClick={() => requestChanges(c.id)}
                          className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Already approved message */}
                  {c.status === 'approved' && !c.sent_at && (
                    <div className="text-[12px] text-emerald-300 flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                      Approved — scheduled to send {fmtDate(c.scheduled_date)}{c.scheduled_time ? ` at ${c.scheduled_time}` : ''}
                    </div>
                  )}

                  {c.status === 'sent' && c.sent_at && (
                    <div className="text-[12px] text-sky-300 flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                      Sent on {fmtDate(c.sent_at.slice(0, 10))}
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
