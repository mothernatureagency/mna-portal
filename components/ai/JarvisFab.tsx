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
        /* Earth rotation — shift the background texture left to feel like
           the planet spinning on its axis. Keeps the sphere orientation fixed. */
        @keyframes nature-spin {
          from { background-position: 0% 50%; }
          to   { background-position: -220% 50%; }
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
        .nature-inner    { animation: nature-spin 60s linear infinite; }
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

            {/* Real Earth — NASA Blue Marble composite, set as a wide
                background so the inner rotation animation feels like the
                planet is spinning on its axis. */}
            <span
              className="nature-inner relative rounded-full overflow-hidden"
              style={{
                width: '82%',
                height: '82%',
                backgroundImage: 'url(/ai/earth.jpg)',
                backgroundSize: '220% 100%',
                backgroundPosition: '0% 50%',
                backgroundRepeat: 'repeat-x',
                boxShadow:
                  'inset 0 0 22px rgba(120,180,235,0.45), inset 0 -12px 28px rgba(4,18,34,0.75), inset 12px 0 22px rgba(0,0,0,0.3)',
              }}
            >
              {/* Cloud overlay — very subtle white haze + noise-style dots */}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%), radial-gradient(ellipse at 25% 70%, rgba(255,255,255,0.12), rgba(255,255,255,0) 60%)',
                }}
              />

              {/* Atmospheric rim — cyan glow on the edge, darker shadow on the right */}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow:
                    'inset 0 0 18px rgba(170,220,255,0.35), inset -10px 0 22px rgba(0,0,0,0.45)',
                }}
              />

              {/* Specular highlight — upper-left shine for a 3D sphere read */}
              <span
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: '38%',
                  height: '28%',
                  top: '10%',
                  left: '14%',
                  background:
                    'radial-gradient(ellipse at center, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)',
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
