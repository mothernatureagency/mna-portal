'use client';

/**
 * Prime IV Membership Tiers reference card.
 *
 * Shown on both Prime IV dashboards so MNA staff always has the pamphlet
 * details at their fingertips while planning content, writing captions,
 * and answering client questions.
 *
 * Source: "Membership Pamphlets.pdf" (2024 corporate collateral)
 */

import React, { useState } from 'react';
import Link from 'next/link';

type Tier = {
  id: 'select' | 'essentials' | 'transformation' | 'enlightenment';
  name: string;
  price: number;
  value?: number;          // optional — only shown when this is a "value" tier
  tagline: string;
  description: string;
  perks: string[];
  accent: string;
};

export type PricingTier = 'tier2' | 'tier3';

// Tier 3 — Pinecrest. Includes SELECT $110 entry tier + the savings
// callouts since corporate markets the "$X value" framing for this tier.
const TIERS_TIER3: Tier[] = [
  {
    id: 'select',
    name: 'SELECT',
    price: 110,
    value: 194,
    tagline: 'The starter',
    description: 'For those who value consistency. A regular hydration + vitamin boost to keep health on track. Minimal commitment.',
    perks: [
      '1 Primary IV Drip of your choice',
      '1 B-12 or Lipolean Injection',
      'VIP Status + Massage Chair Access',
      '50% OFF Additional IV Drip Additives',
      'Oxygen Treatment',
    ],
    accent: '#c8a96e',
  },
  {
    id: 'essentials',
    name: 'ESSENTIALS',
    price: 189,
    value: 320,
    tagline: 'The sweet spot',
    description: 'More comprehensive support with flexible options. Great for those who benefit from a holistic approach to hydration + vitamin therapy.',
    perks: [
      'ANY 1 IV Drip of your choice',
      '2 B-12 or Lipolean Injections',
      'VIP Status + Massage Chair Access',
      '15% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Oxygen Treatment',
    ],
    accent: '#7aafd4',
  },
  {
    id: 'transformation',
    name: 'TRANSFORMATION',
    price: 359,
    value: 605,
    tagline: 'The committed',
    description: 'Tailored for those on a real wellness journey. Maximizes health potential with multiple IV drips and a wider selection of injections.',
    perks: [
      'ANY 2 IV Drips of your choice',
      '3 Injections of your choice',
      'VIP Status + Massage Chair Access',
      '20% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Oxygen Treatment',
    ],
    accent: '#3a7ab5',
  },
  {
    id: 'enlightenment',
    name: 'ENLIGHTENMENT',
    price: 649,
    value: 1055,
    tagline: 'The all-in',
    description: 'Ultimate flexibility + comprehensive support. Perfect for individuals OR households looking to maximize wellness with a wider treatment range.',
    perks: [
      'ANY 4 IV Drips of your choice',
      'ANY 5 Injections (including Vitamin D)',
      'VIP Status + Massage Chair Access',
      '25% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Shareable Among 2 Household Members',
      'Oxygen Treatment',
    ],
    accent: '#1c3d6e',
  },
];

// Tier 2 — Niceville. Three tiers, NO "savings" / value framing
// (corporate doesn't market $X-value for tier 2 pricing).
const TIERS_TIER2: Tier[] = [
  {
    id: 'essentials',
    name: 'ESSENTIALS',
    price: 159,
    tagline: 'The sweet spot',
    description: 'More comprehensive support with flexible options. Great for those who benefit from a holistic approach to hydration + vitamin therapy.',
    perks: [
      'ANY 1 IV Drip of your choice',
      '2 B-12 or Lipolean Injections',
      'VIP Status + Massage Chair Access',
      '15% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Oxygen Treatment',
    ],
    accent: '#7aafd4',
  },
  {
    id: 'transformation',
    name: 'TRANSFORMATION',
    price: 299,
    tagline: 'The committed',
    description: 'Tailored for those on a real wellness journey. Maximizes health potential with multiple IV drips and a wider selection of injections.',
    perks: [
      'ANY 2 IV Drips of your choice',
      '3 Injections of your choice',
      'VIP Status + Massage Chair Access',
      '20% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Oxygen Treatment',
    ],
    accent: '#3a7ab5',
  },
  {
    id: 'enlightenment',
    name: 'ENLIGHTENMENT',
    price: 549,
    tagline: 'The all-in',
    description: 'Ultimate flexibility + comprehensive support. Perfect for individuals OR households looking to maximize wellness with a wider treatment range.',
    perks: [
      'ANY 4 IV Drips of your choice',
      'ANY 5 Injections (including Vitamin D)',
      'VIP Status + Massage Chair Access',
      '25% OFF any Additional IV Drips & Injections',
      '50% OFF Additional IV Drip Additives',
      'Shareable Among 2 Household Members',
      'Oxygen Treatment',
    ],
    accent: '#1c3d6e',
  },
];

const TIERS_BY_PRICING: Record<PricingTier, Tier[]> = {
  tier2: TIERS_TIER2,
  tier3: TIERS_TIER3,
};

export default function PrimeIVMembershipCard({
  gradientFrom,
  gradientTo,
  pricingTier = 'tier3',
}: {
  gradientFrom: string;
  gradientTo: string;
  pricingTier?: PricingTier;
}) {
  const TIERS = TIERS_BY_PRICING[pricingTier];
  const [openId, setOpenId] = useState<Tier['id'] | null>(null);

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>card_membership</span>
            <h3 className="text-[15px] font-bold text-white">Membership Tiers</h3>
          </div>
          <p className="text-[11px] text-white/55">
            Corporate pamphlet reference · plan MNA content alongside what Prime IV is posting
          </p>
        </div>
        <Link
          href="/agents/ai/content-calendar"
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
        >
          Load "Membership Push" Playbook →
        </Link>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${TIERS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
        {TIERS.map((t) => {
          const isOpen = openId === t.id;
          const hasSavings = typeof t.value === 'number' && t.value > t.price;
          const savings = hasSavings ? t.value! - t.price : 0;
          const savingsPct = hasSavings ? Math.round(((t.value! - t.price) / t.value!) * 100) : 0;
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(isOpen ? null : t.id)}
              className="text-left rounded-xl p-4 transition hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(255,255,255,0.08)`,
                borderLeft: `3px solid ${t.accent}`,
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{t.tagline}</div>
              <div className="text-[13px] font-extrabold text-white mt-0.5">{t.name}</div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-[22px] font-black text-white leading-none">${t.price}</span>
                <span className="text-[10px] text-white/55">/ mo</span>
              </div>
              {hasSavings && (
                <div className="text-[10px] text-white/55 mt-0.5">
                  <span className="line-through">${t.value}</span>
                  <span className="ml-1.5 font-bold" style={{ color: t.accent }}>Save ${savings} ({savingsPct}%)</span>
                </div>
              )}

              {isOpen ? (
                <>
                  <p className="text-[11px] text-white/70 mt-3 leading-relaxed">{t.description}</p>
                  <ul className="mt-3 space-y-1">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-start gap-1.5 text-[11px] text-white/80">
                        <span className="leading-none mt-0.5" style={{ color: t.accent }}>•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-white/40 mt-2 italic">Tap to collapse</div>
                </>
              ) : (
                <div className="text-[10px] text-white/40 mt-3">Tap to see perks</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[10px] text-white/40 mt-4 pt-3 border-t border-white/10">
        Every tier includes: VIP Status + Massage Chair Access · 50% off IV drip additives · Oxygen Treatment.
        <span className="ml-1">*Some exclusions may apply.</span>
      </div>
    </div>
  );
}
