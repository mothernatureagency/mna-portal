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

  const recognitionRef = useRef<any>(null);
  const bufferRef = useRef<string>('');         // un-analyzed text since last API call
  const earlierRef = useRef<string>('');        // older transcript, sent as context summary
  const lastSentAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const wantsListeningRef = useRef<boolean>(false);

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
    const recent = bufferRef.current.trim();
    if (recent.length < 30) return;
    inFlightRef.current = true;
    setThinking(true);
    try {
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
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + ' ';
      }
      if (finalChunk) {
        setTranscript((prev) => (prev + ' ' + finalChunk).trim());
        bufferRef.current += ' ' + finalChunk;
        // Fire analyze if we have enough text OR enough time has passed
        const since = Date.now() - lastSentAtRef.current;
        if (bufferRef.current.length > 180 || since > 8000) analyze();
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

  function stop() {
    wantsListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }

  function clearAll() {
    setTranscript('');
    setSignals([]);
    earlierRef.current = '';
    bufferRef.current = '';
    setStartedAt(null);
    setError('');
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
            Quiet, glanceable signals during live calls — objections, buying cues, what to say next.
          </p>
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
            onClick={clearAll}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white border border-white/10"
          >
            Clear
          </button>
        </div>
      </div>

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

        {/* Right: signals */}
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
