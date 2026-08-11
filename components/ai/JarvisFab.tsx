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
  const msgsRef = useRef<Msg[]>(msgs);
  msgsRef.current = msgs;

  function scheduleIdle(ms: number) {
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = window.setTimeout(() => setMode('idle'), ms);
  }

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
      if (viaVoice) { setMode('speaking'); speak(reply); }
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
          setMode('speaking');
          speak(reply);
          scheduleIdle(Math.min(20000, Math.max(2500, displayed.length * 75)));
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
      <style jsx>{`
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
        .nature-orb-wrap { animation: nature-drift 8s ease-in-out infinite; }
        .nature-inner    { animation: nature-spin 60s linear infinite; }
        .nature-halo     { animation: nature-breathe 3.2s ease-in-out infinite; }
        .nature-panel    { animation: nature-pop 0.22s ease-out; }
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
              width: 'min(380px, calc(100vw - 48px))',
              maxHeight: 'min(560px, calc(100vh - 160px))',
              background: 'rgba(10,24,38,0.96)',
              border: '1px solid rgba(74,184,206,0.35)',
              backdropFilter: 'blur(24px) saturate(160%)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(12,109,164,0.5), rgba(74,184,206,0.25))', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span
                className="rounded-full shrink-0"
                style={{
                  width: 26, height: 26,
                  backgroundImage: 'url(/ai/earth.jpg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  boxShadow: '0 0 10px rgba(74,184,206,0.8)',
                }}
              />
              <div className="min-w-0">
                <div className="text-white font-bold text-[13px] leading-tight">Mother Nature</div>
                <div className="text-[10px] text-cyan-200/70 leading-tight">
                  {busy ? 'thinking…' : listening ? 'listening…' : 'your agency assistant'}
                </div>
              </div>
              <button
                onClick={() => { cancelSpeak(); if (listening) stop(); setOpen(false); setMode('idle'); }}
                className="ml-auto text-white/50 hover:text-white"
                aria-label="Close Mother Nature"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
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
              else setOpen(true);
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
