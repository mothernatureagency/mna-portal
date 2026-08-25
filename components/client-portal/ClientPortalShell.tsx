'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/clients';
import { ClientPortalProvider } from './ClientPortalContext';
import { PortalEditProvider, usePortalEdit } from './PortalEditContext';
import PortalSharingPanel from './PortalSharingPanel';
import {
  EMPTY_LAYOUT,
  PORTAL_PAGES,
  pageHrefForPathname,
  pageForHref,
  type PortalContent,
  type PortalLayout,
} from '@/lib/portal-layout';

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
  accessibleClients,
  portalLayout,
  portalContent,
  children,
}: {
  client: Client;
  userEmail: string;
  isStaffPreview: boolean;
  accessibleClients?: Client[];
  portalLayout?: PortalLayout;
  portalContent?: PortalContent;
  children: React.ReactNode;
}) {
  return (
    <PortalEditProvider
      client={client}
      canEdit={isStaffPreview}
      initialLayout={portalLayout || EMPTY_LAYOUT}
      initialContent={portalContent || {}}
    >
      <ShellBody
        client={client}
        userEmail={userEmail}
        isStaffPreview={isStaffPreview}
        accessibleClients={accessibleClients}
      >
        {children}
      </ShellBody>
    </PortalEditProvider>
  );
}

function ShellBody({
  client,
  userEmail,
  isStaffPreview,
  accessibleClients,
  children,
}: {
  client: Client;
  userEmail: string;
  isStaffPreview: boolean;
  accessibleClients?: Client[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { gradientFrom, gradientTo } = client.branding;
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasMultipleClients = accessibleClients && accessibleClients.length > 1;

  function switchClient(clientId: string) {
    // Set cookie and reload to pick up the new client in the server layout
    document.cookie = `mna_portal_client=${clientId};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  const { canEdit, editMode, setEditMode, pageShared, togglePage, paused, saving, error } = usePortalEdit();
  const [sharingOpen, setSharingOpen] = useState(false);

  // In edit mode staff see every page (so they can re-share one); otherwise the
  // nav is exactly what this client is allowed to see.
  const nav = PORTAL_PAGES.filter((p) => editMode || pageShared(p.href));

  // Direct navigation to an un-shared page falls back to a notice instead of
  // the page body.
  const currentPageHref = pageHrefForPathname(pathname);
  const pageBlocked = !!currentPageHref && !pageShared(currentPageHref) && !canEdit;
  const portalPaused = paused && !canEdit;

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

      {/* Client switcher (multi-client accounts) */}
      {hasMultipleClients && (
        <div className="mx-3 mt-3 mb-1">
          <div className="text-[9.5px] font-semibold text-white/40 uppercase tracking-widest px-1 mb-1.5">Switch Account</div>
          <div className="space-y-1">
            {accessibleClients!.map((cl) => (
              <button
                key={cl.id}
                onClick={() => switchClient(cl.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] transition-all ${
                  cl.id === client.id
                    ? 'bg-white/12 text-white font-bold ring-1 ring-white/20'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-extrabold text-[10px] shrink-0"
                  style={{ background: `linear-gradient(135deg, ${cl.branding.gradientFrom}, ${cl.branding.gradientTo})` }}
                >
                  {cl.shortName.charAt(0)}
                </div>
                <span className="truncate">{cl.shortName}</span>
                {cl.id === client.id && (
                  <span className="material-symbols-outlined ml-auto text-emerald-400" style={{ fontSize: 14 }}>check</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between px-2.5 mb-2">
          <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-widest">Navigation</span>
          {editMode && (
            <span className="text-[9px] font-bold text-white/35 uppercase tracking-wider">
              {nav.filter((p) => pageShared(p.href)).length}/{nav.length} shared
            </span>
          )}
        </div>
        {nav.map((item) => {
          const on = active(item.href);
          const shared = pageShared(item.href);
          const locked = !!pageForHref(item.href)?.locked;
          return (
            <div key={item.href} className="flex items-center gap-1 mb-0.5">
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? 'rgba(255,255,255,.1)' : 'transparent',
                  color: on ? '#fff' : 'rgba(255,255,255,.6)',
                  fontWeight: on ? 600 : 400,
                  fontSize: 13,
                  opacity: editMode && !shared ? 0.45 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
              {editMode && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => togglePage(item.href, !shared)}
                  title={
                    locked
                      ? 'The Overview page is always shared'
                      : shared
                      ? 'Shared with this client — click to hide'
                      : 'Hidden from this client — click to share'
                  }
                  className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                    locked
                      ? 'text-white/20 cursor-not-allowed'
                      : shared
                      ? 'text-emerald-400 hover:bg-emerald-500/20'
                      : 'text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {locked ? 'lock' : shared ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2.5 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
        {canEdit && (
          <>
            <button
              onClick={() => { setSharingOpen(true); setMobileOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-0.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span>
              Sharing &amp; access
              {paused ? (
                <span className="ml-auto text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-200">
                  Paused
                </span>
              ) : (
                <span className="ml-auto text-[9px] font-bold text-white/35">
                  {nav.filter((p) => pageShared(p.href)).length}/{PORTAL_PAGES.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] mb-0.5 transition-colors ${
                editMode
                  ? 'bg-amber-400/20 text-amber-200 font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {editMode ? 'edit_off' : 'edit_note'}
              </span>
              {editMode ? 'Done editing' : 'Edit portal'}
            </button>
            {editMode && (
              <div className="px-2.5 pb-2 text-[9.5px] leading-snug text-white/40">
                Editing <span className="text-white/70 font-semibold">{client.shortName}</span>. Changes save
                automatically and apply to this client only.
                {saving && <span className="block text-amber-300 mt-0.5">Saving…</span>}
                {error && <span className="block text-rose-300 mt-0.5">{error}</span>}
              </div>
            )}
          </>
        )}
        <Link
          href="/client/security"
          onClick={() => setMobileOpen(false)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-0.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shield_lock</span>
          Account Security
        </Link>
        {isStaffPreview && (
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-white/60 hover:text-[#4ab8ce] hover:bg-[rgba(74,184,206,.15)] transition-colors mb-0.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>swap_horiz</span>
            Switch to Admin
          </button>
        )}
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

        {canEdit && paused && (
          <div
            className="flex flex-wrap items-center gap-2 px-4 md:px-8 py-2"
            style={{ background: 'rgba(244,63,94,.18)', borderBottom: '1px solid rgba(244,63,94,.4)' }}
          >
            <span className="material-symbols-outlined text-rose-300" style={{ fontSize: 16 }}>pause_circle</span>
            <span className="text-[11px] font-bold text-rose-100">
              Sharing is paused — {client.name} can&apos;t see their portal right now.
            </span>
            <button
              onClick={() => setSharingOpen(true)}
              className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-400/25 text-rose-100 hover:bg-rose-400/40"
            >
              Resume
            </button>
          </div>
        )}

        {editMode && (
          <div
            className="sticky top-0 z-20 flex flex-wrap items-center gap-2 px-4 md:px-8 py-2"
            style={{ background: 'rgba(245,158,11,.16)', borderBottom: '1px solid rgba(245,158,11,.35)', backdropFilter: 'blur(10px)' }}
          >
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 16 }}>tune</span>
            <span className="text-[11px] font-bold text-amber-100">
              Editing {client.name}&apos;s portal
            </span>
            <span className="text-[11px] text-amber-100/70">
              Click any value to edit it · use the Shared / Hidden pills to choose what this client sees
            </span>
            <button
              onClick={() => setSharingOpen(true)}
              className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-400/25 text-amber-100 hover:bg-amber-400/40"
            >
              Sharing &amp; access
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-400/25 text-amber-100 hover:bg-amber-400/40"
            >
              Done
            </button>
          </div>
        )}

        <ClientPortalProvider client={client} userEmail={userEmail} isStaffPreview={isStaffPreview}>
          <div className="max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
            {portalPaused ? (
              <div className="glass-card p-10 text-center">
                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 34 }}>pause_circle</span>
                <div className="text-[15px] font-bold text-white mt-2">Your portal is being updated</div>
                <div className="text-[12px] text-white/50 mt-1">
                  Your Mother Nature Agency team has paused access while they refresh your reporting. It&apos;ll be back shortly.
                </div>
              </div>
            ) : pageBlocked ? (
              <div className="glass-card p-10 text-center">
                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 34 }}>visibility_off</span>
                <div className="text-[15px] font-bold text-white mt-2">This section isn&apos;t part of your portal</div>
                <div className="text-[12px] text-white/50 mt-1">
                  Reach out to your Mother Nature Agency contact if you need access.
                </div>
                <Link
                  href="/client"
                  className="inline-block mt-4 text-[12px] font-semibold px-3.5 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
                >
                  Back to Overview
                </Link>
              </div>
            ) : (
              children
            )}
          </div>
        </ClientPortalProvider>
      </main>

      {sharingOpen && <PortalSharingPanel onClose={() => setSharingOpen(false)} />}
    </div>
  );
}
