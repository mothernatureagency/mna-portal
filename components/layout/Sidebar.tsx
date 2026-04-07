'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClient } from '@/context/ClientContext';

const NAV = [
  { sec: 'MAIN', items: [
    { label: 'Overview', href: '/', e: 'bar_chart' },
    { label: 'Top Hooks', href: '/top-hooks', e: 'bolt' },
    { label: 'Content Tracker', href: '/content', e: 'grid_view' },
    { label: 'Ad Performance', href: '/campaigns', e: 'paid' },
  ]},
  { sec: 'CRM', items: [
    { label: 'Lead Tracking', href: '/leads', e: 'track_changes' },
    { label: 'Campaigns', href: '/campaigns', e: 'rocket_launch' },
    { label: 'Task Manager', href: '/crm', e: 'task_alt' },
  ]},
  { sec: 'INTELLIGENCE', items: [
    { label: 'AI Insights', href: '/reports', e: 'psychology' },
  ]},
  { sec: 'AGENTS', items: [
    { label: 'AI Agents', href: '/agents/ai', e: 'smart_toy' },
    { label: 'Team Roster', href: '/agents/team', e: 'groups' },
  ]},
];

export default function Sidebar() {
  const path = usePathname();
  const ctx = useClient();
  const client = (ctx as any)?.activeClient;
  const active = (href: string) => href === '/' ? path === href : (path || '').startsWith(href);

  return React.createElement('aside', {
    style: { width: 240, minWidth: 240, height: '100vh', background: 'linear-gradient(180deg,#0f1f2e,#0d1b2a 60%,#0a1628)', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }
  },
    React.createElement('div', { style: { padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.07)' } },
      React.createElement('div', { style: { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, 'MN'),
      React.createElement('div', null,
        React.createElement('div', { style: { color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', lineHeight: 1.2 } }, 'MOTHER NATURE'),
        React.createElement('div', { style: { color: 'rgba(255,255,255,.5)', fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' } }, 'Agency')
      )
    ),
    React.createElement('div', { style: { margin: '14px 12px 8px', padding: '10px 14px', background: 'rgba(255,255,255,.07)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' } },
      React.createElement('div', { style: { color: 'rgba(255,255,255,.45)', fontSize: 9.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 } }, 'Active Client'),
      React.createElement('div', { style: { color: '#fff', fontSize: 13, fontWeight: 700 } }, client?.name || 'Prime IV Niceville')
    ),
    React.createElement('nav', { style: { flex: 1, overflowY: 'auto', padding: '8px 10px 16px' } },
      ...NAV.map(function(section) {
        return React.createElement('div', { key: section.sec, style: { marginBottom: 6 } },
          React.createElement('div', { style: { color: 'rgba(255,255,255,.35)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', padding: '10px 10px 4px' } }, section.sec),
          ...section.items.map(function(item) {
            var on = active(item.href);
            return React.createElement(Link, { key: item.href, href: item.href, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#fff' : 'rgba(255,255,255,.6)', background: on ? 'rgba(255,255,255,.1)' : 'transparent', textDecoration: 'none', marginBottom: 1 } },
              React.createElement('span', { className: 'material-symbols-outlined', style: { fontSize: 16 } }, item.e),
              React.createElement('span', null, item.label)
            );
          })
        );
      })
    ),
    React.createElement('div', { style: { padding: 10, borderTop: '1px solid rgba(255,255,255,.07)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' } },
        React.createElement('span', { style: { fontSize: 15 } }, '>>'),
        React.createElement('span', { style: { color: '#fff', fontSize: 13, fontWeight: 600 } }, 'Revenue Forecast')
      )
    )
  );
}
