'use client';

/**
 * Flo — floating JARVIS-style assistant.
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
              <span className="text-[10px] uppercase tracking-wider text-white/50">Flo</span>
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
            title={mode === 'listening' ? 'Stop listening' : 'Tap to talk to Flo'}
            aria-label="Flo voice assistant"
            className="pointer-events-auto relative rounded-full w-full h-full flex items-center justify-center overflow-visible transition-all duration-500"
            style={{
              // Outer glow — shifts color with mode
              boxShadow:
                mode === 'listening'
                  ? '0 0 30px rgba(244,63,94,0.85), 0 0 60px rgba(244,63,94,0.35)'
                  : mode === 'speaking'
                  ? '0 0 30px rgba(74,184,206,0.9), 0 0 60px rgba(12,109,164,0.45)'
                  : mode === 'thinking'
                  ? '0 0 28px rgba(245,158,11,0.8), 0 0 55px rgba(245,158,11,0.3)'
                  : '0 0 20px rgba(74,184,206,0.55), 0 0 40px rgba(12,109,164,0.25)',
              background: 'transparent',
              border: 'none',
            }}
          >
            {/* Halo ring */}
            <span
              className="absolute inset-0 rounded-full nature-halo"
              style={{
                background:
                  mode === 'listening'
                    ? 'radial-gradient(circle, rgba(244,63,94,0.45) 0%, rgba(244,63,94,0) 70%)'
                    : 'radial-gradient(circle, rgba(74,184,206,0.45) 0%, rgba(12,109,164,0) 70%)',
              }}
            />

            {/* Speaking ripples */}
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

            {/* The orb core — rotating wire-sphere feel via stacked gradients */}
            <span
              className="nature-inner relative rounded-full"
              style={{
                width: '72%',
                height: '72%',
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(134,214,225,0.85) 25%, rgba(74,184,206,0.85) 45%, rgba(12,109,164,0.9) 75%, rgba(10,25,41,0.95) 100%)',
                boxShadow:
                  'inset 0 0 20px rgba(255,255,255,0.35), inset 0 -10px 30px rgba(10,25,41,0.6)',
              }}
            >
              {/* Latitudinal wire lines */}
              <span className="absolute inset-0 rounded-full" style={{
                background:
                  'repeating-linear-gradient(transparent 0 7px, rgba(255,255,255,0.12) 7px 8px)',
                borderRadius: '50%',
                mixBlendMode: 'overlay',
              }} />
            </span>

            {/* Center spark — brightens when speaking */}
            <span
              className="absolute rounded-full"
              style={{
                width: 10,
                height: 10,
                background: 'white',
                opacity: mode === 'speaking' ? 1 : mode === 'listening' ? 0.9 : 0.6,
                boxShadow: '0 0 20px rgba(255,255,255,0.9)',
                transform: 'translate(0,0)',
              }}
            />
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
            Flo
          </div>
        )}
      </div>
    </>
  );
}
