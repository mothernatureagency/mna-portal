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
                  <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
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
  
    const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, value }: { cx: number; cy: number; midAngle: number; outerRadius: number; name: string; value: number }) => {
          const RADIAN = Math.PI / 180;
          const radius = outerRadius + 26;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          return (
                  <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Inter' }}>
                    {name} {value}%
                  </text>
                );
    };
  
    return (
          <div className="grid gap-5" style={{ gridTemplateColumns: '3fr 2fr' }}>
            {/* Bar chart */}
                <Card className="p-6">
                        <div className="mb-5">
                                  <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Ad Spend by Platform</h3>
                                  <p className="text-[11px] text-gray-400 mt-0.5">Total spend this month</p>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={adPerformanceData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barSize={32}>
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                                              <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                              <YAxis tick={{ fontSize: 11, fill: '#b0bac9', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                                              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 8 }} />
                                              <Bar dataKey="spend" name="Ad Spend" radius={[8, 8, 0, 0]}>
                                                {adPerformanceData.map((_, i) => (
                            <Cell key={i} fill={colors[i % colors.length]} />
                          ))}
                                              </Bar>
                                  </BarChart>
                        </ResponsiveContainer>
                
                  {/* CPL row — horizontal grid UNDER the chart */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                          {adPerformanceData.map((d, i) => (
                        <div key={i} style={{ background: colors[i % colors.length] + '10', border: '1px solid ' + colors[i % colors.length] + '25', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: colors[i % colors.length], marginBottom: 3 }}>{d.platform}</div>
                                      <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', lineHeight: 1 }}>${d.cpl.toFixed(0)}</div>
                                      <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginTop: 1 }}>CPL</div>
                                      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3 }}>${(d.spend / 1000).toFixed(1)}K spent</div>
                        </div>
                      ))}
                        </div>
                </Card>
          
            {/* Pie chart */}
                <Card className="p-6">
                        <div className="mb-3">
                                  <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Lead Sources</h3>
                                  <p className="text-[11px] text-gray-400 mt-0.5">Distribution this month</p>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                                  <PieChart>
                                              <Pie
                                                              data={updatedPlatformData}
                                                              cx="50%"
                                                              cy="50%"
                                                              innerRadius={46}
                                                              outerRadius={70}
                                                              paddingAngle={3}
                                                              dataKey="value"
                                                              strokeWidth={0}
                                                              label={renderPieLabel}
                                                              labelLine={false}
                                                            >
                                                {updatedPlatformData.map((entry, i) => (
                                                                              <Cell key={i} fill={entry.color} />
                                                                            ))}
                                              </Pie>
                                              <Tooltip
                                                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: '12px' }}
                                                              formatter={(v) => [v + '%', 'Share']}
                                                            />
                                  </PieChart>
                        </ResponsiveContainer>
                </Card>
          </div>
        );
}
