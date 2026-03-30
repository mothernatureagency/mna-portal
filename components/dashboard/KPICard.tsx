'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useClient } from '@/context/ClientContext';

type KPICardProps = {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  target?: string;
  gradient?: boolean;
};

export default function KPICard({ label, value, change, icon, target, gradient }: KPICardProps) {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const positive = change >= 0;

  if (gradient) {
    return (
      <div
        className="kpi-shimmer rounded-[20px] p-5 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
          boxShadow: `0 8px 32px ${gradientFrom}55, 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <span style={{ color: 'white', opacity: 0.95 }}>{icon}</span>
            </div>
          </div>
          <div className="text-[34px] font-extrabold tracking-tight leading-none mb-1">{value}</div>
          {target && (
            <div className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>Target: {target}</div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: positive ? 'rgba(255,255,255,0.22)' : 'rgba(255,100,100,0.35)' }}>
              {positive ? <TrendingUp size={11} className="text-white" /> : <TrendingDown size={11} className="text-red-200" />}
              <span className="text-[11px] font-semibold text-white">{positive ? '+' : ''}{change}%</span>
            </div>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>vs last month</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">{label}</div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${gradientFrom}14`, backdropFilter: 'blur(8px)' }}>
          <span style={{ color: gradientFrom }}>{icon}</span>
        </div>
      </div>
      <div className="text-[26px] font-extrabold tracking-tight leading-none text-gray-900 mb-1">{value}</div>
      {target && <div className="text-[11px] text-gray-300 mb-3">Target: {target}</div>}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: positive ? '#ecfdf5' : '#fef2f2' }}>
          {positive ? <TrendingUp size={11} className="text-emerald-600" /> : <TrendingDown size={11} className="text-red-500" />}
          <span className="text-[11px] font-semibold" style={{ color: positive ? '#059669' : '#ef4444' }}>
            {positive ? '+' : ''}{change}%
          </span>
        </div>
        <span className="text-[11px] text-gray-300">vs last month</span>
      </div>
    </div>
  );
}
