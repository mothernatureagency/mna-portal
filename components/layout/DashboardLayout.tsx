import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
          <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #0d1b2a 0%, #0f2236 40%, #0a1e35 70%, #0d2040 100%)' }}>
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', width: '100%' }}>
                            <Sidebar />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <Header />
                                        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', position: 'relative', zIndex: 10 }}>
                                          {children}
                                        </main>main>
                            </div>div>
                  </div>div>
          </div>div>
        );
}
