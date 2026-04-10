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
  const { setActiveClientId } = useClient();

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
