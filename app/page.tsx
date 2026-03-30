'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import LeadTrendsChart from '@/components/dashboard/LeadTrendsChart';
import AdPerformanceChart from '@/components/dashboard/AdPerformanceChart';
import CRMSnapshot from '@/components/dashboard/CRMSnapshot';
import ContentSection from '@/components/dashboard/ContentSection';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import FinancialProjections from '@/components/dashboard/FinancialProjections';
import LeadFollowUp from '@/componentsdashboard/LeadFollowUp';
import ContentCalendar from '@/components/dashboard/ContentCalendar';
import Card from '@/components/ui/Card';

// ── KPI data ────────────────────────────────────────────────────────────────
const kpiTop = [
  { label: 'Total Leads', value: '468', change: 18, target: 500, current: 468, color: '#0ea5e9', colorTo: '#0369a1', featured: true },
  { label: 'Cost Per Lead', value: '$42.40', change: -8, target: '$45.00', pct: 94, color: '#3b82f6', positive: true, note: '-8% below target' },
  { label: 'Conversion Rate', value: '13.2%', change: 4, target: '12%', pct: 110, color: '#8b5cf6', positive: true, note: '+10% above target' },
  ];
const kpiBottom = [
  { label: 'Ad Spend', value: '$20,300', change: 12, target: '$25,000', pct: 81, color: '#f59e0b' },
  { label: 'Appointments', value: '57', change: 21, target: '60', pct: 95, color: '#ec4899' },
  { label: 'Revenue', value: '$142K', change: 31, target: '$180K', pct: 79, color: '#06b6d4' },
  ];

const campaigns = [
  { name: 'Spring Lead Gen', status: 'Active', leads: 198, spend: '$8,200', roas: '3.4x' },
  { name: 'Retargeting Q1', status: 'Active', leads: 87, spend: '$3,100', roas: '4.1x' },
  { name: 'Brand Awareness', status: 'Paused', leads: 43, spend: '$2,800', roas: '1.8x' },
  { name: 'Email Re-engage', status: 'Active', leads: 140, spend: '$1,200', roas: '8.2x' },
  ];

const sparkline = [220, 245, 260, 280, 310, 340, 360, 380, 400, 420, 445, 468];

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
            {children}
          </div>
        );
}

export default function DashboardPage() {
    const { activeClient } = useClient();
    const { gradientFrom, gradientTo } = activeClient.branding;
  
    return (
          <div className="space-y-8 max-w-[1400px]">
          
            {/* ── Page Header ─────────────────────────────────── */}
                <div className="flex items-center justify-between pt-1">
                        <div>
                                  <div className="flex items-center gap-2 mb-1">
                                              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
                                              <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Overview</h1>h1>
                                              <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                                {activeClient.name}
                                              </span>span>
                                  </div>div>
                                  <p className="text-[12px] text-gray-400 pl-3.5">Marketing intelligence · March 2026</p>p>
                        </div>div>
                        <div className="flex items-center gap-2">
                                  <select className="text-[12px] font-medium border rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none appearance-none cursor-pointer" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                                              <option>Last 30 days</option>option>
                                              <option>Last 90 days</option>option>
                                              <option>This year</option>option>
                                  </select>select>
                                  <button className="text-[12px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, boxShadow: `0 2px 8px ${gradientFrom}45` }}>
                                              Export Report
                                  </button>button>
                        </div>div>
                </div>div>
          
            {/* ── Key Metrics ─────────────────────────────────── */}
                <div>
                        <SectionLabel>Key Metrics</SectionLabel>SectionLabel>
                
                  {/* Top row: Total Leads (wide) | CPL | Conversion Rate */}
                        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
                        
                          {/* Total Leads — featured */}
                                  <div className="rounded-[20px] p-6 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`, boxShadow: `0 8px 32px ${gradientFrom}55` }}>
                                              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
                                              <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
                                              <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ opacity: 0.85 }}>Total Leads</span>span>
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>+18% ↑</span>span>
                                                            </div>div>
                                                            <div className="text-[52px] font-black leading-none mb-1" style={{ letterSpacing: '-2px' }}>468</div>div>
                                                            <div className="text-[12px] mb-4" style={{ opacity: 0.7 }}>Target: 500 leads</div>div>
                                                            <div className="h-1.5 rounded-full mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                                                            <div className="h-full rounded-full bg-white" style={{ width: '93.6%' }} />
                                                            </div>div>
                                                            <div className="flex justify-between text-[10px] mb-3" style={{ opacity: 0.7 }}>
                                                                            <span>Progress to target</span>span><span className="font-bold">93.6%</span>span>
                                                            </div>div>
                                                            <div className="flex items-end gap-0.5 h-7">
                                                              {sparkline.map((v, i) => (
                              <div key={i} className="flex-1 rounded-sm" style={{ height: Math.round((v / 468) * 28), background: `rgba(255,255,255,${0.3 + (v / 468) * 0.5})` }} />
                            ))}
                                                            </div>div>
                                                            <div className="text-[9px] mt-1" style={{ opacity: 0.55 }}>Last 12 weeks trend</div>div>
                                              </div>div>
                                  </div>div>
                        
                          {/* Cost Per Lead */}
                                  <div className="glass-card p-5 relative overflow-hidden">
                                              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
                                              <div className="flex items-start justify-between mb-2">
                                                            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400">Cost Per Lead</span>span>
                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: '#eff6ff' }}>💙</div>div>
                                              </div>div>
                                              <div className="text-[34px] font-black text-gray-900 leading-none mb-1">$42.40</div>div>
                                              <div className="text-[11px] text-gray-400 mb-3">Target: ≤$45.00</div>div>
                                              <div className="flex justify-between text-[10px] mb-1"><span className="text-gray-400">Budget efficiency</span>span><span className="font-bold text-blue-500">94%</span>span></div>div>
                                              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#eff6ff' }}>
                                                            <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
                                              </div>div>
                                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: '#ecfdf5', color: '#059669' }}>✅ -8% below target</div>div>
                                  </div>div>
                        
                          {/* Conversion Rate */}
                                  <div className="glass-card p-5 relative overflow-hidden">
                                              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)' }} />
                                              <div className="flex items-start justify-between mb-2">
                                                            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400">Conversion Rate</span>span>
                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: '#f5f3ff' }}>📈</div>div>
                                              </div>div>
                                              <div className="text-[34px] font-black text-gray-900 leading-none mb-1">13.2%</div>div>
                                              <div className="text-[11px] mb-3"><span className="text-gray-400">Target: 12% — </span>span><span className="font-bold" style={{ color: '#7c3aed' }}>Exceeded ✦</span>span></div>div>
                                              <div className="flex items-center gap-3">
                                                            <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'conic-gradient(#8b5cf6 0% 100%, #f3f0ff 100% 100%)' }}>
                                                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[10px] font-black" style={{ color: '#7c3aed' }}>110%</div>div>
                                                            </div>div>
                                                            <div>
                                                                            <div className="text-[11px] font-bold" style={{ color: '#7c3aed' }}>+10% above target</div>div>
                                                                            <div className="text-[10px] text-gray-400 mt-0.5">+4% vs last month</div>div>
                                                            </div>div>
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Bottom row: Ad Spend | Appointments | Revenue */}
                        <div className="grid grid-cols-3 gap-4">
                          {kpiBottom.map((k) => (
                        <div key={k.label} className="glass-card p-5 relative overflow-hidden">
                                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: k.color }} />
                                      <div className="flex items-start justify-between mb-2">
                                                      <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-gray-400">{k.label}</span>span>
                                      </div>div>
                                      <div className="text-[30px] font-black text-gray-900 leading-none mb-1">{k.value}</div>div>
                                      <div className="text-[11px] text-gray-400 mb-3">Target: {k.target}</div>div>
                                      <div className="flex justify-between text-[10px] mb-1">
                                                      <span className="text-gray-400">{k.label === 'Ad Spend' ? 'Budget used' : k.label === 'Appointments' ? 'Booking rate' : 'Revenue pace'}</span>span>
                                                      <span className="font-bold" style={{ color: k.color }}>{k.pct}%</span>span>
                                      </div>div>
                                      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: k.color + '18' }}>
                                                      <div className="h-full rounded-full" style={{ width: k.pct + '%', background: k.color }} />
                                      </div>div>
                                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: k.color + '15', color: k.color }}>
                                                      📊 +{k.change}% vs last month
                                      </div>div>
                        </div>div>
                      ))}
                        </div>div>
                </div>div>
          
            {/* ── Lead Trends ─────────────────────────────────── */}
                <div>
                        <SectionLabel>Performance Trends</SectionLabel>SectionLabel>
                        <LeadTrendsChart />
                </div>div>
          
            {/* ── Ad Performance ──────────────────────────────── */}
                <div>
                        <SectionLabel>Ad Performance</SectionLabel>SectionLabel>
                        <AdPerformanceChart />
                </div>div>
          
            {/* ── Financial Projections ───────────────────────── */}
                <div>
                        <SectionLabel>Financial Projections</SectionLabel>SectionLabel>
                        <FinancialProjections />
                </div>div>
          
            {/* ── Lead Follow-Up Reminders ────────────────────── */}
                <div>
                        <SectionLabel>Lead Follow-Up Reminders</SectionLabel>SectionLabel>
                        <LeadFollowUp />
                </div>div>
          
            {/* ── CRM + Campaigns ─────────────────────────────── */}
                <div>
                        <SectionLabel>Pipeline &amp; Campaigns</SectionLabel>SectionLabel>
                        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                  <CRMSnapshot />
                                  <Card className="p-6">
                                              <div className="flex items-center justify-between mb-5">
                                                            <div>
                                                                            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Active Campaigns</h3>h3>
                                                                            <p className="text-[11px] text-gray-400 mt-0.5">Current month performance</p>p>
                                                            </div>div>
                                                            <button className="text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-colors hover:opacity-80" style={{ color: gradientFrom, background: gradientFrom + '10' }}>
                                                                            View All →
                                                            </button>button>
                                              </div>div>
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                {campaigns.map((c, i) => (
                            <div key={i} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{c.name}</span>span>
                                                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: c.status === 'Active' ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.06)', color: c.status === 'Active' ? '#16a34a' : '#9ca3af' }}>{c.status}</span>span>
                                              </div>div>
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                                                                  <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                                                                        <div style={{ fontSize: 14, fontWeight: 800, color: gradientFrom }}>{c.leads}</div>div>
                                                                                        <div style={{ fontSize: 9, color: '#9ca3af' }}>Leads</div>div>
                                                                  </div>div>
                                                                  <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                                                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{c.roas}</div>div>
                                                                                        <div style={{ fontSize: 9, color: '#9ca3af' }}>ROAS</div>div>
                                                                  </div>div>
                                                                  <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                                                                        <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{c.spend}</div>div>
                                                                                        <div style={{ fontSize: 9, color: '#9ca3af' }}>Spent</div>div>
                                                                  </div>div>
                                              </div>div>
                            </div>div>
                          ))}
                                              </div>div>
                                  </Card>Card>
                        </div>div>
                </div>div>
          
            {/* ── Content Calendar & AI Trends ────────────────── */}
                <div>
                        <SectionLabel>Content Calendar &amp; AI Trend Ideas</SectionLabel>SectionLabel>
                        <ContentCalendar />
                </div>div>
          
            {/* ── Content Performance ─────────────────────────── */}
                <div>
                        <SectionLabel>Content Performance</SectionLabel>SectionLabel>
                        <ContentSection />
                </div>div>
          
            {/* ── AI Insights ─────────────────────────────────── */}
                <div>
                        <SectionLabel>AI Intelligence</SectionLabel>SectionLabel>
                        <AIInsightsPanel />
                </div>div>
          
          </div>div>
        );
}</div>import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const kpis = [
  { label: 'Total Leads', value: '468', change: 18, icon: <Users size={16} />, target: '500', gradient: true },
  { label: 'Cost Per Lead', value: '$42.40', change: -8, icon: <DollarSign size={16} />, target: '$45.00' },
  { label: 'Conversion Rate', value: '13.2%', change: 4, icon: <TrendingUp size={16} />, target: '12%' },
  { label: 'Ad Spend', value: '$20,300', change: 12, icon: <CreditCard size={16} />, target: '$25,000' },
  { label: 'Appointments', value: '57', change: 21, icon: <Calendar size={16} />, target: '60' },
  { label: 'Revenue', value: '$142K', change: 31, icon: <Award size={16} />, target: '$180K' },
];

const campaigns = [
  { name: 'Spring Lead Gen', status: 'Active', leads: 198, spend: '$8,200', roas: '3.4x' },
  { name: 'Retargeting Q1', status: 'Active', leads: 87, spend: '$3,100', roas: '4.1x' },
  { name: 'Brand Awareness', status: 'Paused', leads: 43, spend: '$2,800', roas: '1.8x' },
  { name: 'Email Re-engage', status: 'Active', leads: 140, spend: '$1,200', roas: '8.2x' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-8 max-w-[1400px]">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1.5 h-6 rounded-full"
              style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }}
            />
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
              Overview
            </h1>
            <span
              className="text-[15px] font-medium ml-1"
              style={{
                background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {activeClient.name}
            </span>
          </div>
          <p className="text-[12px] text-gray-400 pl-3.5">
            Marketing intelligence · March 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-[12px] font-medium border rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none appearance-none cursor-pointer"
            style={{ border: '1px solid rgba(0,0,0,0.08)' }}
          >
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <button
            className="text-[12px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              boxShadow: `0 2px 8px ${gradientFrom}45`,
            }}
          >
            Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────── */}
      <div>
        <SectionLabel>Key Metrics</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>

      {/* ── Lead Trends ─────────────────────────────────── */}
      <div>
        <SectionLabel>Performance Trends</SectionLabel>
        <LeadTrendsChart />
      </div>

      {/* ── Ad Performance ──────────────────────────────── */}
      <div>
        <SectionLabel>Ad Performance</SectionLabel>
        <AdPerformanceChart />
      </div>

      {/* ── CRM + Campaigns ─────────────────────────────── */}
      <div>
        <SectionLabel>Pipeline & Campaigns</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CRMSnapshot />

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Active Campaigns</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Current month performance</p>
              </div>
              <button
                className="text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-colors hover:opacity-80"
                style={{ color: gradientFrom, background: `${gradientFrom}10` }}
              >
                View All →
              </button>
            </div>
            <div className="space-y-2.5">
              {campaigns.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all hover:bg-gray-50/80 cursor-pointer"
                  style={{ border: '1px solid rgba(0,0,0,0.04)' }}
                >
                  {/* Status dot */}
                  <div className="flex-shrink-0">
                    <span
                      className="w-2 h-2 rounded-full block"
                      style={{ background: c.status === 'Active' ? '#10b981' : '#d1d5db' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800">{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={c.status === 'Active'
                          ? { background: 'rgba(16,185,129,0.1)', color: '#059669' }
                          : { background: 'rgba(0,0,0,0.05)', color: '#6b7280' }
                        }
                      >
                        {c.status}
                      </span>
                      <span className="text-[11px] text-gray-400">{c.leads} leads</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className="text-[14px] font-extrabold"
                      style={{ color: gradientFrom }}
                    >
                      {c.roas}
                    </div>
                    <div className="text-[10px] text-gray-400">{c.spend} spent</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div>
        <SectionLabel>Content Performance</SectionLabel>
        <ContentSection />
      </div>

      {/* ── AI Insights ─────────────────────────────────── */}
      <div>
        <SectionLabel>AI Intelligence</SectionLabel>
        <AIInsightsPanel />
      </div>

    </div>
  );
}
