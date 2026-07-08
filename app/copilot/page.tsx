'use client';

/**
 * Live Call Copilot — quiet, glanceable signals during real-time business
 * calls. Uses the browser SpeechRecognition API for transcription (Chrome
 * works best; Firefox/Safari support is partial), throttled chunks are sent
 * to /api/copilot which returns tagged cards.
 *
 * MVP capture path: microphone only. For the other party's voice, put the
 * mic near a speaker OR share a Chrome tab with audio (planned follow-up).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Signal = {
  id: string;
  type: string;
  lines: string[];
  receivedAt: number;
};

type SavedSessionMeta = {
  id: string;
  title: string | null;
  client_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  cue_count: number;
};

type SavedSession = SavedSessionMeta & {
  transcript: string | null;
  signals: Signal[];
};

// One interpreted exchange in Spanish<->English interpreter mode.
type Interp = {
  id: string;
  detected: 'es' | 'en' | 'other';
  original: string;
  translation: string;
  targetLang: 'es' | 'en';
  sayNext: string;
  sayNextGloss: string;
  at: number;
};

// Speak text aloud as "Mother Nature" using the browser's speech synthesis,
// picking the best available voice for the target language.
function speakAloud(text: string, lang: 'es' | 'en') {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'es' ? 'es-US' : 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const pool = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(lang));
    const preferred =
      pool.find((v) => /female|paulina|mónica|monica|samantha|google|luciana|helena/i.test(v.name)) || pool[0];
    if (preferred) u.voice = preferred;
    u.rate = 1; u.pitch = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

const SIGNAL_STYLES: Record<string, { bg: string; border: string; text: string; accent: string; icon: string }> = {
  'BUYING SIGNAL':   { bg: 'rgba(16,185,129,0.10)', border: 'rgba(52,211,153,0.45)', text: '#a7f3d0', accent: '#10b981', icon: 'trending_up' },
  'OBJECTION':       { bg: 'rgba(245,158,11,0.10)', border: 'rgba(251,191,36,0.45)', text: '#fde68a', accent: '#f59e0b', icon: 'report' },
  'INTEREST':        { bg: 'rgba(16,185,129,0.08)', border: 'rgba(52,211,153,0.30)', text: '#bbf7d0', accent: '#22c55e', icon: 'favorite' },
  'SKEPTICISM':      { bg: 'rgba(249,115,22,0.10)', border: 'rgba(251,146,60,0.45)', text: '#fed7aa', accent: '#f97316', icon: 'help' },
  'RESPONSE':        { bg: 'rgba(14,165,233,0.10)', border: 'rgba(56,189,248,0.45)', text: '#bae6fd', accent: '#0ea5e9', icon: 'record_voice_over' },
  'QUESTION TO ASK': { bg: 'rgba(139,92,246,0.10)', border: 'rgba(167,139,250,0.45)', text: '#ddd6fe', accent: '#8b5cf6', icon: 'help_outline' },
  'WARNING':         { bg: 'rgba(244,63,94,0.10)', border: 'rgba(251,113,133,0.45)', text: '#fecdd3', accent: '#f43f5e', icon: 'warning' },
  'PAUSE':           { bg: 'rgba(59,130,246,0.10)', border: 'rgba(96,165,250,0.45)', text: '#bfdbfe', accent: '#3b82f6', icon: 'pause_circle' },
  'CLOSE':           { bg: 'rgba(234,179,8,0.10)',  border: 'rgba(250,204,21,0.45)', text: '#fef08a', accent: '#eab308', icon: 'flag' },
  'SHIFT TOPIC':     { bg: 'rgba(148,163,184,0.10)',border: 'rgba(203,213,225,0.45)',text: '#e2e8f0', accent: '#94a3b8', icon: 'swap_horiz' },
};

function styleFor(type: string) {
  return SIGNAL_STYLES[type] || SIGNAL_STYLES['RESPONSE'];
}

function fmtElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CopilotPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string>('');
  const [thinking, setThinking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Interpreter mode (Spanish <-> English) + Mother Nature voice
  const [mode, setMode] = useState<'sales' | 'interpret'>('sales');
  const [mnVoice, setMnVoice] = useState(false);
  const [listenLang, setListenLang] = useState<'es-US' | 'en-US'>('es-US');
  const [interps, setInterps] = useState<Interp[]>([]);
  const modeRef = useRef<'sales' | 'interpret'>('sales');
  const mnVoiceRef = useRef(false);
  const listenLangRef = useRef<'es-US' | 'en-US'>('es-US');
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { mnVoiceRef.current = mnVoice; }, [mnVoice]);
  useEffect(() => { listenLangRef.current = listenLang; }, [listenLang]);
  // Warm up the speech-synthesis voice list (some browsers load it lazily).
  useEffect(() => { try { window.speechSynthesis?.getVoices(); } catch {} }, []);

  // Saving / saved-session review
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [sessions, setSessions] = useState<SavedSessionMeta[]>([]);
  const [openSession, setOpenSession] = useState<SavedSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const recognitionRef = useRef<any>(null);
  const bufferRef = useRef<string>('');         // un-analyzed text since last API call
  const earlierRef = useRef<string>('');        // older transcript, sent as context summary
  const lastSentAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const wantsListeningRef = useRef<boolean>(false);
  // Full chronological cue history for the current session. `signals` (above)
  // is capped at 8 for a glanceable display; this keeps every cue so the
  // saved session has the complete record.
  const allSignalsRef = useRef<Signal[]>([]);
  const transcriptRef = useRef<string>('');     // mirror of transcript for save-on-stop
  const savedRef = useRef<boolean>(false);      // current session already persisted?

  // Detect SpeechRecognition support
  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSupported(!!SR);
  }, []);

  // Tick clock for the elapsed timer while listening
  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [listening]);

  const analyze = useCallback(async () => {
    if (inFlightRef.current) return;
    const interpret = modeRef.current === 'interpret';
    const recent = bufferRef.current.trim();
    if (recent.length < (interpret ? 10 : 30)) return;
    inFlightRef.current = true;
    setThinking(true);
    try {
      if (interpret) {
        // Interpreter mode — translate the snippet and optionally speak it.
        const res = await fetch('/api/copilot/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recent }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Translate failed');
        earlierRef.current = (earlierRef.current + ' ' + recent).slice(-4000);
        bufferRef.current = '';
        lastSentAtRef.current = Date.now();
        if (d.translation || d.sayNext) {
          const item: Interp = {
            id: `${Date.now()}`,
            detected: d.detected || 'other',
            original: d.original || recent,
            translation: d.translation || '',
            targetLang: d.targetLang === 'es' ? 'es' : 'en',
            sayNext: d.sayNext || '',
            sayNextGloss: d.sayNextGloss || '',
            at: Date.now(),
          };
          setInterps((prev) => [item, ...prev].slice(0, 12));
          savedRef.current = false;
          if (mnVoiceRef.current && item.translation) speakAloud(item.translation, item.targetLang);
        }
        return;
      }

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recent,
          conversationSoFar: earlierRef.current.slice(-2000),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Copilot failed');
      // Roll the analyzed text into the older context buffer
      earlierRef.current = (earlierRef.current + ' ' + recent).slice(-4000);
      bufferRef.current = '';
      lastSentAtRef.current = Date.now();
      const newSignals: Signal[] = (data.signals || []).map((s: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        type: String(s.type || 'RESPONSE'),
        lines: Array.isArray(s.lines) ? s.lines : [],
        receivedAt: Date.now(),
      }));
      if (newSignals.length > 0) {
        setSignals((prev) => [...newSignals, ...prev].slice(0, 8));
        // Keep the full chronological history for the saved session.
        allSignalsRef.current.push(...newSignals);
        savedRef.current = false; // new cues → session has unsaved changes
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      inFlightRef.current = false;
      setThinking(false);
    }
  }, []);

  function start() {
    setError('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('SpeechRecognition not supported in this browser. Use Chrome.'); return; }
    const rec = new SR();
    // In interpreter mode, listen in the language currently being spoken so
    // the recognizer transcribes it accurately; sales mode is English.
    rec.lang = modeRef.current === 'interpret' ? listenLangRef.current : 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + ' ';
      }
      if (finalChunk) {
        setTranscript((prev) => {
          const next = (prev + ' ' + finalChunk).trim();
          transcriptRef.current = next;
          return next;
        });
        savedRef.current = false; // new transcript → unsaved changes
        bufferRef.current += ' ' + finalChunk;
        // Fire analyze if we have enough text OR enough time has passed.
        // Interpreter mode reacts faster (shorter turns) than sales mode.
        const interpret = modeRef.current === 'interpret';
        const since = Date.now() - lastSentAtRef.current;
        if (bufferRef.current.length > (interpret ? 60 : 180) || since > (interpret ? 3500 : 8000)) analyze();
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech') return;            // benign
      if (e.error === 'aborted') return;              // stop() path
      setError(`Mic error: ${e.error || 'unknown'}`);
    };
    rec.onend = () => {
      // Auto-restart while the user still wants to listen — recognition
      // ends on its own after long silences in some browsers.
      if (wantsListeningRef.current) {
        try { rec.start(); } catch { /* ignore double-start */ }
      } else {
        setListening(false);
      }
    };

    wantsListeningRef.current = true;
    try { rec.start(); } catch (err: any) { setError(err?.message || 'Could not start mic'); return; }
    recognitionRef.current = rec;
    setListening(true);
    if (!startedAt) setStartedAt(Date.now());
  }

  // Recreate the recognizer (e.g. to apply a new listen language) without
  // ending/saving the session. Detach the old onend so it doesn't auto-restart.
  function restartListening() {
    const old = recognitionRef.current;
    if (old) { try { old.onend = null; old.stop(); } catch {} }
    setTimeout(() => start(), 200);
  }

  function applyMode(m: 'sales' | 'interpret') {
    setMode(m);
    modeRef.current = m;
    if (listening) restartListening();
  }

  function applyListenLang(l: 'es-US' | 'en-US') {
    setListenLang(l);
    listenLangRef.current = l;
    if (listening && modeRef.current === 'interpret') restartListening();
  }

  const saveSession = useCallback(async (opts?: { silent?: boolean }) => {
    const transcript = transcriptRef.current.trim();
    const cues = allSignalsRef.current;
    if (!transcript && cues.length === 0) {
      if (!opts?.silent) setSaveMsg('Nothing to save yet');
      return;
    }
    if (savedRef.current) {
      if (!opts?.silent) setSaveMsg('Already saved');
      return;
    }
    setSaving(true);
    if (!opts?.silent) setSaveMsg('');
    try {
      const now = new Date();
      const defaultTitle = `Call · ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      const res = await fetch('/api/copilot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: defaultTitle,
          transcript,
          signals: cues,
          startedAt: startedAt ? new Date(startedAt).toISOString() : null,
          endedAt: now.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      savedRef.current = true;
      setSaveMsg('Saved — review under Saved sessions');
      // Refresh the list if it's open so the new session shows up.
      if (showSaved) loadSessions();
    } catch (e: any) {
      setSaveMsg(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [startedAt, showSaved]);

  function stop() {
    wantsListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    // Auto-save the session so the transcript + cues don't disappear.
    saveSession({ silent: true });
  }

  function clearAll() {
    setTranscript('');
    setSignals([]);
    setInterps([]);
    try { window.speechSynthesis?.cancel(); } catch {}
    earlierRef.current = '';
    bufferRef.current = '';
    transcriptRef.current = '';
    allSignalsRef.current = [];
    savedRef.current = false;
    setStartedAt(null);
    setError('');
    setSaveMsg('');
  }

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/sessions');
      const data = await res.json();
      if (res.ok) setSessions(data.sessions || []);
    } catch {}
  }, []);

  const openSessionById = useCallback(async (id: string) => {
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/copilot/sessions?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok) {
        const s = data.session;
        setOpenSession({
          ...s,
          signals: Array.isArray(s.signals) ? s.signals : [],
        });
      }
    } catch {} finally {
      setLoadingSession(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/copilot/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setOpenSession((cur) => (cur && cur.id === id ? null : cur));
    } catch {}
  }, []);

  function toggleSaved() {
    setShowSaved((v) => {
      const next = !v;
      if (next) loadSessions();
      return next;
    });
  }

  // Stop recognition on unmount
  useEffect(() => () => { wantsListeningRef.current = false; try { recognitionRef.current?.stop(); } catch {} }, []);

  const elapsed = useMemo(() => startedAt ? Date.now() - startedAt : 0, [startedAt, tick]);

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>graphic_eq</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Call Copilot</h1>
            {listening && (
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(244,63,94,0.15)', color: '#fca5a5' }}>
                <span className="relative inline-flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ background: '#f43f5e' }} />
                  <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: '#f43f5e' }} />
                </span>
                Listening
              </span>
            )}
          </div>
          <p className="text-white/60 mt-1 text-sm">
            {mode === 'sales'
              ? 'Quiet, glanceable signals during live calls — objections, buying cues, what to say next.'
              : 'Live Spanish ⇄ English interpreter. Mother Nature can speak the translation aloud so you go back and forth.'}
          </p>

          {/* Mode + interpreter controls */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="inline-flex rounded-xl overflow-hidden border border-white/10">
              <button
                onClick={() => applyMode('sales')}
                className={`text-[11px] font-bold px-3 py-1.5 inline-flex items-center gap-1.5 ${mode === 'sales' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>trending_up</span>
                Sales copilot
              </button>
              <button
                onClick={() => applyMode('interpret')}
                className={`text-[11px] font-bold px-3 py-1.5 inline-flex items-center gap-1.5 ${mode === 'interpret' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>translate</span>
                Interpreter (ES⇄EN)
              </button>
            </div>

            {mode === 'interpret' && (
              <>
                <button
                  onClick={() => setMnVoice((v) => { const nv = !v; if (!nv) { try { window.speechSynthesis?.cancel(); } catch {} } return nv; })}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${mnVoice ? 'text-emerald-200 border-emerald-400/40 bg-emerald-500/15' : 'text-white/55 border-white/10 bg-white/5 hover:text-white/80'}`}
                  title="Mother Nature speaks the translation aloud"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{mnVoice ? 'volume_up' : 'volume_off'}</span>
                  Mother Nature voice {mnVoice ? 'on' : 'off'}
                </button>
                <div className="inline-flex items-center gap-1 text-[10px] text-white/45">
                  <span className="uppercase tracking-wider font-bold">Listening for</span>
                  <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
                    <button
                      onClick={() => applyListenLang('es-US')}
                      className={`px-2 py-1 font-bold ${listenLang === 'es-US' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >Español</button>
                    <button
                      onClick={() => applyListenLang('en-US')}
                      className={`px-2 py-1 font-bold ${listenLang === 'en-US' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >English</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {startedAt && (
            <span className="text-[12px] text-white/55 font-mono tabular-nums px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              {fmtElapsed(elapsed)}
            </span>
          )}
          {!listening ? (
            <button
              onClick={start}
              disabled={supported === false}
              className="text-[13px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mic</span>
              Start Listening
            </button>
          ) : (
            <button
              onClick={stop}
              className="text-[13px] font-bold px-4 py-2 rounded-xl text-white inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #be123c, #f43f5e)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop_circle</span>
              Stop
            </button>
          )}
          <button
            onClick={() => saveSession()}
            disabled={saving}
            className="text-[12px] font-bold px-3 py-2 rounded-xl text-white border border-white/10 disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(16,185,129,0.18)' }}
            title="Save this session's transcript + cues"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={toggleSaved}
            className={`text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/10 inline-flex items-center gap-1.5 ${showSaved ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:text-white'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
            Saved sessions
          </button>
          <button
            onClick={clearAll}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white border border-white/10"
          >
            Clear
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="text-[12px] text-emerald-200/90 -mt-2">{saveMsg}</div>
      )}

      {supported === false && (
        <div className="glass-card p-4 text-amber-200 text-sm" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.4)' }}>
          This browser doesn’t support SpeechRecognition. Use <b>Google Chrome</b> for live transcription.
        </div>
      )}

      {error && (
        <div className="glass-card p-3 text-rose-200 text-sm" style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.3)' }}>
          {error}
        </div>
      )}

      {/* Saved sessions */}
      {showSaved && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Saved sessions</div>
            <button onClick={loadSessions} className="text-[11px] text-white/50 hover:text-white inline-flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>Refresh
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-[13px] text-white/45 py-4 text-center">
              No saved sessions yet. Hit <b className="text-white/70">Stop</b> or <b className="text-white/70">Save</b> during a call to keep the transcript and cues.
            </div>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((s) => {
                const when = new Date(s.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <button onClick={() => openSessionById(s.id)} className="flex-1 text-left min-w-0">
                      <div className="text-[13px] font-semibold text-white truncate">{s.title || 'Untitled session'}</div>
                      <div className="text-[11px] text-white/45">{when} · {s.cue_count} cue{s.cue_count === 1 ? '' : 's'}</div>
                    </button>
                    <button onClick={() => openSessionById(s.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-white/80 hover:text-white">Review</button>
                    <button onClick={() => deleteSession(s.id)} className="text-white/35 hover:text-rose-300" title="Delete">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved-session detail modal */}
      {openSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpenSession(null)}>
          <div
            className="glass-card w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            style={{ background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-white truncate">{openSession.title || 'Untitled session'}</div>
                <div className="text-[11px] text-white/45">
                  {new Date(openSession.created_at).toLocaleString()} · {openSession.signals.length} cue{openSession.signals.length === 1 ? '' : 's'}
                </div>
              </div>
              <button onClick={() => setOpenSession(null)} className="text-white/50 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1.5">Transcript</div>
                <div className="rounded-xl p-3 text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {openSession.transcript || <span className="text-white/35">No transcript captured.</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1.5">Cues given</div>
                <div className="space-y-2">
                  {openSession.signals.length === 0 && <div className="text-[13px] text-white/35">No cues captured.</div>}
                  {openSession.signals.map((s, i) => {
                    const st = styleFor(s.type);
                    return (
                      <div key={s.id || i} className="rounded-xl p-3" style={{ background: st.bg, border: `1px solid ${st.border}`, borderLeft: `4px solid ${st.accent}` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: st.accent }}>{st.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: st.text }}>{s.type}</span>
                        </div>
                        <div className="space-y-0.5">
                          {(s.lines || []).map((l, j) => (
                            <div key={j} className="text-[13px] leading-snug text-white">{l}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingSession && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="glass-card px-5 py-3 text-white/80 text-sm">Loading session…</div>
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4">
        {/* Left: live transcript */}
        <div className="glass-card p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Live transcript</div>
            <div className="text-[10px] text-white/40">{thinking ? 'Analyzing…' : 'Mic only · put it near the call speaker'}</div>
          </div>
          <div
            className="flex-1 overflow-y-auto rounded-xl p-3 text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {transcript || <span className="text-white/35">Nothing yet — hit Start Listening, then speak. The other party’s voice picks up if the mic can hear it.</span>}
          </div>
        </div>

        {/* Right: interpreter (interpret mode) or sales signals */}
        {mode === 'interpret' ? (
          <div className="flex flex-col gap-3">
            {interps.length === 0 && (
              <div className="glass-card p-6 text-center text-white/55 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="material-symbols-outlined block mb-2" style={{ fontSize: 36, color: '#4ab8ce', opacity: 0.6 }}>translate</span>
                <div className="font-bold text-white/80">Translations will appear here</div>
                <p className="text-[11px] text-white/55 max-w-sm mx-auto mt-1">
                  Set <b>Listening for</b> to whoever is talking. Each turn is translated to the other language.
                  Turn on <b>Mother Nature voice</b> to have the translation spoken aloud so you can go back and forth.
                </p>
              </div>
            )}
            {interps.map((it) => (
              <div key={it.id} className="rounded-2xl p-4" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(56,189,248,0.35)', borderLeft: '4px solid #0ea5e9', animation: 'mna-fade-up 280ms ease-out' }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-200">
                    {it.detected === 'es' ? 'Heard · Español' : it.detected === 'en' ? 'Heard · English' : 'Heard'}
                    {' → '}
                    {it.targetLang === 'es' ? 'Español' : 'English'}
                  </span>
                  <button
                    onClick={() => speakAloud(it.translation, it.targetLang)}
                    className="text-white/50 hover:text-white inline-flex items-center gap-1 text-[10px] font-semibold"
                    title="Speak translation"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>volume_up</span>
                    Speak
                  </button>
                </div>
                {it.original && <div className="text-[11px] text-white/45 italic mb-1">“{it.original}”</div>}
                <div className="text-[15px] leading-snug text-white font-semibold">{it.translation}</div>
                {it.sayNext && (
                  <div className="mt-2 rounded-lg p-2.5" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(52,211,153,0.3)' }}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70">Say next</span>
                      <button
                        onClick={() => speakAloud(it.sayNext, it.detected === 'en' ? 'en' : 'es')}
                        className="text-emerald-300/70 hover:text-emerald-200 inline-flex items-center gap-1 text-[10px] font-semibold"
                        title="Speak this reply"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>volume_up</span>
                        Speak
                      </button>
                    </div>
                    <div className="text-[13px] text-emerald-100 leading-snug">{it.sayNext}</div>
                    {it.sayNextGloss && <div className="text-[10px] text-white/40 mt-0.5">{it.sayNextGloss}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {signals.length === 0 && (
              <div
                className="glass-card p-6 text-center text-white/55 text-sm"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <span className="material-symbols-outlined block mb-2" style={{ fontSize: 36, color: '#4ab8ce', opacity: 0.6 }}>auto_awesome</span>
                <div className="font-bold text-white/80">Cues will appear here</div>
                <p className="text-[11px] text-white/55 max-w-sm mx-auto mt-1">
                  Buying signals · objections · what to say next · questions to ask · when to pause or close.
                </p>
              </div>
            )}
            {signals.map((s) => {
              const st = styleFor(s.type);
              return (
                <div
                  key={s.id}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: st.bg,
                    border: `1px solid ${st.border}`,
                    borderLeft: `4px solid ${st.accent}`,
                    animation: 'mna-fade-up 280ms ease-out',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: st.accent }}>{st.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: st.text }}>
                      {s.type}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {s.lines.map((l, i) => (
                      <div key={i} className="text-[14px] leading-snug text-white">{l}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes mna-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
