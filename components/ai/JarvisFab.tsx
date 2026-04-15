'use client';

/**
 * Mother Nature — floating JARVIS-style assistant.
 *
 * Idle:      small animated orb in the bottom-left (doesn't overlap the top-right header)
 * Active:    orb scales up, drifts gently around the screen, inner sphere pulses
 * Listening: bright rose pulse + waveform
 * Speaking:  cool blue ripples radiating outward
 *
 * No mic icon — the orb is the interface. Click to talk.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useVoiceRecognition, speak, cancelSpeak, sanitizeForSpeech } from '@/lib/voice';

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

export default function JarvisFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>('idle');
  const [lastReply, setLastReply] = useState<string>('');
  const speakingTimeoutRef = useRef<number | null>(null);

  const handleFinal = useCallback(async (text: string) => {
    if (!text) return;
    const nav = NAV_PHRASES.find((n) => n.match.test(text));
    if (nav) {
      setMode('speaking');
      speak(`Opening ${nav.label}.`);
      router.push(nav.path);
      scheduleIdle(1500);
      return;
    }

    setMode('thinking');
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          context: { page: pathname || '/' },
        }),
      });
      const data = await res.json();
      const reply = data?.reply || data?.message || data?.content || '';
      if (reply) {
        // Strip asterisks / markdown / emojis from the visible text too,
        // so the chat bubble matches what she says out loud.
        const cleanReply = sanitizeForSpeech(reply);
        setLastReply(cleanReply);
        if (cleanReply) {
          setMode('speaking');
          speak(cleanReply);
          scheduleIdle(Math.min(20000, Math.max(2500, cleanReply.length * 75)));
        } else {
          setMode('idle');
        }
      } else {
        setMode('speaking');
        speak("I didn't catch that. Try again?");
        scheduleIdle(2500);
      }
    } catch {
      setMode('speaking');
      speak('Something went wrong reaching the assistant.');
      scheduleIdle(2500);
    }
  }, [pathname, router]);

  function scheduleIdle(ms: number) {
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = window.setTimeout(() => setMode('idle'), ms);
  }

  useEffect(() => () => {
    if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
  }, []);

  const { supported, listening, transcript, start, stop } = useVoiceRecognition({ onFinalResult: handleFinal });

  // Sync recognition state → UI mode
  useEffect(() => {
    if (listening) setMode('listening');
  }, [listening]);

  const hidden =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/book') ||
    pathname?.startsWith('/reset-password');
  if (hidden || !supported) return null;

  const active = mode !== 'idle';

  return (
    <>
      <style jsx>{`
        /* Slow drift for the active orb so it "floats" around its anchor */
        @keyframes nature-drift {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(10px, -14px); }
          50%  { transform: translate(-8px, -20px); }
          75%  { transform: translate(-14px, -6px); }
          100% { transform: translate(0, 0); }
        }
        /* Inner sphere rotation */
        @keyframes nature-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Breathing halo */
        @keyframes nature-breathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.95; transform: scale(1.12); }
        }
        /* Speaking ripples */
        @keyframes nature-ripple {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        .nature-orb-wrap { animation: nature-drift 8s ease-in-out infinite; }
        .nature-inner    { animation: nature-spin 14s linear infinite; }
        .nature-halo     { animation: nature-breathe 3.2s ease-in-out infinite; }
      `}</style>

      <div
        className="fixed z-50 pointer-events-none flex flex-col items-end"
        style={{
          // Bottom-right, clear of the left sidebar and above-screen header chips.
          right: 24,
          bottom: 24,
        }}
      >
        {/* Reply chip — sits above the orb, left-aligned so it won't clip the screen edge */}
        {lastReply && !listening && (
          <div className="pointer-events-auto glass-card mb-3 max-w-sm p-3 text-sm text-white/90 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Mother Nature</span>
              <button
                onClick={() => { cancelSpeak(); setLastReply(''); setMode('idle'); }}
                className="text-white/40 hover:text-white/80 text-xs"
              >dismiss</button>
            </div>
            {lastReply.length > 260 ? `${lastReply.slice(0, 260)}…` : lastReply}
          </div>
        )}

        {/* Live transcript while listening */}
        {listening && transcript && (
          <div className="pointer-events-auto glass-card mb-3 max-w-sm p-2.5 text-xs text-white/80">
            {transcript}
          </div>
        )}

        {/* The orb itself */}
        <div className={active ? 'nature-orb-wrap' : ''} style={{ width: active ? 120 : 72, height: active ? 120 : 72 }}>
          <button
            type="button"
            onClick={() => {
              if (mode === 'listening') { stop(); setMode('idle'); return; }
              cancelSpeak();
              start();
            }}
            title={mode === 'listening' ? 'Stop listening' : 'Tap to talk to Mother Nature'}
            aria-label="Mother Nature voice assistant"
            className="pointer-events-auto relative rounded-full w-full h-full flex items-center justify-center overflow-visible transition-all duration-500"
            style={{
              // Outer glow — always blue/white. Listening is brighter white,
              // speaking is saturated teal, thinking is a soft cyan pulse.
              boxShadow:
                mode === 'listening'
                  ? '0 0 40px rgba(255,255,255,0.95), 0 0 80px rgba(173,216,255,0.55)'
                  : mode === 'speaking'
                  ? '0 0 30px rgba(74,184,206,0.95), 0 0 60px rgba(12,109,164,0.55)'
                  : mode === 'thinking'
                  ? '0 0 28px rgba(134,214,225,0.8), 0 0 55px rgba(74,184,206,0.35)'
                  : '0 0 20px rgba(74,184,206,0.55), 0 0 40px rgba(12,109,164,0.25)',
              background: 'transparent',
              border: 'none',
            }}
          >
            {/* Halo ring — always cool blue/white */}
            <span
              className="absolute inset-0 rounded-full nature-halo"
              style={{
                background:
                  mode === 'listening'
                    ? 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(173,216,255,0) 70%)'
                    : 'radial-gradient(circle, rgba(74,184,206,0.45) 0%, rgba(12,109,164,0) 70%)',
              }}
            />

            {/* Speaking ripples — blue */}
            {mode === 'speaking' && (
              <>
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid rgba(74,184,206,0.6)',
                    animation: 'nature-ripple 1.8s ease-out infinite',
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid rgba(74,184,206,0.4)',
                    animation: 'nature-ripple 1.8s ease-out infinite',
                    animationDelay: '0.6s',
                  }}
                />
              </>
            )}

            {/* Listening ripples — white */}
            {mode === 'listening' && (
              <>
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid rgba(255,255,255,0.75)',
                    animation: 'nature-ripple 1.4s ease-out infinite',
                  }}
                />
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid rgba(255,255,255,0.5)',
                    animation: 'nature-ripple 1.4s ease-out infinite',
                    animationDelay: '0.5s',
                  }}
                />
              </>
            )}

            {/* The globe — continents painted over an ocean gradient */}
            <span
              className="nature-inner relative rounded-full overflow-hidden"
              style={{
                width: '78%',
                height: '78%',
                // Ocean: deep sea blue with a soft atmospheric rim on top-left.
                background:
                  'radial-gradient(circle at 30% 28%, rgba(170,220,255,0.55) 0%, rgba(74,184,206,0.95) 22%, rgba(20,90,140,1) 55%, rgba(8,40,72,1) 90%)',
                boxShadow:
                  'inset 0 0 22px rgba(173,216,255,0.35), inset 0 -12px 28px rgba(4,18,34,0.7)',
              }}
            >
              {/* Continents — two irregular blobs styled as land masses.
                  SVG so they scale crisply and don't read as random shapes. */}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <radialGradient id="landGrad" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#86d685" />
                    <stop offset="60%" stopColor="#4a9a55" />
                    <stop offset="100%" stopColor="#2c5a37" />
                  </radialGradient>
                </defs>
                {/* Americas-ish silhouette */}
                <path
                  d="M22 30 Q30 22 38 28 Q42 34 40 42 Q44 48 38 56 Q32 66 28 62 Q22 58 26 50 Q20 44 22 30 Z"
                  fill="url(#landGrad)"
                  opacity="0.92"
                />
                {/* Eurasia/Africa-ish silhouette */}
                <path
                  d="M54 22 Q66 18 74 26 Q80 32 76 40 Q82 46 74 54 Q66 58 60 52 Q52 56 50 46 Q46 38 54 22 Z"
                  fill="url(#landGrad)"
                  opacity="0.9"
                />
                {/* Southern land mass */}
                <path
                  d="M44 72 Q54 68 62 74 Q66 80 58 82 Q48 84 44 80 Z"
                  fill="url(#landGrad)"
                  opacity="0.88"
                />
              </svg>

              {/* Latitude lines — very subtle so the continents stay readable */}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'repeating-linear-gradient(transparent 0 8px, rgba(255,255,255,0.08) 8px 9px)',
                  mixBlendMode: 'overlay',
                }}
              />

              {/* Longitude lines — curved via a subtle horizontal stripe with an arc mask feel */}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.06) 10px 11px)',
                  mixBlendMode: 'overlay',
                }}
              />

              {/* Specular highlight — upper-left shine for a 3D sphere read */}
              <span
                className="absolute rounded-full"
                style={{
                  width: '40%',
                  height: '30%',
                  top: '8%',
                  left: '12%',
                  background:
                    'radial-gradient(ellipse at center, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)',
                  filter: 'blur(3px)',
                }}
              />
            </span>

          </button>
        </div>

        {/* Name label — below the orb so it never overlaps header/right UI */}
        {!active && (
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
