'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PieChart, Pie } from 'recharts';
import { adPerformanceData, platformBreakdownData } from '@/lib/demoData';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

export default function AdPerformanceChart() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const colors = [gradientFrom, gradientTo, '#5bc4d4', '#1a91c9'];

  const updatedPlatformData = platformBreakdownData.map((item, i) => ({
    ...item,
    color: colors[i % colors.length],
  }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
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
        <div className="font-semibold text-gray-800 mb-1.5 text-[12px]">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="text-[12px]">
            <span className="text-gray-500">{p.name}: </span>
            <span className="font-bold text-gray-900">${p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

      {/* Bar chart — wider */}
      <Card className="p-6 lg:col-span-3">
        <div className="mb-5">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Ad Spend by Platform</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Total spend this month</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={adPerformanceData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis
              dataKey="platform"
              tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 8 }} />
            <Bar dataKey="spend" name="Ad Spend" radius={[8, 8, 0, 0]}>
              {adPerformanceData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* CPL summary row */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          {adPerformanceData.map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-[11px] font-bold mb-0.5" style={{ color: colors[i % colors.length] }}>
                {d.platform}
              </div>
              <div className="text-[13px] font-extrabold text-gray-900">${d.cpl.toFixed(0)}</div>
              <div className="text-[10px] text-gray-400">CPL</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pie chart — narrower */}
      <Card className="p-6 lg:col-span-2">
        <div className="mb-5">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Lead Sources</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Distribution this month</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={updatedPlatformData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={76}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {updatedPlatformData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                fontSize: '12px',
              }}
              formatter={(v) => [`${v}%`, 'Share']}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Manual legend */}
        <div className="space-y-2 mt-2">
          {updatedPlatformData.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-[12px] text-gray-600">{item.name}</span>
              </div>
              <span className="text-[12px] font-bold text-gray-900">{item.value}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
