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
          isActive ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
        )}
        style={isActive ? {
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
          boxShadow: `0 4px 12px ${gradientFrom}40, 0 1px 3px rgba(0,0,0,0.1)`,
        } : {}}
      >
        <Icon
          size={15}
          className={clsx(
            'flex-shrink-0 transition-colors duration-200',
            isActive ? 'text-white/90' : 'text-gray-400 group-hover:text-gray-600'
          )}
        />
        <span className="flex-1 tracking-[-0.01em]">{label}</span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <aside className="glass-sidebar w-64 min-h-screen flex flex-col flex-shrink-0 relative z-10">
      {/* Logo */}
      <div className="h-16 flex items-center px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
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
      <div className="mx-5 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

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
            background: `linear-gradient(135deg, ${gradientFrom}14 0%, ${gradientTo}20 100%)`,
            border: `1px solid ${gradientFrom}25`,
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Glowing dot */}
          <div
            className="absolute top-3 right-3 w-2 h-2 rounded-full"
            style={{ background: gradientTo, boxShadow: `0 0 6px ${gradientTo}80` }}
          />
          <div className="text-[11px] font-bold mb-0.5" style={{ color: gradientFrom }}>
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
