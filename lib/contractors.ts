/**
 * Contractor directory.
 *
 * Contractors are construction / remodel / new-build clients that MNA
 * services. They get a focused workspace at /contractor with:
 *   - Active jobs (bidding · active · punch · complete)
 *   - Job notes (one running thread per project)
 *   - Customer invoices (what they bill homeowners)
 *   - P&L per job (revenue − materials − labor)
 *   - Schedule (job-site visits, walkthroughs, inspections)
 *
 * They do NOT see other clients, agency-wide data, or staff dashboards.
 *
 * To onboard a contractor:
 *   1. Add their email + name + business + trade here
 *   2. Create their Supabase auth user with user_metadata.role = 'contractor'
 *   3. Their email here MUST match the auth email exactly
 */

export type Contractor = {
  email: string;
  name: string;            // contact name
  business: string;        // company name (e.g. "Williams Construction LLC")
  trade: 'general' | 'remodel' | 'new_construction' | 'specialty';
  serviceArea?: string;    // e.g. "Niceville / Destin, FL"
  startedAt: string;       // YYYY-MM-DD
};

export const CONTRACTORS: Contractor[] = [
  // Seeded placeholder — replace with real contractor info once onboarded.
  {
    email: 'contractor@mothernatureagency.com',
    name: 'Contractor',
    business: 'New Contractor (placeholder)',
    trade: 'general',
    serviceArea: 'Emerald Coast, FL',
    startedAt: '2026-04-16',
  },
];

export function getContractorByEmail(email: string | null | undefined): Contractor | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return CONTRACTORS.find((c) => c.email.toLowerCase() === normalized) || null;
}

export function isContractor(email: string | null | undefined): boolean {
  return !!getContractorByEmail(email);
}

export const TRADE_LABELS: Record<Contractor['trade'], string> = {
  general: 'General Contractor',
  remodel: 'Remodel Specialist',
  new_construction: 'New Construction',
  specialty: 'Specialty Trade',
};

// ── Job model ───────────────────────────────────────────────────────
// Stored in client_kv as { client_id: contractor_email, key: 'jobs', value: Job[] }
// Single-source-of-truth lives in the cloud — this lib just defines the shape.

export type JobStatus = 'bidding' | 'active' | 'punch_list' | 'completed' | 'lost';

export type Job = {
  id: string;
  name: string;             // e.g. "Smith — Kitchen Remodel"
  address?: string;
  status: JobStatus;
  contractAmount: number;   // signed contract value
  invoicedToDate: number;   // sum of issued invoices
  paidToDate: number;       // sum of paid invoices
  materialsCost: number;    // running materials spend
  laborCost: number;        // running labor spend (subs + crew)
  startDate?: string;
  targetCompletion?: string;
  notes?: string;
  createdAt: string;
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  bidding: 'Bidding',
  active: 'Active',
  punch_list: 'Punch List',
  completed: 'Completed',
  lost: 'Lost',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  bidding: '#94a3b8',
  active: '#0ea5e9',
  punch_list: '#f59e0b',
  completed: '#10b981',
  lost: '#ef4444',
};

/** Compute per-job profitability. */
export function jobPnL(job: Job) {
  const revenue = job.invoicedToDate;
  const cost = job.materialsCost + job.laborCost;
  const grossProfit = revenue - cost;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return { revenue, cost, grossProfit, margin };
}
