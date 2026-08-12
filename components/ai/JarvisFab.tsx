'use client';

/**
 * Mother Nature — floating JARVIS-style assistant.
 *
 * The glowing Earth orb sits bottom-right. Clicking the world pops up the
 * Mother Nature chat panel: type or talk, and she answers in the panel
 * (and out loud for voice turns). She can add schedule events, check the
 * calendar, remember things, and navigate the portal.
 *
 * Orb moods: idle · listening (white pulse) · thinking · speaking (blue ripples)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useVoiceRecognition, speak, cancelSpeak, sanitizeForDisplay } from '@/lib/voice';

const NAV_PHRASES: { match: RegExp; path: string; label: string }[] = [
  { match: /open (?:the )?content calendar|show (?:me )?content/i, path: '/content-calendar', label: 'content calendar' },
  { match: /open (?:the )?task(?:s| manager)|show (?:me )?(?:my )?tasks/i, path: '/client-tasks', label: 'tasks' },
  { match: /(?:go (?:to )?)?(?:the )?home|dashboard/i, path: '/', label: 'home' },
  { match: /open (?:the )?pipeline|show (?:me )?crm/i, path: '/pipeline', label: 'pipeline' },
  { match: /open (?:the )?email (?:preview|drafts?)/i, path: '/email-preview', label: 'email preview' },
  { match: /open (?:the )?(?:meta )?ads?|show (?:me )?ads?/i, path: '/meta-ads-live', label: 'meta ads' },
  { match: /open (?:the )?ai (?:agents?|assistant)/i, path: '/agents/ai', label: 'AI agents' },
];

type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';
type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * Holographic Mother Nature — a projected nature-goddess figure. Pure SVG +
 * CSS: silhouette with flowing hair and a leaf crown, hologram scanlines,
 * flicker, a projector beam rising from the emitter base, and drifting
 * leaves. Glow intensity follows the assistant's mode.
 */
/**
 * Image-based Mother Nature hologram. Uses /hologram/goddess.png (drop the
 * artwork there) with animated eyelids that blink and a mouth that moves while
 * she speaks. Falls back to the SVG hologram if the image isn't present.
 * Eye/mouth positions are CSS variables so they can be nudged to fit the art.
 */
function GoddessHologram({ mode }: { mode: Mode }) {
  const [imgOk, setImgOk] = useState(true);
  const [hasClosed, setHasClosed] = useState(true); // goddess-closed.png present?
  if (!imgOk) return <MotherNatureHologram mode={mode} />;
  return (
    <div className={`goddess ${mode === 'speaking' ? 'speaking' : ''}`}>
      <div className="goddess-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hologram/goddess.png" alt="" className="goddess-img base" draggable={false} onError={() => setImgOk(false)} />
        {/* Real blink: a closed-eyes frame cross-fades in for a split second.
            If goddess-closed.png isn't uploaded, she just rests with open eyes. */}
        {hasClosed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/hologram/goddess-closed.png" alt="" className="goddess-img blink" draggable={false} onError={() => setHasClosed(false)} />
        )}
        <div className="goddess-scan" />
        <div className="goddess-glow" />
      </div>
    </div>
  );
}

function MotherNatureHologram({ mode }: { mode: Mode }) {
  const hot = mode === 'speaking' || mode === 'listening';
  const glow = hot
    ? 'drop-shadow(0 0 8px rgba(140,255,225,0.95)) drop-shadow(0 0 22px rgba(74,230,200,0.7)) drop-shadow(0 0 48px rgba(74,184,206,0.5))'
    : 'drop-shadow(0 0 6px rgba(140,255,225,0.7)) drop-shadow(0 0 18px rgba(74,230,200,0.45)) drop-shadow(0 0 40px rgba(74,184,206,0.3))';
  return (
    <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
      {/* Projector beam — cone of light widening up from the emitter */}
      <div
        className="absolute holo-flicker"
        style={{
          left: '50%', bottom: 6, transform: 'translateX(-50%)',
          width: '78%', height: '88%',
          clipPath: 'polygon(42% 100%, 58% 100%, 96% 0%, 4% 0%)',
          background: 'linear-gradient(to top, rgba(120,255,220,0.35), rgba(120,255,220,0.1) 55%, rgba(120,255,220,0.02))',
        }}
      />
      {/* The goddess */}
      <div
        className="absolute holo-flicker holo-bob"
        style={{ left: '50%', bottom: 12, transform: 'translateX(-50%)', width: 118, height: 138, filter: glow, opacity: hot ? 1 : 0.92 }}
      >
        <svg viewBox="0 0 200 240" width="100%" height="100%" aria-hidden>
          <defs>
            <linearGradient id="mn-holo-skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9fff0" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#7de8d0" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4ab8ce" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="mn-holo-hair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5fe8c0" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#2fb9a8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#0c6da4" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="mn-holo-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8df0d8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0c6da4" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="mn-holo-leaf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b8ffdf" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#2dd4a0" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Flowing hair falling on both sides */}
          <path
            fill="url(#mn-holo-hair)"
            d="M100 16 C60 16 42 46 44 80 C46 110 58 130 50 158 C45 175 34 187 24 195 C54 203 76 192 84 172 L84 96 C80 88 78 78 79 66 C81 44 89 34 100 34 C111 34 119 44 121 66 C122 78 120 88 116 96 L116 172 C124 192 146 203 176 195 C166 187 155 175 150 158 C142 130 154 110 156 80 C158 46 140 16 100 16 Z"
          />
          {/* Face */}
          <ellipse cx="100" cy="74" rx="24" ry="30" fill="url(#mn-holo-skin)" />
          {/* Serene closed eyes + soft smile */}
          <g stroke="rgba(10,60,70,0.55)" strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M86 72 Q91 77 96 72" />
            <path d="M104 72 Q109 77 114 72" />
            <path d="M94 92 Q100 97 106 92" />
          </g>
          {/* Neck + shoulders/bust */}
          <path
            fill="url(#mn-holo-body)"
            d="M92 100 L92 116 C78 118 64 128 55 142 C46 156 41 171 40 188 L160 188 C159 171 154 156 145 142 C136 128 122 118 108 116 L108 100 C104 104 96 104 92 100 Z"
          />
          {/* Leaves woven into the hair tips — subtle, no crown */}
          <g fill="url(#mn-holo-leaf)" opacity="0.85">
            <path d="M36 176 C28 168 16 168 10 176 C18 184 30 184 36 176 Z" />
            <path d="M164 176 C172 168 184 168 190 176 C182 184 170 184 164 176 Z" />
            <path d="M52 130 C46 122 36 120 30 126 C36 134 46 136 52 130 Z" />
            <path d="M148 130 C154 122 164 120 170 126 C164 134 154 136 148 130 Z" />
          </g>
        </svg>
      </div>

      {/* Drifting leaves rising through the projection */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute holo-leaf"
          style={{
            left: `${30 + i * 20}%`, bottom: 18,
            width: 9, height: 9,
            animationDelay: `${i * 1.6}s`,
            background: 'radial-gradient(ellipse at 30% 30%, rgba(184,255,223,0.95), rgba(45,212,160,0.55))',
            clipPath: 'polygon(50% 0%, 95% 40%, 50% 100%, 5% 40%)',
          }}
        />
      ))}

      {/* Hologram scanlines + moving scan bar */}
      <div
        className="absolute inset-0"
        style={{ background: 'repeating-linear-gradient(0deg, rgba(140,255,230,0.07) 0px, rgba(140,255,230,0.07) 1px, transparent 1px, transparent 3px)' }}
      />
      <div
        className="absolute left-0 right-0 holo-scanbar"
        style={{ height: 22, background: 'linear-gradient(to bottom, transparent, rgba(160,255,235,0.14), transparent)' }}
      />

      {/* Emitter base — the light source she's projected from */}
      <div
        className="absolute"
        style={{
          left: '50%', bottom: 4, transform: 'translateX(-50%)',
          width: 110, height: 10, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(160,255,235,0.9), rgba(74,184,206,0.35) 60%, transparent 75%)',
          boxShadow: '0 0 18px rgba(120,255,220,0.8), 0 0 40px rgba(74,184,206,0.5)',
          filter: 'blur(0.5px)',
        }}
      />
    </div>
  );
}

const GREETING: Msg = {
  role: 'assistant',
  content: "Hi, I'm Mother Nature 🌿 Ask me anything — I can check your schedule, add tasks and meetings, remember things for you, or open any page. Type below or tap the mic to talk.",
};

export default function JarvisFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>('idle');
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const speakingTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const msgsRef = useRef<Msg[]>(msgs);
  msgsRef.current = msgs;

  function scheduleIdle(ms: number) {
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = window.setTimeout(() => setMode('idle'), ms);
  }

  // Speak in a natural ElevenLabs voice (Rachel), slower + calmer. Optionally
  // start listening once she finishes (so the mic never fights her audio).
  const MOTHER_VOICE = '21m00Tcm4TlvDq8ikWAM';
  const startListenRef = useRef<(() => void) | null>(null);
  const speakHer = useCallback(async (text: string, thenListen = false) => {
    const clean = sanitizeForDisplay(text) || text;
    try { audioRef.current?.pause(); } catch {}
    try { cancelSpeak(); } catch {}
    setMode('speaking');
    const listenAfter = () => { if (thenListen) window.setTimeout(() => { try { startListenRef.current?.(); } catch {} }, 300); };
    try {
      const res = await fetch('/api/video-projects/voiceover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: clean.slice(0, 900), voiceId: MOTHER_VOICE, speed: 0.85, stability: 0.6, style: 0.15 }),
      });
      if (!res.ok) throw new Error('tts');
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setMode('idle'); URL.revokeObjectURL(url); listenAfter(); };
      a.onerror = () => { setMode('idle'); listenAfter(); };
      await a.play();
    } catch {
      speak(clean); // browser fallback if the key/endpoint isn't available
      if (thenListen) window.setTimeout(listenAfter, Math.min(9000, 1200 + clean.length * 55));
    }
  }, []);

  const handleSend = useCallback(async (raw: string, viaVoice: boolean) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: text }]);

    // Voice/typed navigation shortcuts ("open the pipeline")
    const nav = NAV_PHRASES.find((n) => n.match.test(text));
    if (nav) {
      const reply = `Opening the ${nav.label}.`;
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
      if (viaVoice) { speakHer(reply); }
      router.push(nav.path);
      scheduleIdle(1500);
      return;
    }

    setBusy(true);
    setMode('thinking');
    try {
      // Send the recent turns (minus the canned greeting) for multi-turn context.
      const history = [...msgsRef.current.filter((m) => m !== GREETING), { role: 'user' as const, content: text }].slice(-12);
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: { page: pathname || '/' } }),
      });
      const data = await res.json();
      const reply = data?.reply || data?.message || data?.content || '';
      if (reply) {
        const displayed = sanitizeForDisplay(reply) || reply;
        setMsgs((m) => [...m, { role: 'assistant', content: displayed }]);
        if (viaVoice) {
          speakHer(reply, true); // speak, then listen again for a natural back-and-forth
        } else {
          setMode('idle');
        }
      } else {
        setMsgs((m) => [...m, { role: 'assistant', content: data?.error || "I didn't catch that — try rephrasing?" }]);
        setMode('idle');
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Something went wrong reaching the assistant — try again in a moment.' }]);
      setMode('idle');
    } finally {
      setBusy(false);
    }
  }, [busy, pathname, router]);

  const onVoiceFinal = useCallback((text: string) => { handleSend(text, true); }, [handleSend]);

  // One utterance per mic tap — the transcript lands in the chat as a message.
  const { supported, listening, transcript, start, stop } = useVoiceRecognition({
    onFinalResult: onVoiceFinal,
    continuous: false,
  });
  // Let speakHer() trigger listening once she finishes talking.
  useEffect(() => { startListenRef.current = () => { try { audioRef.current?.pause(); } catch {} start(); }; }, [start]);

  // Orb pulses in sync with any speech playing anywhere in the app.
  useEffect(() => {
    function onStart() { setMode('speaking'); }
    function onEnd() {
      setMode((current) => (current === 'speaking' && !listening ? 'idle' : current));
    }
    window.addEventListener('mn-speech-start', onStart);
    window.addEventListener('mn-speech-end', onEnd);
    return () => {
      window.removeEventListener('mn-speech-start', onStart);
      window.removeEventListener('mn-speech-end', onEnd);
    };
  }, [listening]);

  useEffect(() => { if (listening) setMode('listening'); }, [listening]);

  // Open + greet aloud, then start listening once she finishes (no mic/audio clash).
  const activate = useCallback(() => {
    setOpen(true);
    speakHer("I'm here — what do you need?", true);
  }, [speakHer]);

  // Wake word — while the panel is closed, listen for "mother / mother nature /
  // mother earth" and open her automatically. Needs mic permission + a prior
  // page interaction (browsers block auto-listen before the first gesture).
  useEffect(() => {
    if (open) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let stopped = false;
    const r = new SR();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true;
    const WAKE = /\bmother(\s*(nature|earth))?\b/i;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (WAKE.test(e.results[i][0].transcript)) { stopped = true; try { r.stop(); } catch {} activate(); return; }
      }
    };
    r.onerror = () => {};
    r.onend = () => { if (!stopped && !open) { try { r.start(); } catch {} } };
    try { r.start(); } catch {}
    return () => { stopped = true; try { r.stop(); } catch {} };
  }, [open, activate]);

  // Keep the conversation scrolled to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, busy]);

  useEffect(() => () => {
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
  }, []);

  const hidden =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/book') ||
    pathname?.startsWith('/reset-password');
  if (hidden) return null;

  const active = mode !== 'idle' || open;

  return (
    <>
      <style jsx global>{`
        @keyframes nature-drift {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(10px, -14px); }
          50%  { transform: translate(-8px, -20px); }
          75%  { transform: translate(-14px, -6px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes nature-spin {
          from { background-position: 0% 50%; }
          to   { background-position: -220% 50%; }
        }
        @keyframes nature-breathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.95; transform: scale(1.12); }
        }
        @keyframes nature-ripple {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes nature-pop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Hologram: flicker, gentle float, moving scan bar, rising leaves */
        @keyframes holo-flicker {
          0%, 100% { opacity: 1; }
          89% { opacity: 1; }
          90% { opacity: 0.78; }
          91% { opacity: 1; }
          95% { opacity: 0.9; }
          96% { opacity: 1; }
        }
        @keyframes holo-bob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-4px); }
        }
        @keyframes holo-scan {
          0%   { top: -12%; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { top: 104%; opacity: 0; }
        }
        @keyframes holo-leaf-rise {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          15%  { opacity: 0.9; }
          80%  { opacity: 0.5; }
          100% { transform: translateY(-110px) rotate(200deg); opacity: 0; }
        }
        .nature-orb-wrap { animation: nature-drift 8s ease-in-out infinite; }
        .nature-inner    { animation: nature-spin 60s linear infinite; }
        .nature-halo     { animation: nature-breathe 3.2s ease-in-out infinite; }
        .nature-panel    { animation: nature-pop 0.22s ease-out; }
        .holo-flicker    { animation: holo-flicker 5s linear infinite; }
        .holo-bob        { animation: holo-bob 6s ease-in-out infinite; }
        .holo-flicker.holo-bob { animation: holo-flicker 5s linear infinite, holo-bob 6s ease-in-out infinite; }
        .holo-scanbar    { animation: holo-scan 4.5s linear infinite; }
        .holo-leaf       { animation: holo-leaf-rise 5.2s ease-out infinite; }

        /* ── Image-based goddess hologram ── */
        /* Overlays are positioned relative to the IMAGE box (.goddess-figure),
           so % values map straight onto the artwork regardless of stage size. */
        .goddess { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden; }
        .goddess-figure { position: relative; height: 100%; }
        .goddess-img {
          display: block; height: 100%; width: auto; max-width: 100%;
          filter: drop-shadow(0 0 26px rgba(74,184,206,0.45)) drop-shadow(0 0 48px rgba(74,184,206,0.25));
        }
        .goddess-img.base { animation: goddess-float 6.5s ease-in-out infinite; }
        /* Closed-eyes frame stacked exactly over the base; fades in for a real,
           natural blink. Without goddess-closed.png it never renders (no fake lid). */
        .goddess-img.blink { position: absolute; inset: 0; margin: auto; opacity: 0;
          animation: goddess-blink 5.4s ease-in-out infinite, goddess-float 6.5s ease-in-out infinite; }
        .goddess-figure > .goddess-scan, .goddess-figure > .goddess-glow { position: absolute; inset: 0; pointer-events: none; }
        .goddess-glow { mix-blend-mode: screen;
          background: radial-gradient(ellipse at 50% 36%, rgba(120,220,255,0.12), transparent 52%); animation: nature-breathe 3.4s ease-in-out infinite; }
        .goddess-scan { opacity: 0.5;
          background: repeating-linear-gradient(0deg, rgba(140,255,235,0.05) 0px, rgba(140,255,235,0.05) 1px, transparent 1px, transparent 3px); }
        /* Speaking: she glows/pulses (no fake mouth) — a clean "she's talking" cue. */
        .goddess.speaking .goddess-glow { animation: goddess-speakglow 0.9s ease-in-out infinite; }
        .goddess.speaking .goddess-img.base { animation: goddess-float 6.5s ease-in-out infinite, goddess-speakpulse 1.1s ease-in-out infinite; }
        /* Blink: closed frame visible only ~120ms each cycle, quick ease. */
        @keyframes goddess-blink { 0%, 92%, 100% { opacity: 0; } 95%, 96.5% { opacity: 1; } }
        @keyframes goddess-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes goddess-speakglow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes goddess-speakpulse { 0%, 100% { filter: drop-shadow(0 0 26px rgba(74,184,206,0.45)) drop-shadow(0 0 48px rgba(74,184,206,0.25)); } 50% { filter: drop-shadow(0 0 34px rgba(120,220,255,0.7)) drop-shadow(0 0 60px rgba(74,184,206,0.4)); } }
      `}</style>

      <div
        className="fixed z-50 pointer-events-none flex flex-col items-end"
        style={{ right: 24, bottom: 24 }}
      >
        {/* ── Mother Nature chat panel ── */}
        {open && (
          <div
            className="nature-panel pointer-events-auto mb-3 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{
              width: 'min(400px, calc(100vw - 48px))',
              maxHeight: 'min(620px, calc(100vh - 140px))',
              background: 'transparent',
              border: 'none',
            }}
          >
            {/* Hologram stage — she materializes when the world is clicked */}
            <div
              className="relative shrink-0"
              style={{
                height: 320,
                background: 'radial-gradient(ellipse at 50% 88%, rgba(12,109,164,0.22), transparent 70%)',
              }}
            >
              <GoddessHologram mode={busy ? 'thinking' : mode} />
              <button
                onClick={() => { cancelSpeak(); if (listening) stop(); setOpen(false); setMode('idle'); }}
                className="absolute top-2.5 right-2.5 text-white/50 hover:text-white z-10"
                aria-label="Close Mother Nature"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
              <div className="absolute bottom-1.5 left-0 right-0 text-center pointer-events-none">
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ letterSpacing: '0.28em', color: 'rgba(190,255,238,0.85)', textShadow: '0 0 12px rgba(120,255,220,0.7)' }}
                >
                  Mother Nature
                </span>
                <span className="block text-[9px] text-cyan-200/60 tracking-wide mt-0.5">
                  {busy ? 'thinking…' : listening ? 'listening…' : mode === 'speaking' ? 'speaking…' : 'your agency assistant'}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ minHeight: 180 }}>
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap"
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)', color: '#fff', borderBottomRightRadius: 6 }
                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 6 }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3 py-2 text-[12.5px] text-white/60" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input row */}
            <div className="px-3 pb-3 pt-1 shrink-0">
              {listening && (
                <div className="text-[11px] text-cyan-200/80 px-1 pb-1 truncate">{transcript || 'Listening — speak now…'}</div>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input, false); } }}
                  placeholder="Ask Mother Nature…"
                  className="flex-1 text-[13px] px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
                />
                {supported && (
                  <button
                    onClick={() => {
                      if (listening) { stop(); setMode('idle'); return; }
                      try { audioRef.current?.pause(); } catch {}
                      cancelSpeak();
                      start();
                    }}
                    title={listening ? 'Stop listening' : 'Talk to Mother Nature'}
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                    style={listening
                      ? { background: 'rgba(244,63,94,0.85)', color: '#fff', boxShadow: '0 0 14px rgba(244,63,94,0.6)' }
                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{listening ? 'stop' : 'mic'}</span>
                  </button>
                )}
                <button
                  onClick={() => handleSend(input, false)}
                  disabled={!input.trim() || busy}
                  title="Send"
                  className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 19 }}>arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── The orb — click the world, Mother Nature pops up ── */}
        <div className={active && !open ? 'nature-orb-wrap' : ''} style={{ width: active && !open ? 120 : 72, height: active && !open ? 120 : 72 }}>
          <button
            type="button"
            onClick={() => {
              if (open) { cancelSpeak(); if (listening) stop(); setOpen(false); setMode('idle'); }
              else activate();
            }}
            title={open ? 'Close Mother Nature' : 'Talk to Mother Nature'}
            aria-label="Mother Nature assistant"
            className="pointer-events-auto relative rounded-full w-full h-full flex items-center justify-center overflow-visible transition-all duration-500"
            style={{
              boxShadow:
                mode === 'listening'
                  ? '0 0 25px rgba(255,255,255,1), 0 0 55px rgba(173,220,255,0.85), 0 0 110px rgba(120,200,255,0.55), 0 0 180px rgba(74,184,206,0.35)'
                  : mode === 'speaking'
                  ? '0 0 25px rgba(134,214,225,1), 0 0 55px rgba(74,184,206,0.9), 0 0 110px rgba(12,150,200,0.55), 0 0 180px rgba(12,109,164,0.3)'
                  : mode === 'thinking'
                  ? '0 0 25px rgba(173,220,255,0.9), 0 0 55px rgba(120,200,255,0.7), 0 0 110px rgba(74,184,206,0.4)'
                  : '0 0 22px rgba(134,214,225,0.85), 0 0 50px rgba(74,184,206,0.65), 0 0 100px rgba(12,109,164,0.35), 0 0 170px rgba(74,184,206,0.18)',
              background: 'transparent',
              border: 'none',
            }}
          >
            {/* Breathing aurora halo */}
            <span
              className="absolute rounded-full nature-halo"
              style={{
                inset: '-18%',
                background:
                  mode === 'listening'
                    ? 'radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(170,220,255,0.35) 35%, rgba(74,184,206,0.12) 60%, rgba(12,109,164,0) 78%)'
                    : 'radial-gradient(circle, rgba(134,214,225,0.65) 0%, rgba(74,184,206,0.35) 35%, rgba(12,150,200,0.12) 60%, rgba(12,109,164,0) 78%)',
                filter: 'blur(2px)',
              }}
            />

            {/* Atmosphere rim */}
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow:
                  mode === 'listening'
                    ? '0 0 0 1px rgba(255,255,255,0.6), 0 0 12px 2px rgba(200,230,255,0.55) inset'
                    : '0 0 0 1px rgba(170,220,255,0.45), 0 0 12px 2px rgba(120,200,255,0.4) inset',
              }}
            />

            {/* Speaking ripples — blue */}
            {mode === 'speaking' && (
              <>
                <span className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(74,184,206,0.6)', animation: 'nature-ripple 1.8s ease-out infinite' }} />
                <span className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(74,184,206,0.4)', animation: 'nature-ripple 1.8s ease-out infinite', animationDelay: '0.6s' }} />
              </>
            )}

            {/* Listening ripples — white */}
            {mode === 'listening' && (
              <>
                <span className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.75)', animation: 'nature-ripple 1.4s ease-out infinite' }} />
                <span className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.5)', animation: 'nature-ripple 1.4s ease-out infinite', animationDelay: '0.5s' }} />
              </>
            )}

            {/* Spinning Earth */}
            <span
              className="nature-inner relative rounded-full overflow-hidden"
              style={{
                width: '82%',
                height: '82%',
                backgroundImage: 'url(/ai/earth.jpg)',
                backgroundSize: '220% 100%',
                backgroundPosition: '0% 50%',
                backgroundRepeat: 'repeat-x',
                filter: 'brightness(1.35) saturate(1.55) contrast(1.1)',
                boxShadow:
                  'inset 0 0 22px rgba(170,220,255,0.55), inset 0 -10px 22px rgba(8,30,55,0.55), inset 10px 0 18px rgba(0,0,0,0.22)',
              }}
            >
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%), radial-gradient(ellipse at 25% 70%, rgba(255,255,255,0.12), rgba(255,255,255,0) 60%)',
                }}
              />
              <span
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: 'inset 0 0 18px rgba(170,220,255,0.35), inset -10px 0 22px rgba(0,0,0,0.45)' }}
              />
              <span
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: '38%', height: '28%', top: '10%', left: '14%',
                  background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)',
                  filter: 'blur(3px)',
                }}
              />
            </span>
          </button>
        </div>

        {/* Name label */}
        {!open && (
          <div
            className="mt-2 text-center pointer-events-none"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase',
              fontWeight: 600,
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            Mother Nature
          </div>
        )}
      </div>
    </>
  );
}
