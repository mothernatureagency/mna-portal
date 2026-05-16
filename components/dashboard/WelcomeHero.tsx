'use client';

/**
 * Cinematic welcome banner for the Agency Overview.
 *
 *   - Typewriter that cycles through ~3 brand lines, starting with
 *     "Welcome to the Motherboard."
 *   - Animated gradient blobs + subtle grid backdrop for depth.
 *   - Live time + greeting + status pill (powered by activeClient branding).
 *
 * Drop-in: <WelcomeHero /> — picks up colors from useClient(), falls back
 * to the MNA blue gradient if the active client has no branding.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';

const LINES = [
  'Welcome to the Motherboard.',
  'Mother Nature Agency.',
  'Where strategy meets execution.',
];

function greetingFor(hour: number) {
  if (hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Working late';
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function WelcomeHero({
  gradientFrom: gfProp,
  gradientTo: gtProp,
}: {
  gradientFrom?: string;
  gradientTo?: string;
} = {}) {
  const ctx = useClient() as any;
  const branding = ctx?.activeClient?.branding;
  const gradientFrom = gfProp || branding?.gradientFrom || '#0c6da4';
  const gradientTo = gtProp || branding?.gradientTo || '#4ab8ce';
  const userEmail: string = ctx?.userEmail || '';
  const firstName = useMemo(() => {
    const local = userEmail.split('@')[0] || '';
    if (!local) return '';
    const head = local.split(/[._-]/)[0];
    return head ? head.charAt(0).toUpperCase() + head.slice(1) : '';
  }, [userEmail]);

  const [now, setNow] = useState<Date>(() => new Date());
  const [typed, setTyped] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'holding' | 'erasing'>('typing');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Tick clock once a minute (cheap)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Typewriter loop. Speeds: type 55ms/char, hold 1800ms, erase 30ms/char.
  useEffect(() => {
    const full = LINES[lineIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (phase === 'typing') {
      if (typed.length < full.length) {
        timeout = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), 55);
      } else {
        timeout = setTimeout(() => setPhase('holding'), 1800);
      }
    } else if (phase === 'holding') {
      timeout = setTimeout(() => setPhase('erasing'), 1200);
    } else if (phase === 'erasing') {
      if (typed.length > 0) {
        timeout = setTimeout(() => setTyped(typed.slice(0, -1)), 30);
      } else {
        setLineIdx((i) => (i + 1) % LINES.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timeout);
  }, [typed, phase, lineIdx]);

  const greeting = greetingFor(now.getHours());

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10"
      style={{
        background:
          'linear-gradient(135deg, rgba(10,18,28,0.85) 0%, rgba(15,24,36,0.85) 100%)',
      }}
    >
      {/* Animated blob 1 */}
      <div
        className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${gradientFrom} 0%, transparent 60%)`, animation: 'mna-drift-a 18s ease-in-out infinite' }}
      />
      {/* Animated blob 2 */}
      <div
        className="absolute -bottom-24 -right-20 w-[480px] h-[480px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${gradientTo} 0%, transparent 60%)`, animation: 'mna-drift-b 22s ease-in-out infinite' }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
      {/* Top sheen line */}
      <div className="absolute top-0 left-10 right-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gradientTo}, transparent)` }} />

      <div className="relative z-10 px-6 md:px-10 py-8 md:py-10">
        {/* Meta row */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/55">
              <span className="relative inline-flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ background: '#34d399' }} />
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
              </span>
              Live
            </span>
            <span className="text-[11px] text-white/55">·</span>
            <span className="text-[11px] text-white/55 font-mono tabular-nums">{fmtDate(now)} · {fmtTime(now)}</span>
          </div>
          {firstName && (
            <div className="text-[11px] text-white/55">
              {greeting}, <span className="text-white/85 font-semibold">{firstName}</span>
            </div>
          )}
        </div>

        {/* Typewriter headline */}
        <h1
          className="text-[34px] md:text-[52px] leading-[1.05] font-black tracking-tight text-white"
          aria-live="polite"
        >
          <span
            style={{
              backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${gradientTo} 60%, ${gradientFrom} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {typed}
          </span>
          <span
            className="inline-block ml-1 align-baseline"
            style={{
              width: '0.55ch',
              height: '1em',
              transform: 'translateY(0.18em)',
              background: gradientTo,
              animation: 'mna-blink 1.05s steps(1) infinite',
            }}
          />
        </h1>

        {/* Subline */}
        <p className="text-[13px] md:text-[14px] text-white/65 mt-3 max-w-2xl leading-relaxed">
          One pane for every client — leads, ads, content, social, revenue.
          Click a client below to drop into their dashboard.
        </p>
      </div>

      <style jsx>{`
        @keyframes mna-drift-a {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50%      { transform: translate3d(40px,30px,0) scale(1.1); }
        }
        @keyframes mna-drift-b {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50%      { transform: translate3d(-50px,-30px,0) scale(1.08); }
        }
        @keyframes mna-blink {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
