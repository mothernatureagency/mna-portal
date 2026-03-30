'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const months = [
  { month: 'January', actual: 142, projected: 138 },
  { month: 'February', actual: 128, projected: 145, partial: true },
  { month: 'March', actual: null, projected: 162, future: true },
  ];

export default function FinancialProjections() {
    const { activeClient } = useClient();
    const { gradientFrom, gradientTo } = activeClient.branding;
    const maxVal = 180;

  return (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          {/* Revenue Forecast Chart */}
                <Card className="p-6">
                        <div className="flex items-start justify-between mb-5">
                                  <div>
                                              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Revenue Forecast — Q2 2026</h3>h3>
                                              <p className="text-[11px] text-gray-400 mt-0.5">Projected vs actual monthly revenue</p>p>
                                  </div>div>
                                  <div className="px-3 py-1 rounded-full text-[11px] font-bold" style={{ background: '#ecfdf5', color: '#059669' }}>
                                              On Track ✓
                                  </div>div>
                        </div>div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
                          {months.map((m) => (
                      <div key={m.month} style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 80, marginBottom: 8 }}>
                                      {m.actual !== null && (
                                          <div
                                                                title={`Actual: $${m.actual}K`}
                                                                style={{
                                                                                        width: 28,
                                                                                        height: Math.round((m.actual / maxVal) * 80),
                                                                                        background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})`,
                                                                                        borderRadius: '5px 5px 0 0',
                                                                                        position: 'relative',
                                                                }}
                                                              >
                                                              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: gradientFrom, whiteSpace: 'nowrap' }}>
                                                                                    ${m.actual}K
                                                              </div>div>
                                          </div>div>
                                                    )}
                                                    <div
                                                                        title={`Projected: $${m.projected}K`}
                                                                        style={{
                                                                                              width: 28,
                                                                                              height: Math.round((m.projected / maxVal) * 80),
                                                                                              background: m.future ? 'repeating-linear-gradient(45deg,#bae6fd,#bae6fd 3px,#e0f2fe 3px,#e0f2fe 6px)' : `${gradientFrom}20`,
                                                                                              border: `2px dashed ${m.future ? gradientFrom : gradientFrom + '60'}`,
                                                                                              borderRadius: '5px 5px 0 0',
                                                                                              position: 'relative',
                                                                        }}
                                                                      >
                                                      {m.future && (
                                                                                            <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: gradientFrom, whiteSpace: 'nowrap' }}>
                                                                                                                  ${m.projected}K*
                                                                                              </div>div>
                                                                      )}
                                                    </div>div>
                                    </div>div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{m.month}</div>div>
                        {m.future && <div style={{ fontSize: 9, color: '#9ca3af' }}>Forecast</div>div>}
                      </div>div>
                    ))}
                        </div>div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <div style={{ width: 12, height: 12, background: `linear-gradient(180deg,${gradientFrom},${gradientTo})`, borderRadius: 3 }} />
                                              <span style={{ fontSize: 11, color: '#6b7280' }}>Actual Revenue</span>span>
                                  </div>div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <div style={{ width: 12, height: 12, background: '#bae6fd', border: `2px dashed ${gradientFrom}`, borderRadius: 3 }} />
                                              <span style={{ fontSize: 11, color: '#6b7280' }}>Projected</span>span>
                                  </div>div>
                                  <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>*Based on current pipeline velocity</div>div>
                        </div>div>
                </Card>Card>
        
          {/* Financial KPI sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Q2 Projection */}
                      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 16, padding: '18px 20px', color: 'white' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Q2 2026 Projection</div>div>
                                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>$432K</div>div>
                                <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 10 }}>vs Q1 actual: $318K</div>div>
                                <span style={{ background: '#22c55e', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99 }}>+35.8% QoQ ↑</span>span>
                      </div>div>
              
                {/* Blended ROAS */}
                      <Card className="p-4">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div>
                                                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>Blended ROAS</div>div>
                                                          <div style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginTop: 2 }}>6.99x</div>div>
                                            </div>div>
                                            <div style={{ background: '#ecfdf5', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#059669' }}>+0.8x ↑</div>div>
                                </div>div>
                                <div style={{ height: 5, background: '#f0fdf4', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                                            <div style={{ height: '100%', width: '70%', background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 99 }} />
                                </div>div>
                                <div style={{ fontSize: 10, color: '#9ca3af' }}>Goal: 8x ROAS by Q3</div>div>
                      </Card>Card>
              
                {/* Avg Client LTV */}
                      <Card className="p-4">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div>
                                                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>Avg Client LTV</div>div>
                                                          <div style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginTop: 2 }}>$2,490</div>div>
                                            </div>div>
                                            <div style={{ background: '#eff6ff', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>+$210 ↑</div>div>
                                </div>div>
                                <div style={{ height: 5, background: '#eff6ff', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                                            <div style={{ height: '100%', width: '83%', background: `linear-gradient(90deg,${gradientFrom},${gradientTo})`, borderRadius: 99 }} />
                                </div>div>
                                <div style={{ fontSize: 10, color: '#9ca3af' }}>CAC: $42.40 — LTV:CAC ratio 58:1</div>div>
                      </Card>Card>
              </div>div>
        </div>div>
      );
}</Card>
