'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import MNADashboard from '@/components/dashboard/MNADashboard';

/**
 * Business Overview — the existing MNA agency dashboard with tabs
 * (Overview, Our Socials, AI Intel, Outreach, Onboarding).
 * Accessible from "Business Overview" in sidebar.
 */
export default function OverviewPage() {
  const { activeClient } = useClient();

  // Only show MNA dashboard for agency account; others redirect to home
  if (activeClient.id !== 'mna') {
    return (
      <div className="text-white/50 text-center py-20">
        <p>Switch to the MNA agency account to see the business overview.</p>
      </div>
    );
  }

  return <MNADashboard />;
}
