'use client';

/**
 * Serenity Bayfront — STR-specific dashboard layout.
 *
 * Designed for vacation rental KPIs: occupancy, ADR, RevPAR, booking pace,
 * revenue by channel, seasonal demand, and review velocity.
 *
 * Data flows: Hospitable → Make.com → /api/hospitable-sync → Postgres → this dashboard
 * Falls back to honest empty states when no data has synced yet.
 */

import React, { useEffect, useState } from 'react';
import type { Client } from '@/lib/clients';
import UserBanner from './UserBanner';
import MonthlyContentCalendar from './MonthlyContentCalendar';

// ─── TYPES ──────────────────────────────────────────────────────────

type STRSummary = {
  currentMonth: {
    avg_occupancy: number;
    avg_adr: number;
    avg_revpar: number;
    total_revenue: number;
    total_bookings: number;
    total_inquiries: number;
  } | null;
  channelRevenue: { platform: string; booking_count: number; total_revenue: number; avg_nightly_rate: number }[];
  upcoming: { platform: string; check_in: string; check_out: string; nights: number; total_payout: number; guest_name: string }[];
  reviewStats: { total_reviews: number; avg_rating: number; five_star_count: number } | null;
  monthlyTrend: { month: string; revenue: number; avg_occupancy: number }[];
};

type LaunchTask = {
  id: string;
  title: string;
  status: string;
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

// ─── SEASONAL DEMAND MODEL ─────────────────────────────────────────
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

// ─── COMPONENT ──────────────────────────────────────────────────────

export default function SerenityDashboard({ client }: { client: Client }) {
  const { gradientFrom, gradientTo, accentColor } = client.branding;

  // Fetch STR summary from Hospitable sync
  const [summary, setSummary] = useState<STRSummary | null>(null);
  const [tasks, setTasks] = useState<LaunchTask[]>([]);

  useEffect(() => {
    fetch(`/api/hospitable-sync?clientId=${client.id}&type=summary`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
    fetch(`/api/client-requests?clientId=${client.id}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.items || []))
      .catch(() => {});
  }, [client.id]);

  const cm = summary?.currentMonth;
  const hasData = cm && (cm.total_revenue > 0 || cm.total_bookings > 0);
  const rs = summary?.reviewStats;
  const hasReviews = rs && rs.total_reviews > 0;

  // Channel revenue
  const channelData = summary?.channelRevenue || [];
  const totalChannelRevenue = channelData.reduce((s, c) => s + Number(c.total_revenue), 0);

  // Launch progress
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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
            Vacation rental dashboard · Hospitable → Make → Dashboard sync
            {hasData ? '' : ' · Awaiting first data sync'}
          </p>
        </div>
      </div>

      {/* ── VRBO LAUNCH PROGRESS ── */}
      {totalTasks > 0 && (
        <div>
          <SectionLabel>VRBO Launch Progress</SectionLabel>
          <div className="glass-card p-6" style={{ borderLeft: `3px solid ${accentColor}` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[15px] font-bold text-white">Launch Checklist</div>
                <div className="text-[11px] text-white/70">{doneTasks} of {totalTasks} tasks complete</div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-black text-white">{progressPct}%</div>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-white/10 mb-4">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(progressPct, 2)}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${gradientTo})`,
                }}
              />
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0"
                    style={{
                      background: task.status === 'done' ? '#059669' : 'rgba(255,255,255,0.1)',
                      border: task.status === 'done' ? 'none' : '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                    }}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </div>
                  <span className={`text-[12px] ${task.status === 'done' ? 'text-white/50 line-through' : 'text-white/90'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PROPERTY SNAPSHOT ── */}
      <div>
        <SectionLabel>Property Snapshot</SectionLabel>
        <div className="glass-card p-6" style={{ borderLeft: `3px solid ${gradientFrom}` }}>
          <div className="grid grid-cols-3 gap-6 mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Property</div>
              <div className="text-[14px] font-bold text-white">Serenity on the Bay</div>
              <div className="text-[11px] text-white/70">1.5 acre bayfront retreat · Freeport, FL</div>
              <div className="text-[11px] text-white/50 mt-1">4 BR · 2.5 BA · 6 beds · 10 guests</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Active Channels</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Airbnb', 'VRBO', 'Direct'].map((ch) => (
                  <span
                    key={ch}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: ch === 'VRBO' ? 'rgba(232,185,108,0.2)' : ch === 'Airbnb' ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.08)',
                      color: ch === 'VRBO' ? accentColor : ch === 'Airbnb' ? '#059669' : 'rgba(255,255,255,0.6)',
                      border: ch === 'VRBO' ? `1px solid ${accentColor}55` : ch === 'Airbnb' ? '1px solid rgba(5,150,105,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {ch === 'VRBO' ? '✓ VRBO (Live)' : ch === 'Airbnb' ? '✓ Airbnb' : '◦ Direct (Planned)'}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Data Pipeline</div>
              <div className="text-[13px] font-bold text-white">Airbnb Email → Make → Dashboard</div>
              <div className="text-[11px] text-white/70">Auto-sync via booking email parsing</div>
            </div>
          </div>
          {/* Property highlights */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {['Private Dock', 'Bayfront', 'Fire Pit', 'Cathedral Ceilings', 'Spa Bathroom', 'Smart Appliances', 'Cargo Elevator', 'Pet Friendly', 'Self Check-in', 'Free Parking'].map((feat) => (
                <span key={feat} className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT CALENDAR ── */}
      <div>
        <SectionLabel>Content Calendar</SectionLabel>
        <MonthlyContentCalendar
          clientName={client.name}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
      </div>

      {/* ── SHOT LIST / ASSET NEEDS ── */}
      <div>
        <SectionLabel>Shot List · Media Needed for Content Calendar</SectionLabel>
        <div className="glass-card p-6" style={{ borderLeft: `3px solid ${accentColor}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-white">Asset Needs</div>
              <div className="text-[11px] text-white/50">Photos and video required for the VRBO Launch playbook</div>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { priority: 'high', type: '📸 Photo', title: 'Hero exterior from the water', desc: 'Bayfront + dock visible, golden hour. Drone aerial if possible. Used for VRBO hero, Airbnb cover, and social launch posts.', days: '1, 6' },
              { priority: 'high', type: '🎬 Video', title: 'Full property walkthrough reel', desc: 'Walk-in tour from front door through living room, kitchen, bedrooms, spa bathroom, out to dock. 30-60 seconds. Smooth gimbal.', days: '1, 2' },
              { priority: 'high', type: '📸 Photo', title: 'Room-by-room carousel set', desc: 'Individual shots: living room (bay view), primary suite, kitchen, each bedroom, bunk room, outdoor deck, dock. Min 10 photos.', days: '3, 18' },
              { priority: 'high', type: '🎬 Video', title: 'Sunset timelapse from dock', desc: 'Tripod on dock, 30-min timelapse compressed to 15 seconds. Golden hour through sunset. No audio needed.', days: '5' },
              { priority: 'medium', type: '📸 Photo', title: 'Coffee on the dock lifestyle shot', desc: 'Styled: coffee mug, book, dock railing, bay in background. Morning light. Used for "morning routine" reel.', days: '15' },
              { priority: 'medium', type: '🎬 Video', title: 'POV arrival + first impressions', desc: 'Phone POV: pull into driveway, walk to door, open door, first view of bay. Casual feel, not overly produced.', days: '2, 22' },
              { priority: 'medium', type: '📸 Photo', title: 'Fire pit evening setup', desc: 'Fire pit lit, chairs arranged, string lights if available. Dusk/blue hour. S\'mores props optional.', days: '6' },
              { priority: 'medium', type: '📸 Photo', title: 'Spa bathroom detail shots', desc: 'LED mirror lit, fluted tub filled, walk-in shower close-up. Clean and styled. Candle prop.', days: '3, 18' },
              { priority: 'low', type: '📸 Photo', title: 'Local area photos', desc: 'Crab Island, Destin Harbor, Henderson Beach. For "things to do near Serenity" carousel.', days: '16' },
              { priority: 'low', type: '🎬 Video', title: 'Dolphin sighting clip', desc: 'Any dolphin footage from the dock or nearby. Even phone quality works. For social proof content.', days: '26' },
            ].map((shot, i) => (
              <div key={i} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="shrink-0 mt-0.5">
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{
                      background: shot.priority === 'high' ? 'rgba(239,68,68,0.15)' : shot.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                      color: shot.priority === 'high' ? '#ef4444' : shot.priority === 'medium' ? '#f59e0b' : '#94a3b8',
                    }}
                  >
                    {shot.priority}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50">{shot.type}</span>
                    <span className="text-[12px] font-bold text-white/90">{shot.title}</span>
                  </div>
                  <div className="text-[10px] text-white/55 mt-0.5 leading-relaxed">{shot.desc}</div>
                  <div className="text-[9px] text-white/40 mt-1">Used in playbook days: {shot.days}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KEY STR METRICS ── */}
      <div>
        <SectionLabel>Key Metrics · Short-Term Rental</SectionLabel>
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Occupancy Rate',
              value: hasData ? `${Number(cm!.avg_occupancy).toFixed(1)}%` : '—',
              note: hasData ? 'Current month average' : 'Awaiting first sync from Hospitable',
              color: '#0f4c5c', icon: '🏠',
            },
            {
              label: 'ADR (Avg Daily Rate)',
              value: hasData ? fmtUSD(Number(cm!.avg_adr)) : '—',
              note: hasData ? 'Current month average' : 'Awaiting pricing data',
              color: '#4fa3a0', icon: '💰',
            },
            {
              label: 'RevPAR',
              value: hasData ? fmtUSD(Number(cm!.avg_revpar)) : '—',
              note: hasData ? 'Occupancy x ADR' : 'Occupancy x ADR',
              color: '#059669', icon: '📊',
            },
            {
              label: 'Booking Pace',
              value: hasData ? `${cm!.total_bookings}` : '—',
              note: hasData ? `vs ${client.kpiTargets.appointments}/mo target` : 'Bookings this month vs target',
              color: accentColor, icon: '📈',
            },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: kpi.color }} />
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[12px]">{kpi.icon}</span>
                <span className="text-[10px] font-bold uppercase text-white/60">{kpi.label}</span>
              </div>
              <div className={`text-[30px] font-black leading-none my-2 ${kpi.value === '—' ? 'text-white/70' : 'text-white'}`}>{kpi.value}</div>
              <div className="text-[11px] text-white/70">{kpi.note}</div>
            </div>
          ))}
        </div>

        {/* Secondary metrics row */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: gradientFrom }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Monthly Inquiries</span>
            <div className={`text-[28px] font-black leading-none my-2 ${hasData && cm!.total_inquiries > 0 ? 'text-white' : 'text-white/70'}`}>
              {hasData && cm!.total_inquiries > 0 ? cm!.total_inquiries : '—'}
            </div>
            <div className="text-[11px] text-white/70">Target: {client.kpiTargets.leads} across all channels</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#ec4899' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Confirmed Bookings</span>
            <div className={`text-[28px] font-black leading-none my-2 ${hasData && cm!.total_bookings > 0 ? 'text-white' : 'text-white/70'}`}>
              {hasData && cm!.total_bookings > 0 ? cm!.total_bookings : '—'}
            </div>
            <div className="text-[11px] text-white/70">Target: {client.kpiTargets.appointments}/mo</div>
          </div>
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: '#06b6d4' }} />
            <span className="text-[10px] font-bold uppercase text-white/60">Gross Rental Revenue</span>
            <div className={`text-[28px] font-black leading-none my-2 ${hasData && cm!.total_revenue > 0 ? 'text-white' : 'text-white/70'}`}>
              {hasData && cm!.total_revenue > 0 ? fmtUSD(cm!.total_revenue) : '—'}
            </div>
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
            {totalChannelRevenue > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Total</div>
                <div className="text-[18px] font-black text-white">{fmtUSD(totalChannelRevenue)}</div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {(() => {
              // Merge API data with known channels
              const channels = ['Airbnb', 'VRBO', 'Direct'];
              const statusMap: Record<string, { status: string; statusColor: string }> = {
                Airbnb: { status: 'Live', statusColor: '#059669' },
                VRBO: { status: 'Launching', statusColor: accentColor },
                Direct: { status: 'Planned', statusColor: '#94a3b8' },
              };
              return channels.map((ch) => {
                const apiRow = channelData.find((c) => c.platform.toLowerCase() === ch.toLowerCase());
                const rev = apiRow ? Number(apiRow.total_revenue) : 0;
                const pct = totalChannelRevenue > 0 ? (rev / totalChannelRevenue) * 100 : 0;
                const { status, statusColor } = statusMap[ch] || { status: '', statusColor: '#94a3b8' };
                return (
                  <div key={ch}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">{ch}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: statusColor + '22', color: statusColor }}>
                          {status}
                        </span>
                        {apiRow && <span className="text-[10px] text-white/50">{apiRow.booking_count} bookings</span>}
                      </div>
                      <span className="text-[13px] font-bold text-white/70">{rev > 0 ? fmtUSD(rev) : '—'}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: pct > 0 ? `${pct}%` : '2%',
                          background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                          opacity: pct > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            {totalChannelRevenue > 0
              ? 'Revenue data synced via Hospitable → Make. Goal: shift 20%+ of bookings to direct to reduce OTA commission fees.'
              : 'Revenue data will populate once Hospitable syncs through Make. Goal: shift 20%+ of bookings to direct to reduce OTA commission fees.'}
          </div>
        </div>
      </div>

      {/* ── UPCOMING BOOKINGS ── */}
      {(summary?.upcoming || []).length > 0 && (
        <div>
          <SectionLabel>Upcoming Bookings · Next 90 Days</SectionLabel>
          <div className="glass-card p-6">
            <div className="space-y-3">
              {summary!.upcoming.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: b.platform === 'Airbnb' ? '#FF585D22' : b.platform === 'VRBO' ? `${accentColor}22` : 'rgba(255,255,255,0.1)',
                        color: b.platform === 'Airbnb' ? '#FF585D' : b.platform === 'VRBO' ? accentColor : 'white',
                      }}
                    >
                      {b.platform}
                    </span>
                    <div>
                      <div className="text-[12px] font-bold text-white">{b.guest_name || 'Guest'}</div>
                      <div className="text-[11px] text-white/60">{b.check_in} → {b.check_out} · {b.nights} nights</div>
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-white">{b.total_payout ? fmtUSD(b.total_payout) : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div className={`text-[36px] font-black leading-none my-2 ${hasReviews ? 'text-white' : 'text-white/70'}`}>
                {hasReviews ? Number(rs!.avg_rating).toFixed(1) : '—'}
              </div>
              <div className="text-[11px] text-white/70">Target: 4.8+ stars</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Total Reviews</div>
              <div className={`text-[36px] font-black leading-none my-2 ${hasReviews ? 'text-white' : 'text-white/70'}`}>
                {hasReviews ? rs!.total_reviews : '—'}
              </div>
              <div className="text-[11px] text-white/70">Airbnb + VRBO combined</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">5-Star Rate</div>
              <div className={`text-[36px] font-black leading-none my-2 ${hasReviews ? 'text-white' : 'text-white/70'}`}>
                {hasReviews ? `${Math.round((rs!.five_star_count / rs!.total_reviews) * 100)}%` : '—'}
              </div>
              <div className="text-[11px] text-white/70">% of reviews at 5 stars</div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/70 leading-relaxed">
            {hasReviews
              ? 'Review data synced from Hospitable. Strategy: automated post-checkout message, welcome guide thank-you, 5-star guarantee follow-up.'
              : 'Review data will sync from Hospitable via Make once connected. Strategy: automated post-checkout message, welcome guide thank-you, 5-star guarantee follow-up.'}
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
