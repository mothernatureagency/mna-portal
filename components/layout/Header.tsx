'use client';
import React from 'react';
import { Bell, Search, ChevronDown, Sparkles, Check, Plus } from 'lucide-react';
import { useClient } from '@/context/ClientContext';
import Logo from '@/components/logo/Logo';
import LogoImage from '@/components/logo/LogoImage';
import { Client } from '@/lib/clients';

// ─────────────────────────────────────────────────────────────
// SwitcherLogo — renders a client logo inside the header switcher
//
// Handles the size normalization challenge between:
//  - Square SVG icon marks (MNA: mna-icon.svg at 500×500)
//  - Wide horizontal PNGs (Prime IV: 9088×4420)
//
// "button" size: sits inside the compact header pill button
// "dropdown" size: sits next to text in the dropdown list
//
// For clients with a square icon file → render at fixed height in a
// square container (clean, predictable slot).
// For clients with only a wide PNG logo → render at a fixed height
// with width computed from aspect ratio (slightly wider slot).
// ─────────────────────────────────────────────────────────────
function SwitcherLogo({ client, size }: { client: Client; size: 'button' | 'dropdown' }) {
  const branding = client.branding as typeof client.branding & {
    logoUrl?: string;
    iconUrl?: string;
  };
  const { iconUrl, logoUrl, gradientFrom, gradientTo } = branding;

  const buttonHeight = 26;    // height inside the header button pill
  const dropdownHeight = 28;  // height inside the dropdown list rows
  const displayHeight = size === 'button' ? buttonHeight : dropdownHeight;

  // 1. Square icon file (SVG) — render in a fixed square slot for consistency
  if (iconUrl) {
    return (
      <div
        className="flex items-center justify-center flex-shrink-0 overflow-hidden rounded-lg"
        style={{
          width: `${displayHeight + 2}px`,
          height: `${displayHeight + 2}px`,
          background: `${gradientFrom}08`,
        }}
      >
        <LogoImage
          src={iconUrl}
          alt={client.name}
          height={displayHeight - 2}
          maxWidth={displayHeight - 2}
        />
      </div>
    );
  }

  // 2. Wide PNG logo (no square icon) — render in a wider adaptive slot
  if (logoUrl) {
    return (
      <div
        className="flex items-center justify-center flex-shrink-0 overflow-hidden rounded-lg px-1.5"
        style={{
          height: `${displayHeight + 2}px`,
          minWidth: `${displayHeight + 2}px`,
          maxWidth: '80px',
          background: `${gradientFrom}08`,
        }}
      >
        <LogoImage
          src={logoUrl}
          alt={client.name}
          height={size === 'button' ? 18 : 20}
          maxWidth={72}
        />
      </div>
    );
  }

  // 3. Fallback — gradient square with initial letter
  const id = `sw-${client.id}-${size}`;
  return (
    <svg
      width={displayHeight + 2}
      height={displayHeight + 2}
      viewBox="0 0 36 36"
      fill="none"
      className="flex-shrink-0 rounded-lg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gradientFrom} />
          <stop offset="100%" stopColor={gradientTo} />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill={`url(#${id})`} />
      <text
        x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill="white" fontWeight="800" fontSize="14"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {client.name.charAt(0)}
      </text>
    </svg>
  );
}

export default function Header() {
  const { activeClient, setActiveClientId, allClients } = useClient();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { gradientFrom, gradientTo } = activeClient.branding;

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className="h-16 flex items-center px-8 gap-5 sticky top-0 z-30 flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)',
      }}
    >
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-350 pointer-events-none"
            style={{ color: '#b0bac9' }}
          />
          <input
            type="text"
            placeholder="Search campaigns, leads, clients…"
            className="w-full pl-9 pr-4 py-2 text-[13px] rounded-xl transition-all placeholder:text-gray-300"
            style={{
              background: '#f4f6f9',
              border: '1px solid rgba(0,0,0,0.06)',
              color: '#374151',
              outline: 'none',
            }}
            onFocus={e => {
              e.target.style.background = '#fff';
              e.target.style.border = `1px solid ${gradientTo}80`;
              e.target.style.boxShadow = `0 0 0 3px ${gradientTo}18`;
            }}
            onBlur={e => {
              e.target.style.background = '#f4f6f9';
              e.target.style.border = '1px solid rgba(0,0,0,0.06)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">

        {/* AI Badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
            boxShadow: `0 2px 8px ${gradientFrom}40`,
          }}
        >
          <Sparkles size={11} />
          AI Active
        </div>

        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-gray-50"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}
        >
          <Bell size={14} style={{ color: '#6b7280' }} />
          <span
            className="absolute top-[7px] right-[7px] w-[6px] h-[6px] rounded-full border-[1.5px] border-white"
            style={{ background: '#f87171' }}
          />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-100" />

        {/* Client Selector */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition-all hover:bg-gray-50 group"
            style={{ border: '1px solid rgba(0,0,0,0.07)' }}
          >
            {/* Header logo: icon file if available, else full logo, else fallback SVG */}
            <SwitcherLogo client={activeClient as Client} size="button" />
            <div className="hidden md:block text-left">
              <div className="text-[12px] font-semibold text-gray-800 leading-tight max-w-[120px] truncate">
                {activeClient.name}
              </div>
              <div className="text-[10px] text-gray-400 leading-tight">
                {(activeClient as typeof activeClient & { industry: string }).industry}
              </div>
            </div>
            <ChevronDown
              size={12}
              className="text-gray-400 transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-2xl py-2 z-50 animate-slide-down"
              style={{
                background: '#fff',
                boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
              }}
            >
              <div className="px-4 pb-2 pt-1">
                <span className="text-[10px] font-semibold tracking-[0.1em] text-gray-300 uppercase">
                  Switch Account
                </span>
              </div>

              {allClients.map(client => {
                const isActive = activeClient.id === client.id;
                const clientTyped = client as Client;
                return (
                  <button
                    key={client.id}
                    onClick={() => { setActiveClientId(client.id); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all text-left hover:bg-gray-50"
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    {/* Real logo or fallback SVG — normalized to consistent visual weight */}
                    <SwitcherLogo client={clientTyped} size="dropdown" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-gray-800 truncate">{client.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">{(client as typeof client & { industry: string }).industry}</div>
                    </div>
                    {isActive && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
                      >
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}

              <div className="mx-3 my-2 h-px bg-gray-100" />

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all text-left hover:bg-gray-50 text-gray-400 hover:text-gray-600"
                style={{ width: 'calc(100% - 8px)' }}
              >
                <div className="w-8 h-8 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <Plus size={13} className="text-gray-300" />
                </div>
                <span className="text-[13px] font-medium">Add New Client</span>
              </button>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-bold cursor-pointer flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
            boxShadow: `0 2px 8px ${gradientFrom}50`,
          }}
        >
          A
        </div>
      </div>
    </header>
  );
}
