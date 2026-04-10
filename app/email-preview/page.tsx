'use client';

import React, { useEffect, useState } from 'react';
import { clients } from '@/lib/clients';

type WeeklySummary = {
  clientName: string;
  clientId: string;
  contentCalendar: {
    pendingReviewCount: number;
    approvedCount: number;
    scheduledCount: number;
    draftingCount: number;
  };
  pendingReview: { title: string; date: string; platform: string }[];
  clientTasks: { title: string; description: string | null }[];
  teamTasks: { title: string; description: string | null }[];
  emailSections: {
    greeting: string;
    contentLine: string;
    clientTasksList: string;
    teamTasksList: string | null;
    closing: string;
    signature: string;
  };
};

const CLIENT_OPTIONS = clients.filter((c) => c.id !== 'mna');

export default function EmailPreviewPage() {
  const [selectedClient, setSelectedClient] = useState(CLIENT_OPTIONS[0]?.id || 'prime-iv');
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Editable fields
  const [subject, setSubject] = useState('');
  const [greeting, setGreeting] = useState('');
  const [contentLine, setContentLine] = useState('');
  const [clientTasksList, setClientTasksList] = useState('');
  const [teamTasksList, setTeamTasksList] = useState('');
  const [closing, setClosing] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    loadSummary();
  }, [selectedClient]);

  async function loadSummary() {
    setLoading(true);
    setSendStatus('idle');
    try {
      const res = await fetch(`/api/weekly-summary?clientId=${selectedClient}`);
      const data = await res.json();
      setSummary(data);

      const client = clients.find((c) => c.id === selectedClient);
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setSubject(`Weekly Wrap-Up — ${client?.shortName || data.clientName} — ${today}`);
      setGreeting(data.emailSections?.greeting || '');
      setContentLine(data.emailSections?.contentLine || '');
      setClientTasksList(data.emailSections?.clientTasksList || 'No open items this week.');
      setTeamTasksList(data.emailSections?.teamTasksList || '');
      setClosing(data.emailSections?.closing || 'Talk soon!');
    } catch {
      setSummary(null);
    }
    setLoading(false);
  }

  async function handleApprove() {
    setSendStatus('saving');
    try {
      const res = await fetch('/api/send-weekly-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          subject,
          body: buildEmailBody(),
          status: 'approved',
        }),
      });
      if (res.ok) {
        setSendStatus('saved');
      } else {
        setSendStatus('error');
      }
    } catch {
      setSendStatus('error');
    }
  }

  function buildEmailBody() {
    return `${greeting}

Here's your weekly update from Mother Nature Agency:

📅 CONTENT CALENDAR
${contentLine}

${summary?.contentCalendar.pendingReviewCount ? `⚡ NEEDS YOUR APPROVAL (${summary.contentCalendar.pendingReviewCount} posts):
Please review and approve in the portal: https://portal.mothernatureagency.com/client/calendar
` : ''}
✅ CHECKLIST — WHAT WE NEED FROM YOU:
${clientTasksList}

${teamTasksList ? `🔧 WHAT WE'RE WORKING ON:
${teamTasksList}
` : ''}
${closing}

— Mother Nature Agency`;
  }

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>mail</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Email Drafts</h1>
        </div>
        <p className="text-white/60 mt-1">Review and approve weekly client emails before they send.</p>
      </div>

      {/* Client selector */}
      <div className="flex gap-2">
        {CLIENT_OPTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedClient(c.id)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: selectedClient === c.id ? c.branding.gradientFrom : 'rgba(255,255,255,0.06)',
              color: selectedClient === c.id ? '#fff' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${selectedClient === c.id ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {c.shortName}
          </button>
        ))}
      </div>

      {loading && (
        <div className="glass-card p-10 text-center text-white/50">Loading summary...</div>
      )}

      {!loading && summary && (
        <>
          {/* Email preview card */}
          <div className="glass-card p-6" style={{ borderLeft: '3px solid #0c6da4' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-4">Email Preview</div>

            {/* Subject */}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-[13px] font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none"
              />
            </div>

            {/* Email body - editable sections */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Greeting */}
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                className="w-full text-[13px] px-2 py-1 rounded bg-transparent border-b border-white/10 text-white outline-none focus:border-white/30"
              />

              <div className="text-[12px] text-white/70">Here's your weekly update from Mother Nature Agency:</div>

              {/* Content Calendar */}
              <div>
                <div className="text-[11px] font-bold text-white/50 mb-1">📅 CONTENT CALENDAR</div>
                <textarea
                  value={contentLine}
                  onChange={(e) => setContentLine(e.target.value)}
                  rows={2}
                  className="w-full text-[12px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/80 outline-none resize-none"
                />
              </div>

              {/* Pending review notice */}
              {summary.contentCalendar.pendingReviewCount > 0 && (
                <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                  ⚡ {summary.contentCalendar.pendingReviewCount} posts need approval in the portal
                </div>
              )}

              {/* Client tasks */}
              <div>
                <div className="text-[11px] font-bold text-white/50 mb-1">✅ CHECKLIST — WHAT WE NEED FROM YOU</div>
                <textarea
                  value={clientTasksList}
                  onChange={(e) => setClientTasksList(e.target.value)}
                  rows={Math.max(2, clientTasksList.split('\n').length)}
                  className="w-full text-[12px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/80 outline-none resize-none"
                />
              </div>

              {/* Team tasks */}
              {teamTasksList && (
                <div>
                  <div className="text-[11px] font-bold text-white/50 mb-1">🔧 WHAT WE'RE WORKING ON</div>
                  <textarea
                    value={teamTasksList}
                    onChange={(e) => setTeamTasksList(e.target.value)}
                    rows={Math.max(2, teamTasksList.split('\n').length)}
                    className="w-full text-[12px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/80 outline-none resize-none"
                  />
                </div>
              )}

              {/* Closing */}
              <input
                type="text"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                className="w-full text-[12px] px-2 py-1 rounded bg-transparent border-b border-white/10 text-white/70 outline-none focus:border-white/30"
              />

              <div className="text-[12px] text-white/50">— Mother Nature Agency</div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleApprove}
                disabled={sendStatus === 'saving'}
                className="text-[12px] font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
              >
                {sendStatus === 'saving' ? 'Saving...' : sendStatus === 'saved' ? '✓ Approved & Queued' : 'Approve & Queue for Send'}
              </button>
              <button
                onClick={loadSummary}
                className="text-[12px] font-semibold px-4 py-2.5 rounded-xl text-white/60 hover:text-white bg-white/5 border border-white/10"
              >
                Refresh Data
              </button>
              {sendStatus === 'saved' && (
                <span className="text-[11px] text-emerald-400">Email saved. Make will pick it up and send on the next poll.</span>
              )}
              {sendStatus === 'error' && (
                <span className="text-[11px] text-red-400">Error saving email. Try again.</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
