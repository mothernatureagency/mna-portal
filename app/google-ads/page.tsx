'use client';

/**
 * Google Performance (staff).
 *
 * The Google-side counterpart to /meta-ads: Business Profile standing, Google
 * Ads, website analytics and search, for whichever client is active. Business
 * Profile pulls from synced reviews; GA4 and Search Console pull live once the
 * property and site are connected on the card. Google Ads stays staff-entered
 * until a developer token exists.
 */

import React from 'react';
import { useClient } from '@/context/ClientContext';
import GoogleOverview from '@/components/client-portal/GoogleOverview';

export default function GoogleAdsPage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Google Performance</h1>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          {activeClient.name} · Business Profile, Ads, website and search
        </p>
      </div>

      <GoogleOverview
        clientId={activeClient.id}
        clientName={activeClient.shortName}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        editable
      />
    </div>
  );
}
