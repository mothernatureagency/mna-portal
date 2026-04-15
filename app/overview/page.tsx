'use client';
import React from 'react';
import MNADashboard from '@/components/dashboard/MNADashboard';

/**
 * Business Overview — the MNA agency dashboard with tabs
 * (Overview, Our Socials, AI Intel, Outreach, Onboarding).
 *
 * Available to every authenticated staff member regardless of which client
 * they currently have selected. Previously this gated on activeClient.id ===
 * 'mna', which hid the overview from admin@/info@ any time they had a
 * specific client selected — the team now sees the same MNA view Alexus does.
 */
export default function OverviewPage() {
  return <MNADashboard />;
}
