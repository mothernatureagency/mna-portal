'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import NicevilleDashboard from '@/components/dashboard/NicevilleDashboard';
import SerenityDashboard from '@/components/dashboard/SerenityDashboard';
import AgencyOverview from '@/components/dashboard/AgencyOverview';
import MNADashboard from '@/components/dashboard/MNADashboard';
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
import DailyBriefing from '@/components/dashboard/DailyBriefing';
import PersonalDashboard from '@/components/dashboard/PersonalDashboard';
import DashboardStats from '@/components/dashboard/DashboardStats';

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
  const { activeClient, userRole } = useClient();

  // Personal home dashboard for MNA staff and owner accounts
  if (activeClient.id === 'mna' || userRole === 'owner') {
    return <PersonalDashboard />;
  }

  // All Prime IV locations share one full, editable dashboard layout
  // (KPIs, content, memberships, competitor, TikTok, YouTube, sales, key
  // metrics, revenue, ad spend, lead sources, AI intelligence).
  if (activeClient.id.startsWith('prime-iv')) {
    return (
      <>
        <DailyBriefing />
        <NicevilleDashboard client={activeClient} />
      </>
    );
  }

  if (activeClient.id === 'serenity-bayfront') {
    return (
      <>
        <DailyBriefing />
        <SerenityDashboard client={activeClient} />
      </>
    );
  }

  const { gradientFrom, gradientTo } = activeClient.branding;
  const data = getDashboardData(activeClient.id);
  const leadsPct = Math.min(100, Math.round((data.totalLeads / data.totalLeadsTarget) * 1000) / 10);
  const leadsMax = data.sparkline.length > 0 ? Math.max(...data.sparkline) : 1;
  const campaigns = data.campaigns;
  return (
    <div className="space-y-8 max-w-[1400px]">

      {/* Daily Briefing alert */}
      <DailyBriefing />

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

      <DashboardStats client={activeClient} defaults={{
        leads:   { value: String(data.totalLeads), target: String(data.totalLeadsTarget), note: data.totalLeadsChange != null ? `+${data.totalLeadsChange}% vs last month` : '' },
        cpl:     { value: data.cpl, target: '', note: data.cplNote || '' },
        conv:    { value: data.convRate, target: data.convRateTarget, note: data.convRateNote || '' },
        adSpend: { value: data.adSpend, target: data.adSpendTarget, note: data.adSpendChange != null ? `+${data.adSpendChange}% vs last month` : '' },
        appts:   { value: data.appointments, target: data.appointmentsTarget, note: data.appointmentsChange != null ? `+${data.appointmentsChange}% vs last month` : '' },
        revenue: { value: data.revenue, target: data.revenueTarget, note: data.revenueChange != null ? `+${data.revenueChange}% vs last month` : '' },
      }} />
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
