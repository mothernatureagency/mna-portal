'use client';

/**
 * YouTube (staff) — channel stats and top videos for the active client.
 * Set the channel handle on the card; it's stored per client so the portal's
 * Content tab shows the same numbers.
 */

import React from 'react';
import { useClient } from '@/context/ClientContext';
import YouTubeAnalytics from '@/components/dashboard/YouTubeAnalytics';

export default function YouTubePage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">YouTube</h1>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          {activeClient.name} · Channel growth and top-performing videos
        </p>
      </div>

      <YouTubeAnalytics
        ownerKey={activeClient.id}
        kvClientId={activeClient.id}
        label={activeClient.shortName}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        editable
      />
    </div>
  );
}
