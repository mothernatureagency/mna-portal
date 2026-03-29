'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';
import { BarChart2 } from 'lucide-react';

export default function ReportsPage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Deep-dive analytics and custom reports</p>
      </div>
      <Card className="p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-glow"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
          <BarChart2 size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-400 text-sm mt-1 max-w-sm">Deep-dive analytics, custom reports, and exportable insights for stakeholders.</p>
        </div>
        <div className="flex gap-3 mt-2">
          <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">Coming Soon</span>
          <span className="text-xs px-3 py-1.5 rounded-full text-white font-medium"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            Request Early Access
          </span>
        </div>
      </Card>
    </div>
  );
}
