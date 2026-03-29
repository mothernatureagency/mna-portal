'use client';
import React from 'react';
import { Users, DollarSign, TrendingUp, CreditCard, Calendar, Award } from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import LeadTrendsChart from '@/components/dashboard/LeadTrendsChart';
import AdPerformanceChart from '@/components/dashboard/AdPerformanceChart';
import CRMSnapshot from '@/components/dashboard/CRMSnapshot';
import ContentSection from '@/components/dashboard/ContentSection';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import { useClient } from '@/context/ClientContext';
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
