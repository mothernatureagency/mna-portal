'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="relative z-10 flex w-full">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar with hamburger */}
          <div
            className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
            style={{
              background: 'rgba(15,31,46,0.92)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu</span>
            </button>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 800, fontSize: 10 }}>MN</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Mother Nature</div>
          </div>
          {/* Desktop header */}
          <div className="hidden md:block">
            <Header />
          </div>
          <main style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 10 }} className="px-4 py-5 md:px-8 md:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
