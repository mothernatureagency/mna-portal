'use client';
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { leadTrendData } from '@/lib/demoData';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const periods = ['7d', '30d', '6m', '1y'];

export default function LeadTrendsChart() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const [activePeriod, setActivePeriod] = React.useState('6m');

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.97)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div className="font-semibold text-gray-800 mb-2 text-[12px]">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-bold text-gray-900">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Lead & Conversion Trends</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Performance over time</p>
        </div>
        <div
          className="flex items-center p-1 rounded-xl gap-0.5"
          style={{ background: 'rgba(0,0,0,0.04)' }}
        >
          {periods.map(t => (
            <button
              key={t}
              onClick={() => setActivePeriod(t)}
              className="px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all duration-150"
              style={t === activePeriod
                ? {
                    background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                    color: 'white',
                    boxShadow: `0 2px 6px ${gradientFrom}40`,
                  }
                : { color: '#9ca3af' }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={248}>
        <AreaChart data={leadTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientFrom} stopOpacity={0.18} />
              <stop offset="100%" stopColor={gradientFrom} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientTo} stopOpacity={0.22} />
              <stop offset="100%" stopColor={gradientTo} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px', color: '#9ca3af' }}
            iconType="circle"
            iconSize={7}
          />
          <Area
            type="monotone"
            dataKey="leads"
            stroke={gradientFrom}
            strokeWidth={2}
            fill="url(#leadsGrad)"
            name="Leads"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: gradientFrom }}
          />
          <Area
            type="monotone"
            dataKey="conversions"
            stroke={gradientTo}
            strokeWidth={2}
            fill="url(#convGrad)"
            name="Conversions"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: gradientTo }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
