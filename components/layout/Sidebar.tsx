'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { sec: 'MAIN', items: [
    { label: 'Home', href: '/', e: 'home' },
    { label: 'Schedule', href: '/schedule', e: 'calendar_today' },
    { label: 'Business Overview', href: '/overview', e: 'bar_chart' },
  ]},
  { sec: 'CONTENT', items: [
    { label: 'Content Tracker', href: '/content', e: 'grid_view' },
    { label: 'Content Planner', href: '/planner', e: 'edit_calendar' },
    { label: 'Agenda', href: '/agenda', e: 'event_note' },
  ]},
  { sec: 'EMAIL & SMS', items: [
    { label: 'Campaigns', href: '/campaigns', e: 'forward_to_inbox' },
    { label: 'Email Drafts', href: '/email-preview', e: 'mail' },
  ]},
  { sec: 'CLIENT MGMT', items: [
    { label: 'Task Manager', href: '/client-tasks', e: 'checklist' },
    { label: 'Meeting Notes', href: '/meeting-notes', e: 'description' },
    { label: 'Invoices', href: '/invoices', e: 'receipt_long' },
    { label: 'Contacts', href: '/contacts', e: 'contacts' },
  ]},
  { sec: 'ADVERTISING', items: [
    { label: 'Meta Ads (Live)', href: '/meta-ads', e: 'ads_click' },
  ]},
  { sec: 'CRM', items: [
    { label: 'Pipeline', href: '/crm', e: 'task_alt' },
  ]},
  { sec: 'INTELLIGENCE', items: [
    { label: 'AI Insights', href: '/reports', e: 'psychology' },
  ]},
  { sec: 'AGENTS', items: [
    { label: 'MNA Assistant', href: '/assistant', e: 'smart_toy' },
    { label: 'AI Agents', href: '/agents/ai', e: 'robot_2' },
    { label: 'Team Roster', href: '/agents/team', e: 'groups' },
  ]},
  { sec: 'ACCOUNT', items: [
    { label: 'Settings', href: '/settings', e: 'settings' },
    { label: 'Client View', href: '/client', e: 'swap_horiz' },
    { label: 'Contractor View', href: '/contractor', e: 'engineering' },
    { label: 'Student View', href: '/student', e: 'school' },
    { label: 'Creator Studio', href: '/creator', e: 'movie' },
  ]},
];

export function MobileMenuButton() {
  return null; // rendered in DashboardLayout instead
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const ctx = useClient();
  const client = (ctx as any)?.activeClient;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }
  const active = (href: string) => href === '/' ? path === href : (path || '').startsWith(href);

  const sidebarStyle: React.CSSProperties = {
    width: 240,
    minWidth: 240,
    height: '100vh',
    background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a 60%,#0a1628)',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,.07)',
    flexShrink: 0,
  };

  const navContent = (
    <>
      {/* Brand + Sign Out */}
      <div style={{ padding: '18px 14px 14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        {onClose && (
          <button onClick={onClose} className="md:hidden mr-1 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        )}
        <img src="/logos/mna-icon-transparent.png" alt="Mother Nature Agency" style={{ height: 32, width: 'auto', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', lineHeight: 1.2 }}>MOTHER NATURE</div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' }}>Agency</div>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.35)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
        </button>
      </div>

      {/* Active client */}
      <div style={{ margin: '14px 12px 8px', padding: '10px 14px', background: 'rgba(255,255,255,.07)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 9.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>Active Client</div>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{client?.name || 'Prime IV Niceville'}</div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
        {NAV.map((section) => (
          <div key={section.sec} style={{ marginBottom: 6 }}>
            <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '10px 10px 4px' }}>{section.sec}</div>
            {section.items.map((item) => {
              const on = active(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#fff' : 'rgba(255,255,255,.6)', background: on ? 'rgba(255,255,255,.1)' : 'transparent', textDecoration: 'none', marginBottom: 1, overflow: 'hidden' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, width: 18, height: 18, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{item.e}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex" style={sidebarStyle}>
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 260, background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a 60%,#0a1628)' }}
      >
        {navContent}
      </aside>
    </>
  );
}
