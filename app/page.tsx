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
import UserBanner from '@/components/dashboard/UserBanner';
import Card from '@/components/ui/Card';

// ─────────────────────────────────────────────────────────────────
// Client-specific KPI data
// Prime IV Niceville numbers mirror the live GHL dashboard
// (app.gohighlevel.com/v2/location/X4La59xBeunP9oaXtJnj/dashboard,
//  "Last 30 Days" snapshot) until the GHL API key is provisioned
//  on portal.mothernatureagency.com and we can swap to live pulls.
// ─────────────────────────────────────────────────────────────────
type DashboardData = {
  label: string;
  subtitle: string;
  totalLeads: number;
  totalLeadsTarget: number;
  totalLeadsChange: number | null;
  cpl: string;
  cplNote: string;
  cplPct: number;
  cplChange: number | null;
  convRate: string;
  convRateTarget: string;
  convRateNote: string;
  adSpend: string;
  adSpendTarget: string;
  adSpendPct: number;
  adSpendChange: number | null;
  appointments: string;
  appointmentsTarget: string;
  appointmentsPct: number;
  appointmentsChange: number | null;
  revenue: string;
  revenueTarget: string;
  revenuePct: number;
  revenueChange: number | null;
  sparkline: number[];
  campaigns: { name: string; status: string; leads: number; spend: string; roas: string }[];
};

const defaultData: DashboardData = {
  label: 'March 2026',
  subtitle: 'Marketing intelligence',
  totalLeads: 468,
  totalLeadsTarget: 500,
  totalLeadsChange: 18,
  cpl: '$42.40',
  cplNote: '-8% below target',
  cplPct: 94,
  cplChange: -8,
  convRate: '13.2%',
  convRateTarget: '12%',
  convRateNote: '+10% above target · +4% vs last month',
  adSpend: '$20,300',
  adSpendTarget: '$25,000',
  adSpendPct: 81,
  adSpendChange: 12,
  appointments: '57',
  appointmentsTarget: '60',
  appointmentsPct: 95,
  appointmentsChange: 21,
  revenue: '$142K',
  revenueTarget: '$180K',
  revenuePct: 79,
  revenueChange: 31,
  sparkline: [220, 245, 260, 280, 310, 340, 360, 380, 400, 420, 445, 468],
  campaigns: [
    { name: 'Spring Lead Gen', status: 'Active', leads: 198, spend: '$8,200', roas: '3.4x' },
    { name: 'Retargeting Q1', status: 'Active', leads: 87, spend: '$3,100', roas: '4.1x' },
    { name: 'Brand Awareness', status: 'Paused', leads: 43, spend: '$2,800', roas: '1.8x' },
    { name: 'Email Re-engage', status: 'Active', leads: 140, spend: '$1,200', roas: '8.2x' },
  ],
};

// Pulled manually from the GHL Prime IV Niceville dashboard on 2026-04-08
// (app.gohighlevel.com/v2/location/X4La59xBeunP9oaXtJnj/dashboard, Last 30 Days view).
// Only values that GHL actually exposed are filled in. Everything else shows "—"
// or "No data yet" until the GHL API key is provisioned on portal.mothernatureagency.com.
//
// REAL numbers (confirmed in GHL UI):
//   • Opportunities: 464 total — Open 346, Won 77, Lost 41
//   • Conversion rate: 16.59%
//   • Total pipeline value: $160.62K · Won revenue: $72.99K
//   • Lead sources (page 1): "-" → 114 leads / $84,928 / 55.26% win,
//                            "crm ui -" → 5 leads / $1,263.95
const primeIvNicevilleData: DashboardData = {
  label: 'Last 30 days · GHL (manual sync 2026-04-08)',
  subtitle: 'Prime IV Niceville · Live data limited — full metrics pending GHL API key',
  // Real
  totalLeads: 464,
  totalLeadsTarget: 280,
  totalLeadsChange: null, // GHL UI does not expose prior-period comparison
  // Unknown — no ad platform integration yet
  cpl: '—',
  cplNote: 'No data yet — awaiting ad platform connection',
  cplPct: 0,
  cplChange: null,
  // Real
  convRate: '16.59%',
  convRateTarget: '14%',
  convRateNote: 'Source: GHL Opportunities (Last 30 Days)',
  // Unknown
  adSpend: '—',
  adSpendTarget: '$9,500',
  adSpendPct: 0,
  adSpendChange: null,
  // Real (Won opportunities)
  appointments: '77',
  appointmentsTarget: '68',
  appointmentsPct: 100,
  appointmentsChange: null, // no prior-period comparison available
  // Real (Won revenue)
  revenue: '$72.99K',
  revenueTarget: '$88K',
  revenuePct: 83,
  revenueChange: null, // no prior-period comparison available
  // Empty — GHL UI does not expose a 12-bucket historical trend and we will not fabricate one
  sparkline: [],
  // Only lead sources GHL actually showed. No fabricated campaigns.
  campaigns: [
    { name: 'Lead Source: "-"', status: 'Active', leads: 114, spend: '—', roas: '—' },
    { name: 'Lead Source: "crm ui -"', status: 'Active', leads: 5, spend: '—', roas: '—' },
  ],
};

function getDashboardData(clientId: string): DashboardData {
  if (clientId === 'prime-iv') return primeIvNicevilleData;
  return defaultData;
}

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
  const data = getDashboardData(activeClient.id);
  const leadsPct = Math.min(100, Math.round((data.totalLeads / data.totalLeadsTarget) * 1000) / 10);
  const leadsMax = data.sparkline.length > 0 ? Math.max(...data.sparkline) : 1;
  const campaigns = data.campaigns;
  return (
    <div className="space-y-8 max-w-[1400px]">

      {/* ── User Session Banner ──────────────────────────── */}
      <UserBanner />

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Overview</h1>
            <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {activeClient.name}
            </span>
          </div>
          <p className="text-[12px] text-gray-400 pl-3.5">{data.subtitle} · {data.label}</p>
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
      {/* ── Meta Ads Account (when present on the active client) ── */}
      {activeClient.metaAds && (
        <div>
          <SectionLabel>Meta Ads Account</SectionLabel>
          <div className="glass-card p-5 grid gap-3" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', borderLeft: `3px solid ${gradientFrom}` }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Business Portfolio</div>
              <div className="text-[14px] font-bold text-gray-900">{activeClient.metaAds.businessPortfolioName}</div>
              <div className="text-[11px] text-gray-500 font-mono">{activeClient.metaAds.businessPortfolioId}</div>
              <div className="flex items-center gap-2 mt-2">
                {activeClient.metaAds.verificationStatus && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeClient.metaAds.verificationStatus === 'Verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {activeClient.metaAds.verificationStatus}
                  </span>
                )}
                {activeClient.metaAds.createdDate && (
                  <span className="text-[10px] text-gray-400">Created {activeClient.metaAds.createdDate}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Ad Account</div>
              <div className="text-[13px] font-bold text-gray-900 font-mono">{activeClient.metaAds.adAccountId}</div>
              {activeClient.metaAds.partnerName && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Partner: <span className="font-semibold text-gray-700">{activeClient.metaAds.partnerName}</span>
                  {activeClient.metaAds.partnerAccessLevel && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{activeClient.metaAds.partnerAccessLevel}</span>
                  )}
                </div>
              )}
              {activeClient.metaAds.admin && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Admin: <span className="text-gray-700">{activeClient.metaAds.admin.name}</span>
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Pixel / Dataset</div>
              {activeClient.metaAds.datasetPixel ? (
                <>
                  <div className="text-[13px] font-bold text-gray-900">{activeClient.metaAds.datasetPixel.name}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{activeClient.metaAds.datasetPixel.id}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {activeClient.metaAds.datasetPixel.status && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        ✓ {activeClient.metaAds.datasetPixel.status}
                      </span>
                    )}
                  </div>
                  {activeClient.metaAds.datasetPixel.sources && (
                    <div className="text-[10px] text-gray-400 mt-1">{activeClient.metaAds.datasetPixel.sources.join(' · ')}</div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-gray-400 italic">Not connected</div>
              )}
            </div>
            {activeClient.metaAds.notes && (
              <div className="col-span-3 mt-2 pt-3 border-t border-gray-200/60 text-[11px] text-gray-500 leading-relaxed">
                {activeClient.metaAds.notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Key Metrics</SectionLabel>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
          <div className="rounded-[20px] p-6 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase opacity-85">Total Leads</span>
                {data.totalLeadsChange !== null && data.totalLeadsChange > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>+{data.totalLeadsChange}% ↑</span>
                )}
                {data.totalLeadsChange === null && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>No trend data</span>
                )}
                {data.totalLeads > data.totalLeadsTarget && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>Exceeded ✦</span>
                )}
              </div>
              <div className="text-[52px] font-black leading-none mb-1">{data.totalLeads}</div>
              <div className="text-[12px] mb-4 opacity-70">Target: {data.totalLeadsTarget} leads</div>
              <div className="h-1.5 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full bg-white" style={{ width: `${leadsPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] mb-3 opacity-70">
                <span>Progress to target</span>
                <span className="font-bold">{leadsPct}%</span>
              </div>
              <div className="flex items-end gap-0.5 h-7">
                {data.sparkline.length > 0 ? (
                  data.sparkline.map((v, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: Math.round((v / leadsMax) * 28), background: `rgba(255,255,255,${0.3 + (v / leadsMax) * 0.5})` }} />
                  ))
                ) : (
                  <div className="text-[10px] opacity-60 italic">Historical trend unavailable — awaiting API</div>
                )}
              </div>
            </div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
            <span className="text-[10px] font-bold uppercase text-gray-400">Cost Per Lead</span>
            <div className="text-[34px] font-black text-gray-900 leading-none my-2">{data.cpl}</div>
            <div className="text-[11px] text-gray-400 mb-3">Target: ≤$45.00</div>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#eff6ff' }}>
              <div className="h-full rounded-full" style={{ width: `${data.cplPct}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }} />
            </div>
            <div className="text-[11px] font-bold" style={{ color: '#059669' }}>{data.cplNote}</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)' }} />
            <span className="text-[10px] font-bold uppercase text-gray-400">Conversion Rate</span>
            <div className="text-[34px] font-black text-gray-900 leading-none my-2">{data.convRate}</div>
            <div className="text-[11px] mb-3">
              <span className="text-gray-400">Target: {data.convRateTarget} </span>
              {parseFloat(data.convRate) > parseFloat(data.convRateTarget) && (
                <span className="font-bold" style={{ color: '#7c3aed' }}>Exceeded ✦</span>
              )}
            </div>
            <div className="text-[11px] font-bold" style={{ color: '#7c3aed' }}>{data.convRateNote}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Ad Spend', value: data.adSpend, target: data.adSpendTarget, pct: data.adSpendPct, change: data.adSpendChange, color: '#f59e0b' },
            { label: 'Appointments', value: data.appointments, target: data.appointmentsTarget, pct: data.appointmentsPct, change: data.appointmentsChange, color: '#ec4899' },
            { label: 'Revenue', value: data.revenue, target: data.revenueTarget, pct: data.revenuePct, change: data.revenueChange, color: '#06b6d4' },
          ].map((k) => (
            <div key={k.label} className="glass-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: k.color }} />
              <span className="text-[10px] font-bold uppercase text-gray-400">{k.label}</span>
              <div className="text-[30px] font-black text-gray-900 leading-none my-2">{k.value}</div>
              <div className="text-[11px] text-gray-400 mb-3">Target: {k.target}</div>
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: k.color + '18' }}>
                <div className="h-full rounded-full" style={{ width: k.pct + '%', background: k.color }} />
              </div>
              <div className="text-[11px] font-bold" style={{ color: k.color }}>
                {k.change === null ? 'No data yet' : k.change > 0 ? `+${k.change}% vs last month` : '— vs last month'}
              </div>
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
