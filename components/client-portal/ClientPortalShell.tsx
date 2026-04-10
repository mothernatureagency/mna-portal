'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/clients';
import { ClientPortalProvider } from './ClientPortalContext';

/**
 * Client-facing shell — dark glass theme matching the staff dashboard.
 *
 * Left sidebar navigation with client branding, dark gradient background,
 * and glass-card styling throughout.
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

  const nav = [
    { href: '/client', label: 'Overview', icon: 'dashboard' },
    { href: '/client/agenda', label: 'Agenda', icon: 'event_note' },
    { href: '/client/calendar', label: 'Content Calendar', icon: 'calendar_month' },
    { href: '/client/tasks', label: 'Tasks', icon: 'checklist' },
  ];

  const active = (href: string) =>
    href === '/client' ? pathname === '/client' : pathname.startsWith(href);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ── Left Sidebar ── */}
      <aside
        className="flex flex-col shrink-0"
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
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <ClientPortalProvider client={client} userEmail={userEmail} isStaffPreview={isStaffPreview}>
          <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
        </ClientPortalProvider>
      </main>
    </div>
  );
}
