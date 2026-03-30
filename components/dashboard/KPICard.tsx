'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useClient } from '@/context/ClientContext';
type KPICardProps = {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  target: string;
  gradient?: boolean;
};
export default function KPICard({ label, value, change, icon, target, gradient }) {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const positive = change >= 0;

  const TrendIcon = positive ? TrendingUp : TrendingDown;
  const trendColor = gradient ? 'text-white' : positive ? 'text-emerald-600' : 'text-red-500';
  const trendBg = gradient
    ? positive ? 'rgba(255,255,255,0.2)' : 'rgba(255,100,100,0.3)'
    : positive ? '#ecfdf5' : '#fef2f2';

  return (
    <div
      className={`rounded-[20px] p-5 relative ${gradient ? 'text-white overflow-hidden' : 'bg-white'}`}
      style={{
        background: gradient ? `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` : undefined,
        border: gradient ? undefined : '1px solid rgba(0,0,0,0.05)',
        boxShadow: gradient
          ? `0 4px 16px ${gradientFrom}50`
          : '0 1px 2px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      {gradient && (
        <>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10 bg-white" />
        </>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${gradient ? '' : 'text-gray-400'}`}>
          {label}
        </div>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: gradient ? 'rgba(255,255,255,0.2)' : `${gradientFrom}12` }}
        >
          <span style={{ color: gradient ? 'white' : gradientFrom }}>{icon}</span>
        </div>
      </div>

      <div className={`font-extrabold tracking-tight leading-none mb-1 ${gradient ? 'text-[32px]' : 'text-[26px] text-gray-900'}`}>
        {value}
      </div>

      {target && (
        <div className={`text-[11px] mb-3 ${gradient ? '' : 'text-gray-300'}`}>
          Target: {target}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: trendBg }}>
          <TrendIcon size={11} className={trendColor} />
          <span className={`text-[11px] font-semibold ${gradient ? 'text-white' : ''}`}>
            {positive ? '+' : ''}{change}%
          </span>
        </div>
        <span className={`text-[11px] ${gradient ? '' : 'text-gray-300'}`}>
          vs last month
        </span>
      </div>
    </div>
  );
}
