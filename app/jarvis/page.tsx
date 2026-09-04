'use client';

/**
 * MOTHER — MNA Command Center.
 *
 * Full sci-fi HUD over real agency data, with MOTHER as the always-on
 * voice at the center. Tap the core once to bring her online: from then
 * on the mic stays open. Say "Mother …" (the wake word) and whatever
 * follows is the command — "Mother, what's overdue?", "Mother, assign
 * Sable the Chill House shoot due Friday." For ~15 seconds after she
 * answers you can keep talking without repeating her name. She speaks
 * with the same ElevenLabs voice picked in the globe (Lily by default),
 * goes quiet-and-deaf while she talks so she never hears herself, and
 * ignores room conversation that isn't addressed to her. Tap again to
 * take her offline.
 *
 * Panels re-pull /api/command-center every 45s and right after she acts.
 * Every number on screen is real portal data — nothing fabricated.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDisplayName } from '@/lib/display-names';
import { STAFF } from '@/lib/staff';

type Feed = {
  generatedAt: string;
  today: string;
  tasks: {
    open: number; overdue: number; dueToday: number;
    byMember: Array<{ email: string; open: number; overdue: number }>;
    overdueList: Array<{ id: string; title: string; assignee_email: string | null; due_date: string | null }>;
    todayList: Array<{ id: string; title: string; assignee_email: string | null; due_date: string | null }>;
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

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// "Mother", "Mother Nature", "hey Mother", with or without a command after.
const WAKE_RE = /^(?:hey\s+|okay\s+|ok\s+)?(?:mother\s+nature|mother)\b[\s,.!]*([\s\S]*)$/i;
const FOLLOW_UP_MS = 15000;

function fmtDue(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return iso; }
}

/** "in 2h 15m" / "in 3d" / "now" for a schedule event. */
function untilLabel(dateIso: string, startTime: string | null, todayIso: string): string {
  try {
    const target = new Date(`${dateIso}T${(startTime || '09:00').slice(0, 5)}:00`);
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return dateIso === todayIso ? 'now' : 'past';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `in ${mins}m`;
    if (mins < 60 * 24) return `in ${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}`.trim();
    return `in ${Math.round(mins / (60 * 24))}d`;
  } catch { return ''; }
}

export default function CommandCenterPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [staffRows, setStaffRows] = useState<Array<{ email: string; name: string; color: string | null }>>([]);
  const [clock, setClock] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [coreState, setCoreState] = useState<'offline' | 'online' | 'thinking' | 'speaking'>('offline');
  const [lastHeard, setLastHeard] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [weather, setWeather] = useState<{ tempF: number; desc: string; high: number; low: number } | null>(null);

  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onlineRef = useRef(false);
  const busyRef = useRef(false);          // thinking or speaking — mic stays closed
  const followUpUntilRef = useRef(0);     // window where no wake word is needed
  const userEmailRef = useRef('');
  const feedRef = useRef<Feed | null>(null);
  const weatherRef = useRef<{ tempF: number; desc: string; high: number; low: number } | null>(null);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);
  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

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

  function loadWeather(lat?: number, lon?: number) {
    const q = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : '';
    fetch(`/api/weather${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.tempF === 'number') setWeather(d); })
      .catch(() => {});
  }

  useEffect(() => {
    createClient().auth.getUser().then((res: { data: { user: { email?: string | null } | null } }) => setUserEmail(res.data.user?.email || ''));
    fetch('/api/staff').then((r) => r.json()).then((d) => setStaffRows(d.staff || [])).catch(() => {});
    loadFeed();
    // Weather for the briefing: agency default immediately, then the user's
    // actual location if the browser shares it.
    loadWeather();
    try {
      navigator.geolocation?.getCurrentPosition(
        (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
        () => { /* declined — default location stands */ },
        { timeout: 4000, maximumAge: 600000 },
      );
    } catch { /* unsupported */ }
    const poll = setInterval(loadFeed, 45000);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    const SR = typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    if (!SR) setVoiceSupported(false);
    return () => {
      clearInterval(poll); clearInterval(tick);
      onlineRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* fine */ }
      try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
      try { audioRef.current?.pause(); } catch { /* fine */ }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // ── The always-on ear ─────────────────────────────────────────────
  // Runs whenever Mother is online and not busy; restarts itself when the
  // browser times the mic out, and closes while she thinks/speaks so she
  // never transcribes her own voice.

  function startRecognition() {
    if (!onlineRef.current || busyRef.current) return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    try { recognitionRef.current?.stop(); } catch { /* fine */ }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) handleUtterance(t.trim());
        else interim += t;
      }
      setLiveTranscript(interim.trim());
    };
    rec.onend = () => {
      setLiveTranscript('');
      // Chrome stops the mic after silence — keep it warm while online.
      if (onlineRef.current && !busyRef.current) setTimeout(() => startRecognition(), 350);
    };
    rec.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') goOffline();
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* an instance is already running — fine */ }
  }

  function stopRecognition() {
    try { recognitionRef.current?.stop(); } catch { /* fine */ }
    setLiveTranscript('');
  }

  /** One finished phrase from the mic — decide if it was meant for Mother. */
  function handleUtterance(u: string) {
    if (!u || busyRef.current) return;
    const m = u.match(WAKE_RE);
    let command = '';
    if (m) command = (m[1] || '').trim();
    else if (Date.now() < followUpUntilRef.current) command = u.trim();
    else return; // room chatter, not addressed to her — ignore
    if (!command) {
      // Just her name: acknowledge and hold the door open.
      followUpUntilRef.current = Date.now() + FOLLOW_UP_MS;
      setLastHeard(u);
      setLastReply('Yes?');
      void speak('Yes?');
      return;
    }
    void ask(command);
  }

  // ── Her voice: ElevenLabs (globe's saved pick, Lily default) ──────

  function afterSpeech() {
    busyRef.current = false;
    if (onlineRef.current) {
      followUpUntilRef.current = Date.now() + FOLLOW_UP_MS;
      setCoreState('online');
      startRecognition();
    } else {
      setCoreState('offline');
    }
  }

  function browserSpeak(clean: string) {
    if (!window.speechSynthesis) { afterSpeech(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find((x) => x.name === 'Google US English') || voices.find((x) => (x.lang || '').startsWith('en'));
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onstart = () => setCoreState('speaking');
    u.onend = afterSpeech;
    u.onerror = afterSpeech;
    window.speechSynthesis.speak(u);
  }

  async function speak(text: string) {
    if (typeof window === 'undefined') { afterSpeech(); return; }
    const clean = text.replace(/[*_#`>|]/g, ' ').replace(/\{\{[^}]+\}\}/g, 'the link').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!clean) { afterSpeech(); return; }
    busyRef.current = true;      // mic closed while she talks
    stopRecognition();
    try { audioRef.current?.pause(); } catch { /* fine */ }
    try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
    try {
      let voiceId = '';
      try { voiceId = localStorage.getItem('mn_voice_id') || ''; } catch { /* fine */ }
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voiceId: voiceId || undefined }),
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setCoreState('speaking');
        audio.onended = () => { URL.revokeObjectURL(url); afterSpeech(); };
        audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(clean); };
        await audio.play();
        return;
      }
    } catch { /* fall back */ }
    browserSpeak(clean);
  }

  async function ask(msg: string) {
    const text = msg.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    stopRecognition();
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
      void speak(reply);
      loadFeed();
    } catch {
      setLastReply('Connection trouble — try again.');
      afterSpeech();
    }
  }

  function goOnline() {
    onlineRef.current = true;
    setCoreState('online');
    // Spoken briefing on activation: greeting, weather, the board, what's
    // next. Doubles as the audio unlock; the ear opens when it ends.
    const name = getDisplayName(userEmailRef.current) || '';
    const w = weatherRef.current;
    const f = feedRef.current;
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const parts: string[] = [`${timeOfDay}${name ? `, ${name}` : ''}.`];
    if (w) parts.push(`It's ${Math.round(w.tempF)} degrees and ${w.desc.toLowerCase()} right now, heading for a high of ${Math.round(w.high)}.`);
    if (f) {
      const tt = f.tasks;
      if (tt.open === 0) {
        parts.push('The team board is clear.');
      } else {
        const bits = [`The team has ${tt.open} open task${tt.open === 1 ? '' : 's'}`];
        if (tt.dueToday > 0) {
          const who = tt.todayList.map((x) => memberName(x.assignee_email)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' and ');
          bits.push(`${tt.dueToday} due today${who ? ` for ${who}` : ''}`);
        }
        if (tt.overdue > 0) bits.push(`${tt.overdue} overdue`);
        parts.push(bits.join(', ') + '.');
      }
      const ev = f.schedule[0];
      if (ev) parts.push(`Next on your schedule: ${ev.title}, ${untilLabel(ev.event_date, ev.start_time, f.today)}.`);
      const approvals = f.content.reduce((s, c) => s + Number(c.pending || 0), 0);
      if (approvals > 0) parts.push(`And ${approvals} post${approvals === 1 ? ' is' : 's are'} waiting on client approval.`);
    }
    parts.push('Say Mother when you need me.');
    const briefing = parts.join(' ');
    setLastReply(briefing);
    void speak(briefing);
  }

  function goOffline() {
    onlineRef.current = false;
    busyRef.current = false;
    stopRecognition();
    try { audioRef.current?.pause(); } catch { /* fine */ }
    try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
    setCoreState('offline');
  }

  function orbTap() {
    if (onlineRef.current) goOffline();
    else goOnline();
  }

  function executiveBriefing() {
    void ask("Give me an executive briefing: what's overdue on the team board, what's due today, what's on my schedule, and which clients have content waiting for approval. Keep it tight.");
  }

  // ── Derived HUD data ──────────────────────────────────────────────
  const t = feed?.tasks;
  const systemOptimal = (t?.overdue || 0) === 0;
  const orbColor = coreState === 'online' ? '#22d3ee' : coreState === 'thinking' ? '#f59e0b' : coreState === 'speaking' ? '#10b981' : '#155e75';
  const orbAccent = coreState === 'offline' ? '#22d3ee' : orbColor;
  const statusLine =
    coreState === 'offline' ? 'Tap to bring Mother online'
      : coreState === 'thinking' ? 'Working on it…'
        : coreState === 'speaking' ? 'Speaking — tap to stop'
          : liveTranscript ? `“${liveTranscript}”`
            : 'Online — say “Mother…”';

  const intel: Array<{ level: 'WARN' | 'INFO' | 'TIP'; icon: string; text: string }> = [];
  if (feed) {
    if ((t?.overdue || 0) > 0) intel.push({ level: 'WARN', icon: 'warning', text: `${t!.overdue} task${t!.overdue === 1 ? ' is' : 's are'} overdue — "${t!.overdueList[0]?.title || ''}"${t!.overdue > 1 ? ' and more' : ''}` });
    if ((t?.dueToday || 0) > 0) intel.push({ level: 'INFO', icon: 'today', text: `${t!.dueToday} task${t!.dueToday === 1 ? '' : 's'} due today — ${t!.todayList.map((x) => memberName(x.assignee_email)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` });
    const nextEv = feed.schedule[0];
    if (nextEv) intel.push({ level: 'INFO', icon: 'event', text: `${nextEv.title} — ${untilLabel(nextEv.event_date, nextEv.start_time, feed.today)}` });
    const approvals = feed.content.filter((c) => Number(c.pending) > 0).sort((a, b) => Number(b.pending) - Number(a.pending));
    for (const c of approvals.slice(0, 3)) intel.push({ level: 'TIP', icon: 'fact_check', text: `${c.client_name}: ${c.pending} post${Number(c.pending) === 1 ? '' : 's'} waiting for approval` });
    if (feed.campaignsPending > 0) intel.push({ level: 'TIP', icon: 'forward_to_inbox', text: `${feed.campaignsPending} campaign${feed.campaignsPending === 1 ? '' : 's'} still in drafting or review` });
    if (intel.length === 0) intel.push({ level: 'INFO', icon: 'check_circle', text: 'All clear — nothing needs attention right now.' });
  }

  const LEVEL_COLOR: Record<string, string> = { WARN: '#f59e0b', INFO: '#22d3ee', TIP: '#8b5cf6' };

  const coreTiles = [
    { icon: 'smart_toy', label: 'AI Core', value: coreState === 'offline' ? 'Standby' : 'Active', color: coreState === 'offline' ? '#64748b' : '#22d3ee' },
    { icon: 'graphic_eq', label: 'Voice', value: voiceSupported ? (coreState === 'offline' ? 'Ready' : 'Listening') : 'Text only', color: voiceSupported ? '#10b981' : '#f59e0b' },
    { icon: 'diversity_3', label: 'Clients', value: `${feed?.clientCount ?? '—'} connected`, color: '#4ab8ce' },
    { icon: 'assignment', label: 'Team Tasks', value: `${t?.open ?? '—'} open`, color: '#0ea5e9' },
    { icon: 'today', label: 'Due Today', value: `${t?.dueToday ?? '—'}`, color: '#f59e0b' },
    { icon: 'forward_to_inbox', label: 'Campaigns', value: `${feed?.campaignsPending ?? '—'} queued`, color: '#8b5cf6' },
    { icon: 'shield', label: 'System', value: systemOptimal ? 'Optimal' : `${t?.overdue} overdue`, color: systemOptimal ? '#10b981' : '#f43f5e' },
  ];

  return (
    <div className="max-w-[1360px] mx-auto" style={{ fontFamily: 'inherit' }}>
      <style>{`
        @keyframes jvBlink { 0%,100% { opacity: 1; } 50% { opacity: .2; } }
        @keyframes jvRing { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(1.75); opacity: 0; } }
        @keyframes jvSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes jvSpinR { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes jvGlow { 0%,100% { box-shadow: 0 0 26px var(--orb), inset 0 0 30px rgba(34,211,238,.12); } 50% { box-shadow: 0 0 52px var(--orb), inset 0 0 44px rgba(34,211,238,.2); } }
        @keyframes jvEq { 0%,100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
        .jv-panel { position: relative; background: linear-gradient(168deg, rgba(10,32,54,.92), rgba(6,16,30,.94)); border: 1px solid rgba(34,211,238,.22); border-radius: 10px; }
        .jv-panel::before, .jv-panel::after { content: ''; position: absolute; width: 13px; height: 13px; border: 2px solid rgba(34,211,238,.85); pointer-events: none; }
        .jv-panel::before { top: -1px; left: -1px; border-right: none; border-bottom: none; border-top-left-radius: 8px; }
        .jv-panel::after { bottom: -1px; right: -1px; border-left: none; border-top: none; border-bottom-right-radius: 8px; }
        .jv-title { font-size: 10px; font-weight: 800; letter-spacing: .26em; text-transform: uppercase; color: rgba(103,232,249,.85); font-family: ${MONO}; }
        .jv-chip { font-family: ${MONO}; }
        .jv-eq span { display: inline-block; width: 3px; border-radius: 2px; margin-right: 2px; transform-origin: bottom; }
      `}</style>

      {/* ═══ TOP BAR ═══════════════════════════════════════════════ */}
      <div className="jv-panel px-4 py-2.5 mb-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '2px solid #22d3ee', boxShadow: '0 0 14px rgba(34,211,238,.5)' }}>
            <span className="material-symbols-outlined text-cyan-300" style={{ fontSize: 16 }}>adjust</span>
          </div>
          <div>
            <div className="text-[15px] font-black tracking-[.3em] text-white" style={{ fontFamily: MONO }}>MOTHER</div>
            <div className="text-[7px] font-bold tracking-[.35em] text-cyan-300/60 uppercase">MNA Command Center</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${systemOptimal ? 'rgba(16,185,129,.4)' : 'rgba(244,63,94,.45)'}` }}>
          <span className="jv-title" style={{ letterSpacing: '.18em' }}>System Status</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: systemOptimal ? '#10b981' : '#f43f5e', animation: 'jvBlink 1.4s infinite' }} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: systemOptimal ? '#34d399' : '#fb7185', fontFamily: MONO }}>{systemOptimal ? 'OPTIMAL' : 'ATTENTION'}</span>
        </div>
        <div className="mx-auto text-center">
          <div className="text-[10px] text-white/40 jv-chip">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="text-[22px] font-black text-cyan-300 leading-none tabular-nums" style={{ fontFamily: MONO, textShadow: '0 0 18px rgba(34,211,238,.6)' }}>{clock}</div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full ml-auto" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(34,211,238,.25)' }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
            {(getDisplayName(userEmail) || 'A').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-[10px] font-bold text-white/85 leading-tight">{getDisplayName(userEmail) || 'Operator'}</div>
            <div className="text-[7px] font-bold tracking-[.25em] text-cyan-300/60 uppercase">Commander</div>
          </div>
        </div>
      </div>

      {/* ═══ HERO ROW: core overview · orb · intelligence ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr_300px] gap-3 mb-3">
        {/* AI Core Overview */}
        <div className="jv-panel p-3">
          <div className="jv-title mb-2.5">AI Core Overview</div>
          <div className="space-y-1.5">
            {coreTiles.map((tile) => (
              <div key={tile.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,211,238,.14)' }}>
                <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: tile.color + '1a', border: `1px solid ${tile.color}55` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: tile.color }}>{tile.icon}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white/90 leading-tight">{tile.label}</div>
                  <div className="text-[9px] leading-tight" style={{ color: tile.color, fontFamily: MONO }}>{tile.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The core */}
        <div className="jv-panel flex flex-col items-center justify-center py-6 overflow-hidden relative" style={{ minHeight: 380, background: 'radial-gradient(ellipse at 50% 40%, rgba(14,60,95,.9), rgba(4,12,24,.96) 75%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(103,232,249,.35) 1px, transparent 1px), radial-gradient(rgba(103,232,249,.18) 1px, transparent 1px)', backgroundSize: '90px 90px, 41px 41px', backgroundPosition: '0 0, 20px 30px' }} />
          <button onClick={orbTap} className="relative flex items-center justify-center" style={{ width: 250, height: 250 }} title={statusLine}>
            <span className="absolute inset-0 rounded-full" style={{ border: '1px dashed rgba(34,211,238,.35)', animation: 'jvSpin 22s linear infinite' }} />
            <span className="absolute inset-4 rounded-full" style={{ border: '1px dashed rgba(34,211,238,.25)', animation: 'jvSpinR 15s linear infinite' }} />
            {coreState !== 'offline' && coreState !== 'thinking' && (
              <>
                <span className="absolute inset-8 rounded-full" style={{ border: `2px solid ${orbColor}`, animation: 'jvRing 1.5s ease-out infinite' }} />
                <span className="absolute inset-8 rounded-full" style={{ border: `2px solid ${orbColor}`, animation: 'jvRing 1.5s ease-out .5s infinite' }} />
              </>
            )}
            <span
              className="w-44 h-44 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-300"
              style={{
                background: `radial-gradient(circle at 38% 30%, rgba(34,211,238,${coreState === 'offline' ? '.15' : '.35'}), rgba(6,20,38,.95) 70%)`,
                border: `2px solid ${orbAccent}`,
                opacity: coreState === 'offline' ? 0.75 : 1,
                ['--orb' as any]: orbAccent + (coreState === 'offline' ? '22' : '55'),
                animation: 'jvGlow 2.8s ease-in-out infinite',
              }}
            >
              <span className="text-[19px] font-black tracking-[.42em] text-white pl-1.5" style={{ fontFamily: MONO, textShadow: `0 0 16px ${orbAccent}` }}>MOTHER</span>
              <span className="text-[7px] font-bold tracking-[.4em] uppercase" style={{ color: orbAccent, fontFamily: MONO }}>MNA AI Core</span>
              <span className="material-symbols-outlined mt-1" style={{ fontSize: 22, color: orbAccent }}>
                {coreState === 'online' ? 'graphic_eq' : coreState === 'thinking' ? 'neurology' : coreState === 'speaking' ? 'volume_up' : 'power_settings_new'}
              </span>
            </span>
          </button>
          <div className="text-[10px] font-bold tracking-[.3em] uppercase mt-3 px-4 text-center" style={{ color: orbAccent, fontFamily: MONO }}>{statusLine}</div>
          {coreState !== 'offline' && (
            <div className="text-[8px] text-cyan-200/40 mt-1.5 tracking-wider" style={{ fontFamily: MONO }}>
              Wake word: “Mother” · follow-ups within 15s need no wake word
            </div>
          )}
          {!voiceSupported && <div className="text-[9px] text-amber-300/80 mt-1">Voice needs Chrome or Edge — use the console below.</div>}
        </div>

        {/* Live Intelligence Feed */}
        <div className="jv-panel p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="jv-title">Live Intelligence Feed</div>
            <span className="ml-auto flex items-center gap-1 text-[8px] font-black tracking-widest text-emerald-300" style={{ fontFamily: MONO }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'jvBlink 1.4s infinite' }} />LIVE
            </span>
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {intel.map((item, i) => (
              <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${LEVEL_COLOR[item.level]}33` }}>
                <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: 14, color: LEVEL_COLOR[item.level] }}>{item.icon}</span>
                <span className="text-[10.5px] text-white/85 leading-snug flex-1">{item.text}</span>
                <span className="text-[7px] font-black px-1.5 py-0.5 rounded shrink-0 tracking-widest" style={{ background: LEVEL_COLOR[item.level] + '22', color: LEVEL_COLOR[item.level], fontFamily: MONO }}>{item.level}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-white/25 mt-2 text-right" style={{ fontFamily: MONO }}>
            {feed ? `updated ${new Date(feed.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'syncing…'}
          </div>
        </div>
      </div>

      {/* ═══ ROW 2: team agents · mission timeline · quick commands ═ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="jv-panel p-3">
          <div className="jv-title mb-2.5">Team Agents</div>
          <div className="grid grid-cols-1 gap-1.5">
            {(t?.byMember || []).length === 0 && <div className="text-[10px] text-white/35">Board is clear — no active assignments.</div>}
            {(t?.byMember || []).map((m) => {
              const c = memberColor(m.email);
              const active = m.open > 0;
              return (
                <div key={m.email} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${active ? c + '44' : 'rgba(255,255,255,.08)'}` }}>
                  <span className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: c }}>
                    {memberName(m.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-white/90">{memberName(m.email)}</div>
                    <div className="text-[8px] font-bold tracking-widest uppercase" style={{ color: active ? '#34d399' : 'rgba(255,255,255,.35)', fontFamily: MONO }}>
                      ● {active ? 'Active' : 'Standby'} · {m.open} open{m.overdue > 0 ? ` · ${m.overdue} late` : ''}
                    </div>
                  </div>
                  <span className="jv-eq shrink-0" style={{ height: 16 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} style={{ height: 16, background: active ? c : 'rgba(255,255,255,.15)', animation: active ? `jvEq ${0.8 + i * 0.13}s ease-in-out ${i * 0.1}s infinite` : 'none', transform: active ? undefined : 'scaleY(.25)' }} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="jv-panel p-3">
          <div className="jv-title mb-2.5">Mission Timeline</div>
          {(feed?.schedule || []).length === 0 ? (
            <div className="text-[10px] text-white/35">Nothing scheduled in the next few days.</div>
          ) : (
            <div className="space-y-0.5">
              {(feed?.schedule || []).slice(0, 7).map((ev, i, arr) => (
                <div key={ev.id} className="flex items-center gap-2.5 relative pl-1">
                  <div className="flex flex-col items-center self-stretch">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: '#22d3ee', boxShadow: '0 0 6px rgba(34,211,238,.8)' }} />
                    {i < arr.length - 1 && <span className="w-px flex-1" style={{ background: 'rgba(34,211,238,.25)' }} />}
                  </div>
                  <div className="flex-1 min-w-0 py-1.5">
                    <div className="text-[11px] font-bold text-white/90 truncate">{ev.title}</div>
                    <div className="text-[8.5px] text-cyan-300/60" style={{ fontFamily: MONO }}>
                      {ev.event_date === feed?.today ? 'Today' : fmtDue(ev.event_date)}{ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''} · {untilLabel(ev.event_date, ev.start_time, feed?.today || '')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="jv-panel p-3">
          <div className="jv-title mb-2.5">Quick Commands</div>
          <div className="space-y-1.5">
            {[
              { icon: 'power_settings_new', label: coreState === 'offline' ? 'Bring Mother Online' : 'Take Mother Offline', act: orbTap },
              { icon: 'summarize', label: 'Executive Briefing', act: executiveBriefing },
              { icon: 'assignment_add', label: 'Open Team Tasks', href: '/team-tasks' },
              { icon: 'grid_view', label: 'Content Tracker', href: '/content' },
              { icon: 'calendar_month', label: 'Open Calendar', href: '/schedule' },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                onClick={c.act ? (e) => { e.preventDefault(); c.act!(); } : undefined}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-cyan-400/10 block"
                style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,211,238,.18)' }}
              >
                <span className="material-symbols-outlined text-cyan-300" style={{ fontSize: 16 }}>{c.icon}</span>
                <span className="text-[11px] font-bold text-white/85">{c.label}</span>
                <span className="material-symbols-outlined text-cyan-300/40 ml-auto" style={{ fontSize: 13 }}>chevron_right</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ROW 3: content pipeline · comms log ═══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className="jv-panel p-3">
          <div className="jv-title mb-2.5">Content Pipeline</div>
          {(feed?.content || []).length === 0 ? (
            <div className="text-[10px] text-white/35">No active content calendars.</div>
          ) : (
            <div className="space-y-1.5">
              {(feed?.content || []).map((c) => (
                <div key={c.client_name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,211,238,.14)' }}>
                  <span className="text-[11px] font-bold text-white/90 truncate flex-1">{c.client_name}</span>
                  <span className="text-[8.5px] text-white/45 shrink-0" style={{ fontFamily: MONO }}>next {fmtDue(c.next_post)}</span>
                  <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(34,211,238,.15)', color: '#67e8f9', fontFamily: MONO }}>{c.this_week}/wk</span>
                  {Number(c.pending) > 0 && (
                    <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(245,158,11,.18)', color: '#fcd34d', fontFamily: MONO }}>{c.pending} appr</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="jv-panel p-3 flex flex-col">
          <div className="jv-title mb-2.5">Comms Log</div>
          <div className="flex-1 space-y-1.5 overflow-y-auto min-h-[80px]">
            {!lastHeard && !lastReply && <div className="text-[10px] text-white/30">Bring Mother online and say “Mother, what&apos;s overdue?” — or type a command below.</div>}
            {lastHeard && (
              <div className="text-[10.5px] text-white/60 px-2.5 py-1.5 rounded-lg bg-white/[.04] border border-white/10">
                <span className="text-cyan-300/60 font-black mr-1.5" style={{ fontFamily: MONO }}>YOU ›</span>{lastHeard}
              </div>
            )}
            {lastReply && (
              <div className="text-[11px] text-white/90 px-2.5 py-2 rounded-lg whitespace-pre-wrap max-h-36 overflow-y-auto" style={{ background: 'rgba(34,211,238,.08)', border: '1px solid rgba(34,211,238,.3)' }}>
                <span className="text-cyan-300 font-black mr-1.5" style={{ fontFamily: MONO }}>MOTHER ›</span>{lastReply}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) { void ask(typed); setTyped(''); } }}
              placeholder='"assign Sable…" · "what&apos;s overdue?"'
              className="flex-1 text-[11px] px-3 py-2 rounded-lg bg-white/5 text-white outline-none placeholder:text-white/25"
              style={{ border: '1px solid rgba(34,211,238,.25)', fontFamily: MONO }}
            />
            <button
              onClick={() => { if (typed.trim()) { void ask(typed); setTyped(''); } }}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #22d3ee)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM: talk bar ══════════════════════════════════════ */}
      <div className="jv-panel px-4 py-3 flex items-center gap-4">
        <span className="text-[8.5px] text-white/35 shrink-0 hidden md:flex items-center gap-1.5" style={{ fontFamily: MONO }}>
          {weather && (
            <>
              <span className="material-symbols-outlined text-cyan-300/70" style={{ fontSize: 13 }}>
                {/thunder/i.test(weather.desc) ? 'thunderstorm' : /rain|drizzl|shower/i.test(weather.desc) ? 'rainy' : /snow/i.test(weather.desc) ? 'ac_unit' : /cloud|overcast|fog/i.test(weather.desc) ? 'cloud' : 'sunny'}
              </span>
              <span className="text-cyan-200/70">{Math.round(weather.tempF)}°F {weather.desc}</span>
              <span>· H{Math.round(weather.high)} L{Math.round(weather.low)} ·</span>
            </>
          )}
          {feed?.clientCount ?? '—'} clients · {t?.open ?? '—'} open
        </span>
        <span className="flex-1 flex items-center gap-1 justify-end opacity-50">
          {[...Array(10)].map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-cyan-400/60" style={{ animation: coreState !== 'offline' ? `jvBlink ${0.6 + (i % 4) * 0.2}s infinite` : 'none' }} />)}
        </span>
        <button
          onClick={orbTap}
          className="flex items-center gap-3 px-8 py-3 rounded-full shrink-0 transition-all"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(34,211,238,.22), rgba(8,22,40,.95))',
            border: `2px solid ${orbAccent}`,
            boxShadow: `0 0 22px ${orbAccent}55`,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: orbAccent }}>
            {coreState === 'online' ? 'graphic_eq' : coreState === 'speaking' ? 'volume_up' : coreState === 'thinking' ? 'neurology' : 'power_settings_new'}
          </span>
          <span className="text-left">
            <span className="block text-[13px] font-black tracking-[.22em] text-white" style={{ fontFamily: MONO }}>
              {coreState === 'offline' ? 'ACTIVATE MOTHER' : 'MOTHER ONLINE'}
            </span>
            <span className="block text-[8px] font-bold tracking-[.28em] uppercase" style={{ color: orbAccent, fontFamily: MONO }}>{statusLine}</span>
          </span>
        </button>
        <span className="flex-1 flex items-center gap-1 opacity-50">
          {[...Array(10)].map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-cyan-400/60" style={{ animation: coreState !== 'offline' ? `jvBlink ${0.6 + (i % 4) * 0.2}s infinite` : 'none' }} />)}
        </span>
        <button
          onClick={executiveBriefing}
          className="text-[10px] font-black tracking-widest px-4 py-2.5 rounded-lg shrink-0 text-cyan-200 hover:text-white transition-colors uppercase hidden md:block"
          style={{ background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.35)', fontFamily: MONO }}
        >
          Executive Briefing
        </button>
      </div>
    </div>
  );
}
