'use client';

/**
 * Logo — context-aware brand logo component
 *
 * Rendering priority (per variant):
 *  1. Real image file (logoUrl / iconUrl from client branding)
 *  2. Inline SVG fallback (built-in brand marks for MNA and Prime IV)
 *  3. Generic initials mark (for any new client without a logo file)
 *
 * Variants:
 *  "sidebar" — sidebar header: icon/logo + optional name text
 *  "icon"    — compact square icon only (client switcher, breadcrumbs)
 *  "header"  — client header area: full horizontal logo
 */

import React from 'react';
import LogoImage from './LogoImage';
import { useClient } from '@/context/ClientContext';
import { Client } from '@/lib/clients';

type LogoProps = {
  variant?: 'sidebar' | 'icon' | 'header' | 'full' | 'compact';
  className?: string;
  /** Override — show a specific client's logo instead of the active one */
  client?: Client;
};

// ─────────────────────────────────────────────────────────────
// Inline SVG fallback marks — used when no image file is set
// ─────────────────────────────────────────────────────────────

function MNAFallbackMark({ size = 36, gf, gt }: { size?: number; gf: string; gt: string }) {
  const id = `mna-fb-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gf} />
          <stop offset="100%" stopColor={gt} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill={`url(#${id})`} />
      <path d="M18 7C18 7 11 12.5 11 19C11 22.9 14.1 26 18 26C21.9 26 25 22.9 25 19C25 12.5 18 7 18 7Z" fill="white" fillOpacity="0.95" />
      <path d="M18 26V29.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M15.5 29.5H20.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
      <circle cx="18" cy="19" r="2.5" fill={`url(#${id})`} fillOpacity="0.4" />
    </svg>
  );
}

function PrimeIVFallbackMark({ size = 36, gf, gt, accent }: { size?: number; gf: string; gt: string; accent: string }) {
  const id = `piv-fb-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gf} />
          <stop offset="100%" stopColor={gt} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill={`url(#${id})`} />
      <path d="M18 8C18 8 14 13 14 18C14 20.2 15.8 22 18 22C20.2 22 22 20.2 22 18C22 13 18 8 18 8Z" fill="white" fillOpacity="0.9" />
      <path d="M18 22V29" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 26H21" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
      <circle cx="18" cy="18" r="2" fill={accent} fillOpacity="0.7" />
    </svg>
  );
}

function GenericFallbackMark({ initials, gf, gt, size = 36 }: { initials: string; gf: string; gt: string; size?: number }) {
  const id = `gen-fb-${initials}`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gf} />
          <stop offset="100%" stopColor={gt} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill={`url(#${id})`} />
      <text
        x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill="white" fontWeight="800"
        fontSize={initials.length > 2 ? '10' : '13'}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="-0.5"
      >
        {initials}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Text-only fallback for generic clients
// ─────────────────────────────────────────────────────────────
function FallbackText({ name, gf, gt }: { name: string; gf: string; gt: string }) {
  return (
    <span
      className="text-[13px] font-extrabold tracking-tight leading-none"
      style={{
        background: `linear-gradient(135deg, ${gf}, ${gt})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Logo component
// ─────────────────────────────────────────────────────────────
export default function Logo({ variant = 'sidebar', className = '', client: clientProp }: LogoProps) {
  const { activeClient } = useClient();
  const client = clientProp ?? activeClient;

  const {
    branding,
    name,
    id,
  } = client as typeof client & { shortName?: string };

  const {
    gradientFrom: gf,
    gradientTo: gt,
    accentColor = '#5bc4d4',
    logoUrl,
    iconUrl,
  } = branding as typeof branding & {
    accentColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  };

  const shortName = (client as typeof client & { shortName?: string }).shortName;
  const initials = (shortName || name).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // ── "icon" variant — square icon mark ──────────────────────
  // Used in: client switcher button, breadcrumbs, tiny contexts
  if (variant === 'icon' || variant === 'compact') {
    // 1. Prefer dedicated icon file (SVG square marks render crisply)
    if (iconUrl) {
      return (
        <LogoImage
          src={iconUrl}
          alt={`${name} icon`}
          height={34}
          maxWidth={34}
          className={className}
        />
      );
    }
    // 2. Wide PNG logo (no icon) — show in a slightly wider slot
    if (logoUrl) {
      return (
        <LogoImage
          src={logoUrl}
          alt={name}
          height={28}
          maxWidth={72}
          className={className}
        />
      );
    }
    // 3. Inline SVG fallback
    if (id === 'mna') return <MNAFallbackMark size={34} gf={gf} gt={gt} />;
    if (id === 'prime-iv') return <PrimeIVFallbackMark size={34} gf={gf} gt={gt} accent={accentColor} />;
    return <GenericFallbackMark initials={initials} gf={gf} gt={gt} size={34} />;
  }

  // ── "header" variant — full logo for header client display ──
  // Used in: client selector button in the header bar
  if (variant === 'header') {
    // 1. Dedicated icon file (square SVGs work great at small header heights)
    if (iconUrl) {
      return (
        <LogoImage
          src={iconUrl}
          alt={`${name} icon`}
          height={28}
          maxWidth={28}
          className={className}
        />
      );
    }
    // 2. Full logo (wide PNGs like Prime IV)
    if (logoUrl) {
      return (
        <LogoImage
          src={logoUrl}
          alt={name}
          height={24}
          maxWidth={80}
          className={className}
        />
      );
    }
    // 3. Fallback — inline SVG
    if (id === 'mna') return <MNAFallbackMark size={28} gf={gf} gt={gt} />;
    if (id === 'prime-iv') return <PrimeIVFallbackMark size={28} gf={gf} gt={gt} accent={accentColor} />;
    return <GenericFallbackMark initials={initials} gf={gf} gt={gt} size={28} />;
  }

  // ── "sidebar" / "full" variant — sidebar header area ───────
  // Uses the icon file + text label, or the full logo file alone.

  // MNA: has a dedicated square icon → show icon + text wordmark
  if (iconUrl) {
    return (
      <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
        {/* Square icon mark */}
        <LogoImage
          src={iconUrl}
          alt={`${name} icon`}
          height={36}
          maxWidth={36}
          style={{ flexShrink: 0 }}
        />
        {/* Text wordmark — rendered separately for precise control */}
        <div className="flex flex-col leading-none min-w-0">
          <span
            className="text-[12.5px] font-extrabold tracking-tight leading-none truncate"
            style={{
              background: `linear-gradient(135deg, ${gf} 0%, ${gt} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            {id === 'mna' ? 'MOTHER NATURE' : shortName?.toUpperCase() ?? name.toUpperCase()}
          </span>
          <span
            className="text-[8.5px] font-semibold tracking-[0.22em] mt-[3px] uppercase"
            style={{ color: `${gf}70` }}
          >
            {id === 'mna' ? 'AGENCY' : (client as typeof client & { industry: string }).industry?.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  // Client has a wide PNG logo but no square icon (e.g. Prime IV)
  // Show the full logo alone — it already contains the wordmark
  if (logoUrl) {
    return (
      <div className={`flex items-center ${className}`}>
        <LogoImage
          src={logoUrl}
          alt={name}
          height={32}
          maxWidth={120}
          // Small amount of padding compensation for logos with whitespace
          style={{ flexShrink: 0 }}
        />
      </div>
    );
  }

  // ── Pure fallback — no image files set ─────────────────────
  if (id === 'mna') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <MNAFallbackMark size={36} gf={gf} gt={gt} />
        <div className="flex flex-col leading-none">
          <span className="text-[12.5px] font-extrabold tracking-tight" style={{ background: `linear-gradient(135deg, ${gf}, ${gt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            MOTHER NATURE
          </span>
          <span className="text-[8.5px] font-semibold tracking-[0.22em] mt-[3px]" style={{ color: `${gf}70` }}>
            AGENCY
          </span>
        </div>
      </div>
    );
  }

  if (id === 'prime-iv') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <PrimeIVFallbackMark size={36} gf={gf} gt={gt} accent={accentColor} />
        <div className="flex flex-col leading-none">
          <span className="text-[12.5px] font-extrabold tracking-tight" style={{ background: `linear-gradient(135deg, ${gf}, ${gt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            PRIME IV
          </span>
          <span className="text-[8.5px] font-semibold tracking-[0.22em] mt-[3px]" style={{ color: accentColor, opacity: 0.85 }}>
            NICEVILLE · FL
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <GenericFallbackMark initials={initials} gf={gf} gt={gt} size={36} />
      <FallbackText name={name} gf={gf} gt={gt} />
    </div>
  );
}
