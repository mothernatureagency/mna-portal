'use client';
import React from 'react';
import { Sparkles, Zap, Target, MessageCircle, TrendingUp, ArrowRight, Brain } from 'lucide-react';
import { aiInsights } from '@/lib/demoData';
import { useClient } from '@/context/ClientContext';

const priorityConfig = {
  critical: {
    label: 'Critical',
    badgeBg: 'rgba(239,68,68,0.1)',
    badgeText: '#dc2626',
    rowBg: 'rgba(254,242,242,0.6)',
    rowBorder: 'rgba(252,165,165,0.4)',
    dot: '#ef4444',
  },
  high: {
    label: 'High Priority',
    badgeBg: 'rgba(245,158,11,0.1)',
    badgeText: '#d97706',
    rowBg: 'rgba(255,251,235,0.6)',
    rowBorder: 'rgba(253,211,77,0.4)',
    dot: '#f59e0b',
  },
  medium: {
    label: 'Recommended',
    badgeBg: 'rgba(16,185,129,0.1)',
    badgeText: '#059669',
    rowBg: 'rgba(240,253,244,0.6)',
    rowBorder: 'rgba(167,243,208,0.4)',
    dot: '#10b981',
  },
};

const typeIcon = (type: string) => {
  if (type === 'action') return <Zap size={13} />;
  if (type === 'campaign') return <Target size={13} />;
  if (type === 'followup') return <MessageCircle size={13} />;
  return <TrendingUp size={13} />;
};

export default function AIInsightsPanel() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div
      className="rounded-[20px] overflow-hidden"
      style={{
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 40px ${gradientFrom}12`,
      }}
    >
      {/* Header band */}
      <div
        className="px-6 py-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        }}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 animate-glow-pulse"
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
        >
          <Brain size={18} className="text-white" />
        </div>

        <div className="flex-1">
          <div className="text-white font-bold text-[15px] tracking-tight">AI Intelligence Panel</div>
          <div className="text-white/60 text-[11px] mt-0.5">Smart recommendations powered by your data</div>
        </div>

        {/* Live badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[11px] font-semibold">{aiInsights.length} Active Insights</span>
        </div>
      </div>

      {/* Insights list */}
      <div className="bg-white px-6 py-5 space-y-3">
        {aiInsights.map((insight, i) => {
          const config = priorityConfig[insight.priority as keyof typeof priorityConfig];
          return (
            <div
              key={i}
              className="flex gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] group"
              style={{
                background: config.rowBg,
                border: `1px solid ${config.rowBorder}`,
              }}
            >
              {/* Type icon */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: config.badgeBg, color: config.badgeText }}
              >
                {typeIcon(insight.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[13px] font-bold text-gray-900">{insight.title}</span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: config.badgeBg, color: config.badgeText }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                      style={{ background: config.dot }}
                    />
                    {config.label}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{insight.description}</p>
              </div>

              <ArrowRight
                size={14}
                className="flex-shrink-0 mt-1.5 transition-all duration-200 group-hover:translate-x-0.5"
                style={{ color: '#d1d5db' }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(248,250,252,0.8)',
          borderTop: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={11} style={{ color: gradientTo }} />
          <span className="text-[11px] text-gray-400">Updated just now · Based on last 30 days of data</span>
        </div>
        <button
          className="flex items-center gap-1.5 text-[12px] font-semibold transition-all hover:gap-2"
          style={{ color: gradientFrom }}
        >
          View all insights
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
