'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, UserPlus, Megaphone, FileText,
  Database, BarChart2, Zap, Settings,
} from 'lucide-react';
import Logo from '@/components/logo/Logo';
import { useClient } from '@/context/ClientContext';
import { clsx } from 'clsx';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Leads', href: '/leads', icon: UserPlus },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { label: 'Content', href: '/content', icon: FileText },
  { label: 'CRM', href: '/crm', icon: Database },
  { label: 'Reports', href: '/reports', icon: BarChart2 },
  { label: 'Automations', href: '/automations', icon: Zap },
];

const bottomItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const NavLink = ({ label, href, icon: Icon }: typeof navItems[0]) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={clsx(
          'group flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 relative',
          isActive
            ? 'text-white nav-active-glow'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50/80'
        )}
        style={isActive ? {
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        } : {}}
      >
        {/* Active left indicator glow */}
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full opacity-0"
            style={{ background: gradientTo }}
          />
        )}
        <Icon
          size={15}
          className={clsx(
            'flex-shrink-0 transition-colors duration-200',
            isActive ? 'text-white/90' : 'text-gray-400 group-hover:text-gray-600'
          )}
        />
        <span className="flex-1 tracking-[-0.01em]">{label}</span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-white/50 flex-shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className="w-64 min-h-screen flex flex-col flex-shrink-0"
      style={{
        background: '#ffffff',
        borderRight: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <Logo variant="sidebar" />
      </div>

      {/* Nav label */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-gray-300 uppercase">
          Navigation
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-5 h-px bg-gray-100" />

      {/* Bottom nav */}
      <div className="px-3 py-3">
        {bottomItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </div>

      {/* Pro plan badge */}
      <div className="px-4 pb-5">
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}12 0%, ${gradientTo}18 100%)`,
            border: `1px solid ${gradientFrom}20`,
          }}
        >
          {/* Decorative dot */}
          <div
            className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse-slow"
            style={{ background: gradientTo }}
          />
          <div
            className="text-[11px] font-bold mb-0.5"
            style={{ color: gradientFrom }}
          >
            Pro Plan Active
          </div>
          <div className="text-[11px] text-gray-400 leading-relaxed">
            All features enabled
          </div>
        </div>
      </div>
    </aside>
  );
}
