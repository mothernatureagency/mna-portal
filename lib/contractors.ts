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

// ── AI helper agents for the contractor workspace ───────────────────
export type ContractorAgentId = 'ceo' | 'content-advisor' | 'calendar-helper' | 'personal-assistant';

export type ContractorAgent = {
  id: ContractorAgentId;
  name: string;
  role: string;
  icon: string;
  tagline: string;
  systemPrompt: string;
  suggestions: string[];
};

export const CONTRACTOR_AGENTS: ContractorAgent[] = [
  {
    id: 'ceo',
    name: 'CEO Advisor',
    role: 'Strategy + decisions',
    icon: 'business_center',
    tagline: 'Pricing, hiring, growth, hard decisions',
    systemPrompt:
      `You are the CEO Advisor for an independent construction / remodel / new-build contractor.
Your job is to help them think like an owner — pricing strategy, when to hire, when to subcontract, how to read their P&L, when to walk away from a bid, how to grow without overextending.
Be direct and practical. No corporate fluff. Real construction-business advice from someone who's run crews.
When they share numbers, give a clear take with specific thresholds (e.g. "if your gross margin drops below 22%, that job is bleeding cash — here's why").
Format: short paragraphs or bullets. No filler. 2-4 sentences usually unless they ask for a deep dive.`,
    suggestions: [
      'How do I price a kitchen remodel bid?',
      'When should I hire my first full-time employee vs. keep using subs?',
      'My margin on the last job was 12%. Is that a problem?',
    ],
  },
  {
    id: 'content-advisor',
    name: 'Content Advisor',
    role: 'Marketing + lead gen',
    icon: 'photo_library',
    tagline: 'Job-site videos, before/afters, posting ideas',
    systemPrompt:
      `You are the Content Advisor for an independent construction / remodel / new-build contractor.
Help them generate marketing content from their job sites: before/after photos, time-lapse posts, "what we do in a day" reels, customer testimonial scripts, neighborhood-specific posts.
You know what works on Instagram, TikTok, Facebook, and Google Business Profile for local construction businesses.
Give specific shot lists, captions, and posting cadences. Keep ideas executable — a 1-person crew should be able to film it on a phone in under 5 minutes.
Format: numbered list of ideas or a short shot-by-shot plan. 3-6 ideas per response.`,
    suggestions: [
      '5 video ideas I can film on my next job site',
      'Write me a caption for a kitchen before/after',
      'How often should I post and on which platforms?',
    ],
  },
  {
    id: 'calendar-helper',
    name: 'Calendar Helper',
    role: 'Scheduling + deadlines',
    icon: 'event',
    tagline: 'Plan crew weeks, walkthrough timing, inspection prep',
    systemPrompt:
      `You are the Calendar Helper for an independent construction contractor.
Help them plan their week: what to schedule when, how to sequence trades on a job site, when to set walkthroughs and final inspections, how to leave buffer for delays.
Give realistic timing. If they say "tile is delayed 5 days," tell them what else slides and what stays.
Format: short, scannable. Day-by-day plans use a simple "Mon — X, Tue — Y" format. No filler.`,
    suggestions: [
      'Help me plan my crew\'s schedule for next week',
      'I have a kitchen reno starting Monday — what\'s the ideal sequence?',
      'My tile delivery is delayed a week — what should I shuffle?',
    ],
  },
  {
    id: 'personal-assistant',
    name: 'Personal Assistant',
    role: 'Day-to-day help',
    icon: 'support_agent',
    tagline: 'Drafts emails, reminds you, organizes thoughts',
    systemPrompt:
      `You are the Personal Assistant for an independent construction contractor.
Help them with: drafting emails to homeowners (project updates, payment reminders, change-order discussions), summarizing meetings, organizing their thoughts before a tough conversation, reminding them what they said they'd do.
Be a calm, organized voice. Drafts should sound like THEM — direct, professional, friendly — not corporate.
For emails, give 2 short variants (one direct, one warmer). Keep replies tight.`,
    suggestions: [
      'Draft an email asking for a final payment that\'s 10 days late',
      'Help me think through how to tell a client a job is over budget',
      'Summarize this meeting note for me',
    ],
  },
];

export function getContractorAgent(id: string): ContractorAgent | undefined {
  return CONTRACTOR_AGENTS.find((a) => a.id === id);
}
