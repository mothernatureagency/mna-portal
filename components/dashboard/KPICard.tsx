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

  // ─── Hero gradient card (primary KPI)
  if (gradient) {
    return (
      <div
        className="rounded-[20px] p-5 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
          boxShadow: `0 4px 16px ${gradientFrom}50, 0 2px 4px rgba(0,0,0,0.12)`,
        }}
      >
        {/* Decorative orb */}
        <div
          className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
          style={{ background: 'white' }}
        />
        <div
          className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10"
          style={{ background: 'white' }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div
              className="text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              {label}
            </div>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <span style={{ color: 'white', opacity: 0.9 }}>{icon}</span>
            </div>
          </div>

          <div className="text-[32px] font-extrabold tracking-tight leading-none mb-1">
            {value}
          </div>

          {target && (
            <div className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Target: {target}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: positive ? 'rgba(255,255,255,0.2)' : 'rgba(255,100,100,0.3)' }}
            >
              {positive
                ? <TrendingUp size={11} className="text-white" />
                : <TrendingDown size={11} className="text-red-200" />
              }
              <span className="text-[11px] font-semibold text-white">
                {positive ? '+' : ''}{change}%
              </span>
            </div>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              vs last month
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Standard KPI card
  return (
    <div
      className="bg-white rounded-[20px] p-5 transition-all duration-200 hover:-translate-y-[1px]"
      style={{
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px rgba(12,109,164,0.05)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400"
        >
          {label}
        </div>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${gradientFrom}12` }}
        >
          <span style={{ color: gradientFrom }}>{icon}</span>
        </div>
      </div>

      <div className="text-[26px] font-extrabold tracking-tight leading-none text-gray-900 mb-1">
        {value}
      </div>

      {target && (
        <div className="text-[11px] text-gray-300 mb-3">
          Target: {target}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{
            background: positive ? '#ecfdf5' : '#fef2f2',
          }}
        >
          {positive
            ? <TrendingUp size={11} className="text-emerald-600" />
            : <TrendingDown size={11} className="text-red-500" />
          }
          <span
            className="text-[11px] font-semibold"
            style={{ color: positive ? '#059669' : '#ef4444' }}
          >
            {positive ? '+' : ''}{change}%
          </span>
        </div>
        <span className="text-[11px] text-gray-300">vs last month</span>
      </div>
    </div>
  );
}
