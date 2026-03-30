import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen dashboard-bg">
      <div className="relative z-10 flex w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 px-8 py-7 overflow-auto relative z-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
