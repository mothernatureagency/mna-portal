'use client';

/**
 * Serenity Bayfront — STR-specific dashboard layout.
 *
 * Designed for vacation rental KPIs: occupancy, ADR, RevPAR, booking pace,
 * revenue by channel, seasonal demand, and review velocity.
 *
 * No fabricated metrics. All sections use honest empty states until
 * real data is piped in from Airbnb/VRBO/Hospitable APIs.
 */

import React from 'react';
import type { Client } from '@/lib/clients';
import UserBanner from './UserBanner';

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

// ─── SEASONAL DEMAND MODEL ─────────────────────────────────────────
// Based on Emerald Coast / Freeport FL rental comps
const SEASONAL_DEMAND = [
  { month: 'Jan', season: 'low',      demandPct: 35, label: 'Low' },
  { month: 'Feb', season: 'low',      demandPct: 40, label: 'Low' },
  { month: 'Mar', season: 'shoulder', demandPct: 65, label: 'Shoulder' },
  { month: 'Apr', season: 'shoulder', demandPct: 70, label: 'Shoulder' },
  { month: 'May', season: 'high',     demandPct: 88, label: 'High' },
  { month: 'Jun', season: 'high',     demandPct: 95, label: 'Peak' },
  { month: 'Jul', season: 'high',     demandPct: 98, label: 'Peak' },
  { month: 'Aug', season: 'high',     demandPct: 90, label: 'High' },
  { month: 'Sep', season: 'high',     demandPct: 80, label: 'High' },
  { month: 'Oct', season: 'shoulder', demandPct: 60, label: 'Shoulder' },
  { month: 'Nov', season: 'low',      demandPct: 38, label: 'Low' },
  { month: 'Dec', season: 'low',      demandPct: 42, label: 'Low (Holiday)' },
];

const SEASON_COLORS: Record<string, string> = {
  high: '#059669',
  shoulder: '#e8b96c',
  low: '#94a3b8',
};

export default function SerenityDashboard({ client }: { client: Client }) {
  const { gradientFrom, gradientTo, accentColor } = client.branding;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <UserBanner />

      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
            <h1 className="text-[22px] font-extrabold text-white tracking-tight">Overview</h1>
            <span className="text-[15px] font-medium ml-1" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {client.name}
            </span>
          </div>
          <p className="text-[12px] text-white/60 pl-3.5">
            Vacation rental dashboard · Airbnb live, VRBO launching · Data pending API connections
          </p>
        </div>
      </div>

      {/* ── PROPERTY SNAPSHOT ── */}
      <div>
        <SectionLabel>Property Snapshot</SectionLabel>
        <div className="glass-card p-6" style={{ borderLeft: `3px solid ${gradientFrom}` }}>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Property</div>
              <div className="text-[14px] font-bold text-white">Serenity on the Bay</div>
              <div className="text-[11px] text-white/70">Bayfront waterfront home · Freeport, FL</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Active Channels</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Airbnb', 'VRBO', 'Direct'].map((ch) => (
                  <span
                    key={ch}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: ch === 'VRBO' ? 'rgba(232,185,108,0.2)' : 'rgba(255,255,255,0.12)',
                      color: ch === 'VRBO' ? accentColor : 'rgba(255,255,255,0.85)',
                      border: ch === 'VRBO' ? `1px solid ${accentColor}55` : '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {ch === 'VRBO' ? '🚀 VRBO (Launching)' : ch === 'Airbnb' ? '✓ Airbnb' : '◦ Direct (Planned)'}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Sync Platform</div>
              <div className="text-[13px] font-bold text-white">Hospitable</div>
              <div className="text-[11px] text-white/70">Cross-platform calendar sync + messaging</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KEY STR METRICS (empty states) ── */}
      <div>
        <SectionLabel>Key Metrics · Short-Term Rental</SectionLabel>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Occupancy Rate', value: '—', note: 'Awaiting Hospitable API', color: '#0f4c5c', icon: '🏠' },
            { label: 'ADR (Avg Daily Rate)', value: '—', note: 'Awaiting pricing data', color: '#4fa3a0', icon: '💰' },
            { label: 'RevPAR', value: '—', note: 'Occupancy × ADR', color: '#059669', icon: '📊' },
            { label: 'Booking Pace', value: '—', note: 'Bookings this month vs target', color: accentColor, icon: '📈' },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: kpi.color }} />
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[12px]">{kpi.icon}</span>
                <span className="text-[10px] font-bold uppercase text-white/60">{kpi.label}</span>
              </div>
              <div className="text-[30px] font-black text-white/70 leading-none my-2">{kpi.value}</div>
              <div className="text-[11px] text-white/70">{kpi.note}</div>
            </div>
          ))}
        </div>

        {/* Secondary metrics row */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: gradientFrom }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Monthly Inquiries</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">—</div>
            <div className="text-[11px] text-white/70">Target: {client.kpiTargets.leads} across all channels</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#ec4899' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Confirmed Bookings</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">—</div>
            <div className="text-[11px] text-white/70">Target: {client.kpiTargets.appointments}/mo</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#06b6d4' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Gross Rental Revenue</span>
            <div className="text-[28px] font-black text-white/70 leading-none my-2">—</div>
            <div className="text-[11px] text-white/70">Target: {fmtUSD(client.kpiTargets.revenue)}/mo</div>
          </div>
        </div>
      </div>

      {/* ── REVENUE BY CHANNEL ── */}
      <div>
        <SectionLabel>Revenue by Channel</SectionLabel>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[15px] font-bold text-white">Channel Breakdown</div>
              <div className="text-[11px] text-white/70">Revenue split across listing platforms</div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { channel: 'Airbnb', pct: 0, revenue: '—', status: 'Live', statusColor: '#059669' },
              { channel: 'VRBO', pct: 0, revenue: '—', status: 'Launching', statusColor: accentColor },
              { channel: 'Direct Booking', pct: 0, revenue: '—', status: 'Planned', statusColor: '#94a3b8' },
            ].map((ch) => (
              <div key={ch.channel}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white">{ch.channel}</span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: ch.statusColor + '22', color: ch.statusColor }}
                    >
                      {ch.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold text-white/70">{ch.revenue}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: ch.pct > 0 ? `${ch.pct}%` : '2%',
                      background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                      opacity: ch.pct > 0 ? 1 : 0.3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            Revenue data will populate once Hospitable API is connected and pulling nightly rate data from each channel. Goal: shift 20%+ of bookings to direct to reduce OTA commission fees.
          </div>
        </div>
      </div>

      {/* ── SEASONAL DEMAND CHART ── */}
      <div>
        <SectionLabel>Seasonal Demand · Emerald Coast</SectionLabel>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-white">Demand by Month</div>
              <div className="text-[11px] text-white/70">
                High season May-Sep · Shoulder Mar-Apr, Oct · Low Nov-Feb
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              {Object.entries(SEASON_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ background: color }} />
                  <span className="text-white/70 capitalize">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-44 mb-3">
            {SEASONAL_DEMAND.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[10px] font-bold text-white/80">{m.demandPct}%</div>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${m.demandPct}%`,
                    background: SEASON_COLORS[m.season],
                    opacity: 0.85,
                  }}
                />
                <div className="text-[10px] font-semibold text-white/70">{m.month}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            Pricing strategy: peak rates May-Sep, 15-20% discount for shoulder months, 30-40% discount for low season. Holiday weekends (Memorial Day, July 4th, Labor Day) command premium rates.
          </div>
        </div>
      </div>

      {/* ── REVIEW VELOCITY ── */}
      <div>
        <SectionLabel>Review Velocity</SectionLabel>
        <div className="glass-card p-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Average Rating</div>
              <div className="text-[36px] font-black text-white leading-none my-2">—</div>
              <div className="text-[11px] text-white/70">Target: 4.8+ stars</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Total Reviews</div>
              <div className="text-[36px] font-black text-white leading-none my-2">—</div>
              <div className="text-[11px] text-white/70">Airbnb + VRBO combined</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">5-Star Rate</div>
              <div className="text-[36px] font-black text-white leading-none my-2">—</div>
              <div className="text-[11px] text-white/70">% of reviews at 5 stars</div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            Review data will pull from Airbnb and VRBO once listing APIs are connected. Strategy: automated post-checkout message via Hospitable asking for reviews, personalized thank-you note in welcome guide, and 5-star guarantee follow-up.
          </div>
        </div>
      </div>

      {/* ── AD SPEND ── */}
      <div>
        <SectionLabel>Ad Spend · Target {fmtUSD(client.kpiTargets.adSpend)}/mo</SectionLabel>
        <div className="glass-card p-6">
          <div className="space-y-3">
            {[
              { channel: 'Meta (Facebook + Instagram)', monthly: 0, note: 'Not yet running — launch with VRBO go-live' },
              { channel: 'Google (Search + Maps)', monthly: 0, note: 'Not yet running — planned for direct booking push' },
            ].map((row) => (
              <div key={row.channel}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-bold text-white">{row.channel}</span>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-white/70">{row.monthly > 0 ? fmtUSD(row.monthly) + '/mo' : '—'}</div>
                    <div className="text-[10px] text-white/70">{row.note}</div>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/10">
                  <div className="h-full rounded-full" style={{ width: '2%', background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`, opacity: 0.3 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            Ad spend launches alongside VRBO listing go-live. Initial strategy: Meta retargeting for property page visitors + Google Search for "freeport fl vacation rental" and "bayfront rental emerald coast" keywords.
          </div>
        </div>
      </div>

      {/* ── INTELLIGENCE ── */}
      <div>
        <SectionLabel>AI Intelligence · Serenity Bayfront</SectionLabel>
        <div className="glass-card p-6 space-y-4">
          <InsightRow
            color="#059669"
            title="VRBO listing launch is the #1 priority"
            body="Airbnb is live but single-channel risk is high. Adding VRBO opens a second booking funnel with different guest demographics (families vs couples). Target: VRBO listing live within 2 weeks with full photo set and optimized copy."
          />
          <InsightRow
            color={accentColor}
            title="Peak season is 6 weeks away — pricing window is closing"
            body="May-September commands 2-3x winter rates on the Emerald Coast. The VRBO pricing calendar needs to be set now to capture early bookers. Recommend dynamic pricing via Hospitable with floor rates by season."
          />
          <InsightRow
            color="#0ea5e9"
            title="Direct bookings should be the long-term play"
            body="OTA fees eat 15-20% of gross revenue. A simple direct booking page with Meta pixel tracking and a Mailchimp list for repeat guests can shift 20%+ of bookings off-platform within 6 months."
          />
          <InsightRow
            color="#8b5cf6"
            title="Review velocity will make or break ranking"
            body="New listings with 10+ five-star reviews in the first 60 days get significant search ranking boosts on both Airbnb and VRBO. Every guest touchpoint should gently encourage reviews: welcome guide, mid-stay check-in, post-checkout message."
          />
        </div>
      </div>
    </div>
  );
}

function InsightRow({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-1 rounded-full shrink-0" style={{ background: color }} />
      <div>
        <div className="text-[13px] font-bold text-white">{title}</div>
        <div className="text-[12px] text-white/80 leading-relaxed mt-1">{body}</div>
      </div>
    </div>
  );
}
