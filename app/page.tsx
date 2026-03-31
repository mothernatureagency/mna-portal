'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import LeadTrendsChart from '@/components/dashboard/LeadTrendsChart';
import AdPerformanceChart from '@/components/dashboard/AdPerformanceChart';
import CRMSnapshot from '@/components/dashboard/CRMSnapshot';
import ContentSection from '@/components/dashboard/ContentSection';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import FinancialProjections from '@/components/dashboard/FinancialProjections';
import LeadFollowUp from '@/components/dashboard/LeadFollowUp';
import ContentCalendar from '@/components/dashboard/ContentCalendar';
import Card from '@/components/ui/Card';

const kpiTop = [
  { label: 'Total Leads', value: '468', change: 18, target: 500, current: 468, color: '#0ea5e9', featured: true },
  { label: 'Cost Per Lead', value: '$42.40', change: -8, target: '$45.00', pct: 94, color: '#3b82f6', note: '-8% below target' },
  { label: 'Conversion Rate', value: '13.2%', change: 4, target: '12%', pct: 110, color: '#8b5cf6', note: '+10% above target' },
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
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Overview</h1>
            <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {activeClient.name}
            </span>
          </div>
          <p className="text-[12px] text-gray-400 pl-3.5">Marketing intelligence · March 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-[12px] font-medium border rounded-xl px-3 py-2 bg-white text-gray-600" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </select>
          <button className="text-[12px] font-semibold px-4 py-2 rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            Export Report
          </button>
        </div>
      </div>
      <div>
        <SectionLabel>Key Metrics</SectionLabel>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
          <div className="rounded-[20px] p-6 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase opacity-85">Total Leads</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>+18% ↑</span>
              </div>
              <div className="text-[52px] font-black leading-none mb-1">468</div>
              <div className="text-[12px] mb-4 opacity-70">Target: 500 leads</div>
              <div className="h-1.5 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full bg-white" style={{ width: '93.6%' }} />
              </div>
              <div className="flex justify-between text-[10px] mb-3 opacity-70">
                <span>Progress to target</span>
                <span className="font-bold">93.6%</span>
              </div>
              <div className="flex items-end gap-0.5 h-7">
                {sparkline.map((v, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: Math.round((v / 468) * 28), background: `rgba(255,255,255,${0.3 + (v / 468) * 0.5})` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
            <span className="text-[10px] font-bold uppercase text-gray-400">Cost Per Lead</span>
            <div className="text-[34px] font-black text-gray-900 leading-none my-2">$42.40</div>
            <div className="text-[11px] text-gray-400 mb-3">Target: ≤$45.00</div>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#eff6ff' }}>
              <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
            </div>
            <div className="text-[11px] font-bold" style={{ color: '#059669' }}>✅ -8% below target</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)' }} />
            <span className="text-[10px] font-bold uppercase text-gray-400">Conversion Rate</span>
            <div className="text-[34px] font-black text-gray-900 leading-none my-2">13.2%</div>
            <div className="text-[11px] mb-3">
              <span className="text-gray-400">Target: 12% </span>
              <span className="font-bold" style={{ color: '#7c3aed' }}>Exceeded ✦</span>
            </div>
            <div className="text-[11px] font-bold" style={{ color: '#7c3aed' }}>+10% above target · +4% vs last month</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {kpiBottom.map((k) => (
            <div key={k.label} className="glass-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: k.color }} />
              <span className="text-[10px] font-bold uppercase text-gray-400">{k.label}</span>
              <div className="text-[30px] font-black text-gray-900 leading-none my-2">{k.value}</div>
              <div className="text-[11px] text-gray-400 mb-3">Target: {k.target}</div>
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: k.color + '18' }}>
                <div className="h-full rounded-full" style={{ width: k.pct + '%', background: k.color }} />
              </div>
              <div className="text-[11px] font-bold" style={{ color: k.color }}>+{k.change}% vs last month</div>
            </div>
          ))}
        </div>
      </div>
      <div><SectionLabel>Performance Trends</SectionLabel><LeadTrendsChart /></div>
      <div><SectionLabel>Ad Performance</SectionLabel><AdPerformanceChart /></div>
      <div><SectionLabel>Financial Projections</SectionLabel><FinancialProjections /></div>
      <div><SectionLabel>Lead Follow-Up Reminders</SectionLabel><LeadFollowUp /></div>
      <div>
        <SectionLabel>Pipeline &amp; Campaigns</SectionLabel>
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <CRMSnapshot />
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-bold text-gray-900">Active Campaigns</h3>
              <button style={{ color: gradientFrom, background: gradientFrom + '10' }} className="text-[12px] font-semibold px-3 py-1.5 rounded-xl">View All →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {campaigns.map((c, i) => (
                <div key={i} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: c.status === 'Active' ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.06)', color: c.status === 'Active' ? '#16a34a' : '#9ca3af' }}>{c.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: gradientFrom }}>{c.leads}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>Leads</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{c.roas}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>ROAS</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{c.spend}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>Spent</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <div><SectionLabel>Content Calendar &amp; AI Trend Ideas</SectionLabel><ContentCalendar /></div>
      <div><SectionLabel>Content Performance</SectionLabel><ContentSection /></div>
      <div><SectionLabel>AI Intelligence</SectionLabel><AIInsightsPanel /></div>
    </div>
  );
}
