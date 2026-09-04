'use client';

/**
 * Command Center — the Jarvis view.
 *
 * A futuristic, auto-refreshing HUD for the whole agency: live team
 * workload and overdue alerts, today's schedule, the content pipeline per
 * client, and a voice-driven AI core in the middle. Tap the orb and talk —
 * it runs on the same assistant brain (/api/assistant) that can assign
 * team tasks, manage the schedule, and check content, and it speaks its
 * answers back. Panels re-pull from /api/command-center every 45 seconds,
 * and immediately after the assistant acts, so what you see stays current.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STAFF } from '@/lib/staff';

type Feed = {
  generatedAt: string;
  today: string;
  tasks: {
    open: number; overdue: number; dueToday: number;
    byMember: Array<{ email: string; open: number; overdue: number }>;
    overdueList: Array<{ id: string; title: string; assignee_email: string | null; due_date: string | null }>;
    upcoming: Array<{ id: string; title: string; assignee_email: string | null; due_date: string | null; priority: string }>;
  };
  schedule: Array<{ id: string; title: string; event_date: string; start_time: string | null; event_type: string }>;
  content: Array<{ client_name: string; pending: number; this_week: number; next_post: string | null }>;
  campaignsPending: number;
  clientCount: number;
};

const PALETTE = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
function colorFor(email: string): string {
  let sum = 0;
  for (let i = 0; i < email.length; i++) sum += email.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

function fmtDue(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return iso; }
}

export default function CommandCenterPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [staffRows, setStaffRows] = useState<Array<{ email: string; name: string; color: string | null }>>([]);
  const [clock, setClock] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Voice core state
  const [coreState, setCoreState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [lastHeard, setLastHeard] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [typed, setTyped] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);

  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const recognitionRef = useRef<any>(null);
  const coreStateRef = useRef<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const userEmailRef = useRef('');
  useEffect(() => { coreStateRef.current = coreState; }, [coreState]);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);

  const memberName = (email: string | null): string => {
    if (!email || email === 'unassigned') return 'Unassigned';
    const s = STAFF.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (s) return s.name.split(' ')[0];
    const r = staffRows.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    return r?.name || email.split('@')[0];
  };
  const memberColor = (email: string | null): string => {
    if (!email || email === 'unassigned') return '#64748b';
    const r = staffRows.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    return r?.color || colorFor(email);
  };

  async function loadFeed() {
    try {
      const res = await fetch('/api/command-center', { cache: 'no-store' });
      if (res.ok) setFeed(await res.json());
    } catch { /* next poll retries */ }
  }

  useEffect(() => {
    createClient().auth.getUser().then((res: { data: { user: { email?: string | null } | null } }) => setUserEmail(res.data.user?.email || ''));
    fetch('/api/staff').then((r) => r.json()).then((d) => setStaffRows(d.staff || [])).catch(() => {});
    loadFeed();
    const poll = setInterval(loadFeed, 45000);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    const SR = typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    if (!SR) setVoiceSupported(false);
    return () => {
      clearInterval(poll); clearInterval(tick);
      try { recognitionRef.current?.stop(); } catch { /* fine */ }
      try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // ── Voice core ────────────────────────────────────────────────────

  function speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) { setCoreState('idle'); return; }
    const clean = text.replace(/[*_#`>|]/g, ' ').replace(/\{\{[^}]+\}\}/g, 'the link').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!clean) { setCoreState('idle'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find((x) => x.name === 'Google US English') || voices.find((x) => (x.lang || '').startsWith('en'));
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onstart = () => setCoreState('speaking');
    u.onend = () => setCoreState('idle');
    u.onerror = () => setCoreState('idle');
    window.speechSynthesis.speak(u);
  }

  async function ask(msg: string) {
    const text = msg.trim();
    if (!text) return;
    setLastHeard(text);
    setLastReply('');
    setCoreState('thinking');
    historyRef.current = [...historyRef.current.slice(-8), { role: 'user', content: text }];
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmailRef.current, messages: historyRef.current }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Something went wrong.';
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      setLastReply(reply);
      speak(reply);
      loadFeed(); // the assistant may have just changed tasks/schedule — refresh panels
    } catch {
      setLastReply('Connection trouble — try again.');
      setCoreState('idle');
    }
  }

  function orbTap() {
    if (coreStateRef.current === 'listening') {
      try { recognitionRef.current?.stop(); } catch { /* fine */ }
      setCoreState('idle');
      return;
    }
    if (coreStateRef.current === 'speaking') {
      try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
      setCoreState('idle');
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setLastHeard((finalText + interim).trim());
    };
    rec.onend = () => {
      if (coreStateRef.current === 'listening') setCoreState('idle');
      const msg = finalText.trim();
      if (msg) void ask(msg);
    };
    rec.onerror = () => setCoreState('idle');
    recognitionRef.current = rec;
    setCoreState('listening');
    try { rec.start(); } catch { setCoreState('idle'); }
  }

  const orbColor = coreState === 'listening' ? '#f43f5e' : coreState === 'thinking' ? '#f59e0b' : coreState === 'speaking' ? '#10b981' : '#4ab8ce';
  const orbLabel = coreState === 'listening' ? 'Listening…' : coreState === 'thinking' ? 'Working…' : coreState === 'speaking' ? 'Speaking — tap to stop' : 'Tap to talk';

  const t = feed?.tasks;
  const maxOpen = Math.max(1, ...(t?.byMember.map((m) => m.open) || [1]));

  return (
    <div className="max-w-[1300px] mx-auto">
      <style>{`
        @keyframes ccPulseRing { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes ccGlow { 0%,100% { box-shadow: 0 0 24px var(--orb), 0 0 60px rgba(74,184,206,.15); } 50% { box-shadow: 0 0 44px var(--orb), 0 0 90px rgba(74,184,206,.25); } }
        @keyframes ccBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        .cc-panel { background: linear-gradient(160deg, rgba(12,109,164,0.10), rgba(255,255,255,0.03)); border: 1px solid rgba(74,184,206,0.22); border-radius: 16px; }
        .cc-title { font-size: 10px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: rgba(134,214,225,.75); }
      `}</style>

      {/* ── Top status bar ─────────────────────────────────────────── */}
      <div className="cc-panel px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: 'ccBlink 1.6s infinite' }} />
          <span className="cc-title">MNA Command Center</span>
        </div>
        <span className="text-[13px] font-bold text-white/85 tabular-nums" style={{ fontFamily: 'monospace' }}>{clock}</span>
        <span className="text-[11px] text-white/40">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {[
            { label: 'Clients', value: feed?.clientCount ?? '—', color: '#4ab8ce' },
            { label: 'Open tasks', value: t?.open ?? '—', color: '#0ea5e9' },
            { label: 'Due today', value: t?.dueToday ?? '—', color: '#f59e0b' },
            { label: 'Overdue', value: t?.overdue ?? '—', color: (t?.overdue || 0) > 0 ? '#f43f5e' : '#10b981' },
            { label: 'Campaigns queued', value: feed?.campaignsPending ?? '—', color: '#8b5cf6' },
          ].map((s) => (
            <div key={s.label} className="px-3 py-1.5 rounded-xl text-center" style={{ background: s.color + '14', border: `1px solid ${s.color}44` }}>
              <div className="text-[15px] font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[8px] font-bold uppercase tracking-widest text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr_1fr] gap-4">
        {/* ── Left: team workload + alerts ─────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="cc-panel p-4">
            <div className="cc-title mb-3">Team Workload</div>
            {(t?.byMember || []).length === 0 && <div className="text-[11px] text-white/35">No open tasks on the board.</div>}
            <div className="space-y-3">
              {(t?.byMember || []).map((m) => {
                const c = memberColor(m.email);
                return (
                  <div key={m.email}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: c }}>
                        {memberName(m.email).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[11px] font-bold text-white/80">{memberName(m.email)}</span>
                      <span className="ml-auto text-[10px] text-white/45">{m.open} open</span>
                      {m.overdue > 0 && <span className="text-[9px] font-bold text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded">{m.overdue} late</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(m.open / maxOpen) * 100}%`, background: `linear-gradient(90deg, ${c}, ${c}88)` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cc-panel p-4" style={{ borderColor: (t?.overdue || 0) > 0 ? 'rgba(244,63,94,0.4)' : undefined }}>
            <div className="cc-title mb-3" style={{ color: (t?.overdue || 0) > 0 ? '#fda4af' : undefined }}>
              Alerts {(t?.overdue || 0) > 0 ? `— ${t?.overdue} overdue` : '— all clear'}
            </div>
            {(t?.overdueList || []).length === 0 ? (
              <div className="text-[11px] text-emerald-300/70">Nothing overdue. The machine hums.</div>
            ) : (
              <div className="space-y-1.5">
                {(t?.overdueList || []).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
                    <span className="material-symbols-outlined text-rose-300 shrink-0" style={{ fontSize: 14 }}>warning</span>
                    <span className="text-[11px] text-white/85 truncate flex-1">{task.title}</span>
                    <span className="text-[9px] font-bold shrink-0" style={{ color: memberColor(task.assignee_email) }}>{memberName(task.assignee_email)}</span>
                    <span className="text-[9px] text-rose-300 shrink-0">{fmtDue(task.due_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Center: the voice core ───────────────────────────────── */}
        <div className="cc-panel p-6 flex flex-col items-center justify-between min-h-[480px]" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(74,184,206,0.10), rgba(255,255,255,0.02) 70%)' }}>
          <div className="cc-title">AI Core</div>

          <div className="flex flex-col items-center gap-5 py-4">
            <button onClick={orbTap} className="relative flex items-center justify-center" style={{ width: 190, height: 190 }} title={orbLabel}>
              {/* pulse rings */}
              {(coreState === 'listening' || coreState === 'speaking') && (
                <>
                  <span className="absolute inset-6 rounded-full" style={{ border: `2px solid ${orbColor}`, animation: 'ccPulseRing 1.6s ease-out infinite' }} />
                  <span className="absolute inset-6 rounded-full" style={{ border: `2px solid ${orbColor}`, animation: 'ccPulseRing 1.6s ease-out .55s infinite' }} />
                </>
              )}
              <span
                className="w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${orbColor}cc, #0d1b2a 75%)`,
                  border: `2px solid ${orbColor}`,
                  ['--orb' as any]: orbColor + '66',
                  animation: 'ccGlow 2.6s ease-in-out infinite',
                }}
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: 52 }}>
                  {coreState === 'listening' ? 'graphic_eq' : coreState === 'thinking' ? 'neurology' : coreState === 'speaking' ? 'volume_up' : 'mic'}
                </span>
              </span>
            </button>
            <div className="text-[12px] font-bold tracking-wide" style={{ color: orbColor }}>{orbLabel}</div>
            {!voiceSupported && <div className="text-[10px] text-amber-300/80">Voice needs Chrome or Edge — type below instead.</div>}
          </div>

          <div className="w-full space-y-2">
            {lastHeard && (
              <div className="text-[11px] text-white/50 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-white/30 font-bold mr-1.5">You:</span>{lastHeard}
              </div>
            )}
            {lastReply && (
              <div className="text-[12px] text-white/90 px-3 py-2.5 rounded-xl max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ background: 'rgba(74,184,206,0.10)', border: '1px solid rgba(74,184,206,0.3)' }}>
                {lastReply}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) { void ask(typed); setTyped(''); } }}
                placeholder='Or type: "assign Sable…", "what&apos;s overdue?"'
                className="flex-1 text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/25"
              />
              <button
                onClick={() => { if (typed.trim()) { void ask(typed); setTyped(''); } }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: schedule + content pipeline ───────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="cc-panel p-4">
            <div className="cc-title mb-3">Up Next — Schedule</div>
            {(feed?.schedule || []).length === 0 ? (
              <div className="text-[11px] text-white/35">Nothing scheduled in the next few days.</div>
            ) : (
              <div className="space-y-1.5">
                {(feed?.schedule || []).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5">
                    <span className="material-symbols-outlined text-cyan-300/80 shrink-0" style={{ fontSize: 14 }}>
                      {ev.event_type === 'meeting' || ev.event_type === 'call' ? 'videocam' : ev.event_type === 'deadline' ? 'flag' : 'task_alt'}
                    </span>
                    <span className="text-[11px] text-white/85 truncate flex-1">{ev.title}</span>
                    <span className="text-[9px] text-white/45 shrink-0">{ev.event_date === feed?.today ? 'Today' : fmtDue(ev.event_date)}{ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cc-panel p-4">
            <div className="cc-title mb-3">Content Pipeline</div>
            {(feed?.content || []).length === 0 ? (
              <div className="text-[11px] text-white/35">No active content calendars.</div>
            ) : (
              <div className="space-y-1.5">
                {(feed?.content || []).map((c) => (
                  <div key={c.client_name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/5">
                    <span className="text-[11px] font-semibold text-white/85 truncate flex-1">{c.client_name}</span>
                    <span className="text-[9px] text-white/45 shrink-0">next {fmtDue(c.next_post)}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(14,165,233,0.15)', color: '#7dd3fc' }}>{c.this_week} this wk</span>
                    {Number(c.pending) > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d' }}>{c.pending} to approve</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[9px] text-white/25 text-center">
            Live — refreshes every 45s{feed ? ` · updated ${new Date(feed.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
