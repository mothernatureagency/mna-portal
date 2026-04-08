'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/clients';

/**
 * Minimal client-facing shell.
 *
 * Only 3 nav items exist: Overview, Content Calendar, Tasks from MNA.
 * No agents, no AI, no leads, no internal planner. Branding comes from the
 * client record so the whole portal re-themes itself per client.
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
    { href: '/client/calendar', label: 'Content Calendar', icon: 'calendar_month' },
    { href: '/client/tasks', label: 'Tasks from MNA', icon: 'checklist' },
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top bar */}
      <header
        className="border-b border-black/5"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-extrabold text-lg">
              {client.shortName.charAt(0)}
            </div>
            <div>
              <div className="text-[18px] font-bold tracking-tight">{client.name}</div>
              <div className="text-[11px] opacity-80">Client portal · Mother Nature Agency</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isStaffPreview && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-300/90 text-amber-900">
                Staff preview
              </span>
            )}
            <span className="text-[12px] opacity-80 hidden md:inline">{userEmail}</span>
            <button
              onClick={signOut}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6">
          <nav className="flex gap-1">
            {nav.map((item) => {
              const active =
                item.href === '/client'
                  ? pathname === '/client'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                    active
                      ? 'text-white border-white'
                      : 'text-white/70 border-transparent hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 py-8">{children}</div>
      </main>

      <footer className="border-t border-black/5 py-6 text-center text-[11px] text-neutral-400">
        Powered by Mother Nature Agency
      </footer>
    </div>
  );
}
