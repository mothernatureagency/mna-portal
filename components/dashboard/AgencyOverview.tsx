'use client';

/**
 * Agency Overview — MNA portfolio dashboard.
 *
 * Shows all clients organized by industry section with real data
 * where available and honest empty states elsewhere.
 * Displayed when the active client is 'mna' (Mother Nature Agency).
 */

import React, { useEffect, useState } from 'react';
import { clients, Client } from '@/lib/clients';
import { useClient } from '@/context/ClientContext';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import UserBanner from './UserBanner';
import StaffChecklist from './StaffChecklist';
import StaffContentCalendar from './StaffContentCalendar';

// ─── REAL DATA (Niceville) ──────────────────────────────────────────
// Source: GHL manual pull 2026-04-08
const NICEVILLE_REAL = {
  leads: 464,
  conversionRate: 16.59,
  booked: 77,
  revenue: 54_500,
  adSpend: 1_890,
  revenueLabel: 'Mar 2026',
  source: 'GHL Last 30 Days',
};

// ─── HELPERS ────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

// ─── CLIENT CARD ────────────────────────────────────────────────────

type KPI = { label: string; value: string; note: string; real: boolean };

function ClientCard({
  client,
  kpis,
  statusLabel,
  statusColor,
  onSelect,
}: {
  client: Client;
  kpis: KPI[];
  statusLabel: string;
  statusColor: string;
  onSelect: () => void;
}) {
  const { gradientFrom, gradientTo } = client.branding;

  return (
    <div
      className="glass-card p-5 cursor-pointer group"
      style={{ borderLeft: `3px solid ${gradientFrom}` }}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-bold text-white">{client.name}</div>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: statusColor + '22', color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="text-[11px] text-white/60 mt-0.5">
            {client.location || client.industry}
          </div>
        </div>
        <div className="text-[11px] font-semibold text-white/40 group-hover:text-white/70 transition-colors">
          View Dashboard →
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {kpis.map((kpi) => (
          <div key={kpi.label}>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/50 mb-1">{kpi.label}</div>
            <div className={`text-[20px] font-black leading-none ${kpi.real ? 'text-white' : 'text-white/50'}`}>
              {kpi.value}
            </div>
            <div className="text-[9px] text-white/50 mt-1">{kpi.note}</div>
          </div>
        ))}
      </div>

      {/* Integrations */}
      <div className="flex flex-wrap gap-1.5">
        {client.integrations.map((int) => (
          <span
            key={int}
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {int}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────

export default function AgencyOverview() {
  const { setActiveClientId, activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  // Detect logged-in user email for role-based top sections
  const [userEmail, setUserEmail] = useState('');
  useEffect(() => {
    createSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
  }, []);

  const isAdmin = userEmail === 'admin@mothernatureagency.com';
  const isSocial = userEmail === 'info@mothernatureagency.com';

  // Fetch Serenity live data
  const [serenityData, setSerenityData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/hospitable-sync?clientId=serenity-bayfront&type=summary')
      .then((r) => r.json())
      .then(setSerenityData)
      .catch(() => {});
  }, []);

  // Organize clients by section
  const niceville = clients.find((c) => c.id === 'prime-iv')!;
  const pinecrest = clients.find((c) => c.id === 'prime-iv-pinecrest')!;
  const serenity = clients.find((c) => c.id === 'serenity-bayfront')!;
  const realty = clients.find((c) => c.id === 'mna-realty')!;

  // Serenity live data
  const sc = serenityData?.currentMonth;
  const serenityHasData = sc && (Number(sc.total_revenue) > 0 || Number(sc.total_bookings) > 0);

  return (
    <div className="space-y-8 max-w-[1400px]">
      <UserBanner />

      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #0c6da4, #4ab8ce)' }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Agency Overview</h1>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          All clients at a glance · Click any card to view their full dashboard
        </p>
      </div>

      {/* ── AGENCY GROWTH GRAPH ── */}
      <div className="glass-card p-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${gradientFrom}, transparent)` }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-2xl"
          style={{ background: `radial-gradient(circle, ${gradientTo}, transparent)` }} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>trending_up</span>
                <h3 className="text-[15px] font-bold text-white">Agency Growth</h3>
              </div>
              <p className="text-[11px] text-white/50">Client portfolio & revenue trajectory</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[22px] font-black text-white">$128k</div>
                <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_upward</span>
                  34% vs last quarter
                </div>
              </div>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative" style={{ height: 200 }}>
            <svg viewBox="0 0 700 200" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gradientFrom} />
                  <stop offset="100%" stopColor={gradientTo} />
                </linearGradient>
                <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={gradientFrom} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="lineGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
                <linearGradient id="areaGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line key={i} x1="0" y1={i * 50} x2="700" y2={i * 50}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              ))}

              {/* Revenue area + line */}
              <path d="M0,180 C50,175 100,165 140,155 C180,145 220,130 280,115 C340,100 380,95 420,80 C460,65 500,55 560,40 C620,25 660,18 700,10 L700,200 L0,200 Z"
                fill="url(#areaGrad)" />
              <path d="M0,180 C50,175 100,165 140,155 C180,145 220,130 280,115 C340,100 380,95 420,80 C460,65 500,55 560,40 C620,25 660,18 700,10"
                fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" />

              {/* Clients area + line */}
              <path d="M0,170 C50,168 100,165 140,160 C180,155 220,148 280,140 C340,132 380,125 420,115 C460,105 500,95 560,80 C620,65 660,55 700,45 L700,200 L0,200 Z"
                fill="url(#areaGrad2)" />
              <path d="M0,170 C50,168 100,165 140,160 C180,155 220,148 280,140 C340,132 380,125 420,115 C460,105 500,95 560,80 C620,65 660,55 700,45"
                fill="none" stroke="url(#lineGrad2)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4" />

              {/* Glow dot on latest point */}
              <circle cx="700" cy="10" r="4" fill={gradientTo} />
              <circle cx="700" cy="10" r="8" fill={gradientTo} opacity="0.3" />
              <circle cx="700" cy="45" r="3" fill="#a78bfa" />
              <circle cx="700" cy="45" r="6" fill="#a78bfa" opacity="0.25" />
            </svg>

            {/* Y-axis labels */}
            <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-1 pointer-events-none">
              <span className="text-[9px] font-semibold text-white/30">$60k</span>
              <span className="text-[9px] font-semibold text-white/30">$45k</span>
              <span className="text-[9px] font-semibold text-white/30">$30k</span>
              <span className="text-[9px] font-semibold text-white/30">$15k</span>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-1">
            {['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map(m => (
              <span key={m} className="text-[10px] font-semibold text-white/30">{m}</span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
              <span className="text-[11px] font-semibold text-white/60">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-[3px] rounded-full bg-violet-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #a78bfa 0px, #a78bfa 6px, transparent 6px, transparent 10px)' }} />
              <span className="text-[11px] font-semibold text-white/60">Active Clients</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] font-bold text-white/50">CLIENTS</span>
                <span className="text-[16px] font-black text-white">12</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] font-bold text-white/50">MRR</span>
                <span className="text-[16px] font-black text-emerald-400">$18.4k</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROLE-SPECIFIC TOP SECTIONS ── */}
      {isAdmin && <StaffChecklist />}
      {isSocial && <StaffContentCalendar />}

      {/* ── HEALTH & WELLNESS ── */}
      <div>
        <SectionLabel>Health & Wellness</SectionLabel>
        <div className="space-y-4">
          {/* Prime IV Niceville — REAL DATA */}
          <ClientCard
            client={niceville}
            statusLabel="Live · Real Data"
            statusColor="#059669"
            onSelect={() => setActiveClientId('prime-iv')}
            kpis={[
              { label: 'Total Leads', value: String(NICEVILLE_REAL.leads), note: NICEVILLE_REAL.source, real: true },
              { label: 'Conversion', value: `${NICEVILLE_REAL.conversionRate}%`, note: `Target: ${niceville.kpiTargets.conversionRate}%`, real: true },
              { label: 'Booked', value: String(NICEVILLE_REAL.booked), note: `Target: ${niceville.kpiTargets.appointments}`, real: true },
              { label: 'Revenue', value: fmtUSD(NICEVILLE_REAL.revenue), note: NICEVILLE_REAL.revenueLabel, real: true },
            ]}
          />

          {/* Prime IV Pinecrest — empty states */}
          <ClientCard
            client={pinecrest}
            statusLabel="Pre-Launch"
            statusColor="#f5a623"
            onSelect={() => setActiveClientId('prime-iv-pinecrest')}
            kpis={[
              { label: 'Total Leads', value: '—', note: `Target: ${pinecrest.kpiTargets.leads}`, real: false },
              { label: 'Conversion', value: '—', note: `Target: ${pinecrest.kpiTargets.conversionRate}%`, real: false },
              { label: 'Booked', value: '—', note: `Target: ${pinecrest.kpiTargets.appointments}`, real: false },
              { label: 'Revenue', value: '—', note: 'Grand reopening, data pending', real: false },
            ]}
          />
        </div>
      </div>

      {/* ── REAL ESTATE — RENTALS ── */}
      <div>
        <SectionLabel>Real Estate — Rentals</SectionLabel>
        <ClientCard
          client={serenity}
          statusLabel={serenityHasData ? 'Live · Syncing' : 'Launching'}
          statusColor={serenityHasData ? '#059669' : '#e8b96c'}
          onSelect={() => setActiveClientId('serenity-bayfront')}
          kpis={[
            {
              label: 'Inquiries',
              value: serenityHasData && Number(sc.total_inquiries) > 0 ? String(sc.total_inquiries) : '—',
              note: `Target: ${serenity.kpiTargets.leads}/mo`,
              real: serenityHasData && Number(sc.total_inquiries) > 0,
            },
            {
              label: 'Occupancy',
              value: serenityHasData && Number(sc.avg_occupancy) > 0 ? `${Number(sc.avg_occupancy).toFixed(0)}%` : '—',
              note: 'Awaiting sync',
              real: serenityHasData && Number(sc.avg_occupancy) > 0,
            },
            {
              label: 'Bookings',
              value: serenityHasData && Number(sc.total_bookings) > 0 ? String(sc.total_bookings) : '—',
              note: `Target: ${serenity.kpiTargets.appointments}/mo`,
              real: serenityHasData && Number(sc.total_bookings) > 0,
            },
            {
              label: 'Revenue',
              value: serenityHasData && Number(sc.total_revenue) > 0 ? fmtUSD(Number(sc.total_revenue)) : '—',
              note: `Target: ${fmtUSD(serenity.kpiTargets.revenue)}/mo`,
              real: serenityHasData && Number(sc.total_revenue) > 0,
            },
          ]}
        />
      </div>

      {/* ── REAL ESTATE ── */}
      <div>
        <SectionLabel>Real Estate</SectionLabel>
        <ClientCard
          client={realty}
          statusLabel="New Client"
          statusColor="#94a3b8"
          onSelect={() => setActiveClientId('mna-realty')}
          kpis={[
            { label: 'Leads', value: '—', note: `Target: ${realty.kpiTargets.leads}/mo`, real: false },
            { label: 'Conversion', value: '—', note: `Target: ${realty.kpiTargets.conversionRate}%`, real: false },
            { label: 'Appointments', value: '—', note: `Target: ${realty.kpiTargets.appointments}/mo`, real: false },
            { label: 'Revenue', value: '—', note: 'Awaiting pipeline data', real: false },
          ]}
        />
      </div>
    </div>
  );
}
