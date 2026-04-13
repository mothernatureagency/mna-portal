'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/clients';
import { ClientPortalProvider } from './ClientPortalContext';

/**
 * Client-facing shell — dark glass theme matching the staff dashboard.
 *
 * Left sidebar navigation with client branding, dark gradient background,
 * and glass-card styling throughout. Sidebar collapses to hamburger on mobile.
 */
export default function ClientPortalShell({
  client,
  userEmail,
  isStaffPreview,
  children,
}: {
  client: Client;
  userEmail: string;
  isStaffPreview: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { gradientFrom, gradientTo } = client.branding;
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    { href: '/client', label: 'Overview', icon: 'dashboard' },
    { href: '/client/agenda', label: 'Agenda', icon: 'event_note' },
    { href: '/client/calendar', label: 'Content Calendar', icon: 'calendar_month' },
    { href: '/client/campaigns', label: 'Campaigns', icon: 'campaign' },
    { href: '/client/tasks', label: 'Tasks', icon: 'checklist' },
  ];

  const active = (href: string) =>
    href === '/client' ? pathname === '/client' : pathname.startsWith(href);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const sidebarContent = (
    <>
      {/* Brand block */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-[14px] shrink-0"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
        >
          {client.shortName.charAt(0)}
        </div>
        <div>
          <div className="text-[12px] font-bold text-white leading-tight tracking-tight">{client.name}</div>
          <div className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">Client Portal</div>
        </div>
      </div>

      {/* User block */}
      <div
        className="mx-3 mt-3 mb-2 px-3.5 py-2.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}
      >
        <div className="text-[9.5px] font-semibold text-white/40 uppercase tracking-widest mb-0.5">Signed in as</div>
        <div className="text-[12px] font-semibold text-white truncate">{userEmail}</div>
        {isStaffPreview && (
          <span className="mt-1 inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
            Staff preview
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="text-[9.5px] font-bold text-white/30 uppercase tracking-widest px-2.5 mb-2">Navigation</div>
        {nav.map((item) => {
          const on = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl mb-0.5 transition-colors"
              style={{
                background: on ? 'rgba(255,255,255,.1)' : 'transparent',
                color: on ? '#fff' : 'rgba(255,255,255,.6)',
                fontWeight: on ? 600 : 400,
                fontSize: 13,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2.5 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          Sign out
        </button>
        <div className="text-[9px] text-white/25 text-center mt-3">
          Powered by Mother Nature Agency
        </div>
      </div>
    </>
  );

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col shrink-0"
        style={{
          width: 240,
          minWidth: 240,
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a 60%,#0a1628)',
          borderRight: '1px solid rgba(255,255,255,.07)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar drawer ── */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: 260,
          background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a 60%,#0a1628)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{ background: 'rgba(15,31,46,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu</span>
          </button>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-extrabold text-[11px] shrink-0"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            {client.shortName.charAt(0)}
          </div>
          <div className="text-[13px] font-bold text-white truncate">{client.name}</div>
        </div>

        <ClientPortalProvider client={client} userEmail={userEmail} isStaffPreview={isStaffPreview}>
          <div className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">{children}</div>
        </ClientPortalProvider>
      </main>
    </div>
  );
}
