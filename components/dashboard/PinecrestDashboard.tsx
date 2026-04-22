'use client';

/**
 * Pinecrest dashboard — younger location (reopening). Surfaces the same
 * PDM-cascade content calendar workflow Niceville has, plus the tier-3
 * membership reference card and a concepts bank for content planning.
 *
 * Heavier-weight Pinecrest dashboard (with launch playbook progress, etc)
 * lives in the existing dashboard infrastructure; this is the
 * content-planning surface MNA looks at most often.
 */

import React, { useState } from 'react';
import type { Client } from '@/lib/clients';
import MonthlyContentCalendar from './MonthlyContentCalendar';
import ConceptsPanel from './ConceptsPanel';
import PrimeIVMembershipCard from './PrimeIVMembershipCard';
import TikTokAnalytics from './TikTokAnalytics';
import TikTokContentPlan from './TikTokContentPlan';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 mb-3 pl-0.5">
      {children}
    </div>
  );
}

export default function PinecrestDashboard({ client }: { client: Client }) {
  const { gradientFrom, gradientTo } = client.branding;

  return (
    <div className="space-y-8 max-w-[1400px]">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">
            Prime IV — Pinecrest
          </h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>
            Reopening
          </span>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Pinecrest, FL · Tier 3 pricing · Pre-launch content planning
        </p>
      </div>

      {/* ── CONTENT CALENDAR (PDM cascade lives here too) ── */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <SectionLabel>Content Calendar</SectionLabel>
          <CorporateSeedButton clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        </div>
        <MonthlyContentCalendar clientName={client.name} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        <div className="mt-3">
          <ConceptsPanel clientId={client.id} gradientFrom={gradientFrom} gradientTo={gradientTo} />
        </div>
      </div>

      {/* ── TIKTOK ANALYTICS ── */}
      <div>
        <SectionLabel>TikTok · Pinecrest</SectionLabel>
        <TikTokAnalytics
          ownerKey={client.id}
          kvClientId={client.id}
          label="Prime IV Pinecrest"
          niche="IV therapy / wellness / Pinecrest FL"
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
        />
        <div className="mt-3">
          <TikTokContentPlan
            ownerKey={client.id}
            kvClientId={client.id}
            label="Prime IV Pinecrest"
            niche="IV therapy / wellness / Pinecrest FL"
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />
        </div>
      </div>

      {/* ── MEMBERSHIP TIERS (tier 3 pricing for Pinecrest) ── */}
      <div>
        <SectionLabel>Prime IV Memberships · Pamphlet Reference</SectionLabel>
        <PrimeIVMembershipCard gradientFrom={gradientFrom} gradientTo={gradientTo} pricingTier="tier3" />
      </div>
    </div>
  );
}

// Same one-click PDM seed used on Niceville — populates the calendar with
// 14 PDM cascade posts on their actual April dates so the calendar isn't
// empty pre-launch.
function CorporateSeedButton({ clientName, gradientFrom, gradientTo }: { clientName: string; gradientFrom: string; gradientTo: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');
  async function seed() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          playbookId: 'prime-iv-pdm-apr-2026',
          startDate: '2026-04-01',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setMsg(`Loaded ${data.count} PDM posts into April. Reload the calendar.`);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[10px] text-white/70">{msg}</span>}
      <button
        onClick={seed}
        disabled={loading}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        {loading ? 'Loading…' : 'Add PDM Reference Posts'}
      </button>
    </div>
  );
}
