'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClient } from '@/context/ClientContext';
import { clsx } from 'clsx';
import Logo from '@/components/logo/Logo';

// Nav sections matching the screenshot design
const navSections = [
  {
        label: 'MAIN',
        items: [
          { label: 'Overview', href: '/', emoji: '📊' },
          { label: 'Top Hooks', href: '/top-hooks', emoji: '🪝' },
          { label: 'Content Tracker', href: '/content', emoji: '📋' },
          { label: 'Ad Performance', href: '/campaigns', emoji: '💰' },
              ],
  },
  {
        label: 'CRM',
        items: [
          { label: 'Lead Tracking', href: '/leads', emoji: '🎯' },
          { label: 'Campaigns', href: '/campaigns', emoji: '🚀' },
          { label: 'Task Manager', href: '/crm', emoji: '✅' },
              ],
  },
  {
        label: 'INTELLIGENCE',
        items: [
          { label: 'AI Insights', href: '/reports', emoji: '🧠' },
              ],
  },
  ];

export default function Sidebar() {
    const pathname = usePathname();
    const { activeClient } = useClient();

  return (
        <aside
                style={{
                          width: '240px',
                          minWidth: '240px',
                          height: '100vh',
                          background: 'linear-gradient(180deg, #0f1f2e 0%, #0d1b2a 60%, #0a1628 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRight: '1px solid rgba(255,255,255,0.07)',
                          position: 'relative',
                          flexShrink: 0,
                }}
              >
          {/* Logo */}
              <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #1a7a5e, #0fa86e)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
              }}>
                                <Logo />
                      </div>div>
                      <div>
                                <div style={{ color: '#fff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.2 }}>MOTHER NATURE</div>div>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Agency</div>div>
                      </div>div>
              </div>div>
        
          {/* Active Client Block */}
              <div style={{ margin: '14px 12px 8px', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Active Client</div>div>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>{activeClient?.name || 'Prime IV Niceville'}</div>div>
              </div>div>
        
          {/* Nav Sections */}
              <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
                {navSections.map((section) => (
                          <div key={section.label} style={{ marginBottom: '6px' }}>
                            {/* Section Label */}
                                      <div style={{
                                          color: 'rgba(255,255,255,0.35)',
                                          fontSize: '9.5px',
                                          fontWeight: 700,
                                          letterSpacing: '0.14em',
                                          textTransform: 'uppercase',
                                          padding: '10px 10px 4px',
                          }}>
                                        {section.label}
                                      </div>div>
                            {/* Items */}
                            {section.items.map((item) => {
                                          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                                          return (
                                                            <Link
                                                                                key={item.href}
                                                                                href={item.href}
                                                                                style={{
                                                                                                      display: 'flex',
                                                                                                      alignItems: 'center',
                                                                                                      gap: '10px',
                                                                                                      padding: '8px 10px',
                                                                                                      borderRadius: '10px',
                                                                                                      fontSize: '13px',
                                                                                                      fontWeight: isActive ? 600 : 400,
                                                                                                      color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                                                                                                      background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                                                                      textDecoration: 'none',
                                                                                                      transition: 'all 0.15s ease',
                                                                                                      marginBottom: '1px',
                                                                                }}
                                                                              >
                                                                              <span style={{ fontSize: '15px', lineHeight: 1 }}>{item.emoji}</span>span>
                                                                              <span>{item.label}</span>span>
                                                              {isActive && (
                                                                                                    <span style={{
                                                                                                                            marginLeft: 'auto',
                                                                                                                            width: '6px', height: '6px',
                                                                                                                            borderRadius: '50%',
                                                                                                                            background: '#4ade80',
                                                                                                                            flexShrink: 0,
                                                                                                      }} />
                                                                                                  )}
                                                            </Link>Link>
                                                          );
                          })}
                          </div>div>
                        ))}
              </nav>nav>
        
          {/* Bottom active page highlight - Revenue Forecast style */}
              <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '9px 12px', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.1)',
              }}>
                                <span style={{ fontSize: '15px' }}>📈</span>span>
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Revenue Forecast</span>span>
                      </div>div>
              </div>div>
        </aside>aside>
      );
}</aside>
