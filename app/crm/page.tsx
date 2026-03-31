'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';
import { Database } from 'lucide-react';

export default function CRMPage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">CRM</h1>
        <p className="text-sm text-gray-400 mt-0.5">Full customer relationship management</p>
      </div>
      <Card className="p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-glow"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
          <Database size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">CRM</h2>
          <p className="text-gray-400 text-sm mt-1 max-w-sm">Full customer relationship management — track conversations, deals, and touchpoints.</p>
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
