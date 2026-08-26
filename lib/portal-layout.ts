import type { Client } from '@/lib/clients';

/**
 * Client-portal layout & content model.
 *
 * Two per-client records in `client_kv` drive everything the client sees:
 *
 *   portal_layout  → which pages / sections are shared with this client
 *   portal_content → staff-authored overrides for the editable sections
 *                    (KPI tiles, ad budget, lead sources, top posts, titles)
 *
 * Both are sparse: anything absent falls back to the defaults below, so a
 * brand-new client gets the full portal until someone curates it.
 */

export const PORTAL_LAYOUT_KEY = 'portal_layout';
export const PORTAL_CONTENT_KEY = 'portal_content';
/** Per-client overrides for the code defaults in lib/clients.ts. */
export const KPI_TARGETS_KEY = 'kpi_targets';

// ── Registry ──────────────────────────────────────────────────

export type PortalSectionDef = {
  id: string;
  label: string;
  /** Sections that only render when their data source has rows. */
  note?: string;
  /** Opt-in sections start hidden and are shared per client. Defaults true. */
  defaultShared?: boolean;
};

export type PortalPageDef = {
  href: string;
  label: string;
  icon: string;
  /** Always shared — the portal needs a landing page. */
  locked?: boolean;
  sections: PortalSectionDef[];
};

export const PORTAL_PAGES: PortalPageDef[] = [
  {
    href: '/client',
    label: 'Overview',
    icon: 'dashboard',
    locked: true,
    sections: [
      { id: 'overview.calendar', label: 'Content Calendar preview', note: 'Month grid of approved posts' },
      { id: 'overview.kpis-live', label: 'Performance KPIs', note: 'Auto-pulled Meta metrics + manual pipeline numbers' },
      { id: 'overview.competitors', label: 'Competitor Benchmark' },
      { id: 'overview.google', label: 'Google Performance', note: 'Business Profile, Ads, website and search' },
      { id: 'overview.meta-ads', label: 'Meta Ads Performance', note: 'Live campaign spend, clicks and CTR — off by default', defaultShared: false },
      { id: 'overview.kpi-tiles', label: 'Headline KPI tiles', note: 'Four editable summary tiles' },
      { id: 'overview.revenue', label: 'Revenue Projections' },
      { id: 'overview.quarters', label: 'Quarterly Breakdown' },
      { id: 'overview.performance', label: 'Performance Overview' },
      { id: 'overview.attribution', label: 'Attribution Overview' },
      { id: 'overview.ad-spend', label: 'Ad Spend Breakdown', note: 'Monthly ad budget by agency + channel' },
      { id: 'overview.lead-sources', label: 'Lead Sources' },
      { id: 'overview.top-content', label: 'Top performing content' },
      { id: 'overview.meta-account', label: 'Meta Ads Account' },
    ],
  },
  {
    href: '/client/content',
    label: 'Content',
    icon: 'photo_camera',
    sections: [
      { id: 'content.shot-list', label: 'Shot list', note: 'What we need captured at the location' },
      { id: 'content.ideas', label: 'Content ideas', note: 'Client types a topic, gets shots + scripts' },
      { id: 'content.analytics', label: 'Video performance', note: 'Top TikTok and YouTube videos' },
    ],
  },
  { href: '/client/agenda', label: 'Agenda', icon: 'event_note', sections: [] },
  { href: '/client/calendar', label: 'Content Calendar', icon: 'calendar_month', sections: [] },
  { href: '/client/campaigns', label: 'Email & SMS', icon: 'forward_to_inbox', sections: [] },
  { href: '/client/notes', label: 'Meeting Notes', icon: 'description', sections: [] },
  { href: '/client/tasks', label: 'Tasks', icon: 'checklist', sections: [] },
  { href: '/client/invoices', label: 'Invoices', icon: 'receipt_long', sections: [] },
  { href: '/client/booking', label: 'Book Meeting', icon: 'event_available', sections: [] },
];

export const ALL_SECTIONS: PortalSectionDef[] = PORTAL_PAGES.flatMap((p) => p.sections);

export function pageForHref(href: string) {
  return PORTAL_PAGES.find((p) => p.href === href);
}

// ── Visibility ────────────────────────────────────────────────

export type PortalLayout = {
  /** Master switch — when true the client sees a "paused" notice everywhere. */
  paused?: boolean;
  pages: Record<string, boolean>;
  sections: Record<string, boolean>;
};

export const EMPTY_LAYOUT: PortalLayout = { pages: {}, sections: {} };

/** Absent = shared. Only an explicit `false` hides something. */
export function isPageShared(layout: PortalLayout, href: string): boolean {
  if (pageForHref(href)?.locked) return true;
  return layout.pages[href] !== false;
}

export function isSectionShared(layout: PortalLayout, id: string): boolean {
  const explicit = layout.sections[id];
  if (typeof explicit === 'boolean') return explicit;
  return ALL_SECTIONS.find((s) => s.id === id)?.defaultShared !== false;
}

/** Longest-prefix page match for an arbitrary pathname (e.g. /client/calendar/x). */
export function pageHrefForPathname(pathname: string): string | null {
  if (pathname === '/client') return '/client';
  const match = PORTAL_PAGES
    .filter((p) => p.href !== '/client' && pathname.startsWith(p.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.href : null;
}

export function normalizeLayout(raw: unknown): PortalLayout {
  const v = (raw || {}) as Partial<PortalLayout>;
  return {
    paused: v.paused === true,
    pages: (v.pages && typeof v.pages === 'object' ? v.pages : {}) as Record<string, boolean>,
    sections: (v.sections && typeof v.sections === 'object' ? v.sections : {}) as Record<string, boolean>,
  };
}

// ── Editable content ──────────────────────────────────────────

export type KpiTile = { label: string; value: string; sub: string; color: string };
export type AdSpendRow = { agency: string; channel: string; monthly: number; note: string };
export type LeadSourceRow = { key: string; label: string; sub: string; pct: number };
export type TopPostRow = { platform: string; title: string; type: string; engagement: number; reach: number };

export type PortalContent = {
  /** Section headings, keyed by section id. */
  titles?: Record<string, string>;
  /** Overview page intro line. */
  subtitle?: string;
  kpis?: KpiTile[];
  adSpend?: AdSpendRow[];
  leadSources?: LeadSourceRow[];
  topPosts?: TopPostRow[];
};

export const KPI_COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

const KNOWN_KPIS: Record<string, KpiTile[]> = {
  'prime-iv': [
    { label: 'Total Leads (30d)', value: '464', sub: 'GHL pipeline', color: '#0ea5e9' },
    { label: 'Conversion Rate', value: '16.59%', sub: 'Above 14% target', color: '#8b5cf6' },
    { label: 'Booked Appointments', value: '77', sub: 'Won opportunities', color: '#ec4899' },
    { label: 'March Revenue', value: '$54.5K', sub: '+3.8% vs February', color: '#06b6d4' },
  ],
};

const KNOWN_AD_SPEND: Record<string, AdSpendRow[]> = {
  'prime-iv': [
    { agency: 'Mother Nature Agency', channel: 'Meta', monthly: 600, note: '$20/day daily budget' },
    { agency: 'PDM', channel: 'Meta', monthly: 1290, note: 'Managed separately' },
  ],
};

const KNOWN_TOP_POSTS: Record<string, TopPostRow[]> = {
  'prime-iv': [
    { platform: 'Instagram', title: 'Spa walkthrough reel', type: 'Reel', engagement: 4820, reach: 28400 },
    { platform: 'Instagram', title: 'After Hours giveaway', type: 'Post', engagement: 3210, reach: 18600 },
    { platform: 'Instagram', title: 'Real client review', type: 'Reel', engagement: 2670, reach: 14100 },
  ],
};

export const DEFAULT_LEAD_SOURCES: LeadSourceRow[] = [
  { key: 'fb', label: 'Facebook / Instagram', sub: 'Paid ads', pct: 0 },
  { key: 'google', label: 'Google', sub: 'Organic + paid', pct: 0 },
  { key: 'walkin', label: 'Walk-in', sub: 'In-person', pct: 0 },
  { key: 'referral', label: 'Referral', sub: 'Word of mouth', pct: 0 },
];

/** Shot list — what we ask the client to capture on site. */
export type ShotItem = {
  id: string;
  label: string;
  detail: string;
  /** photo | video | drone | interview — drives the icon and grouping. */
  kind: string;
  done: boolean;
};

export const SHOT_LIST_KEY = 'shot_list';

export const DEFAULT_SHOT_LIST: ShotItem[] = [
  { id: 'stock-no-people', label: 'Stock-style images — no people', detail: 'Clean product, space and detail shots we can use anywhere', kind: 'photo', done: false },
  { id: 'member-room-empty', label: 'Member room — empty', detail: 'Wide and detail shots with nobody in frame', kind: 'photo', done: false },
  { id: 'member-room-people', label: 'Member room — in use', detail: 'Same room with a member in the chair', kind: 'photo', done: false },
  { id: 'drone-exterior', label: 'Drone — exterior', detail: 'Approach to the building, signage, parking, surrounding area', kind: 'drone', done: false },
  { id: 'drone-interior', label: 'Drone — interior (if possible)', detail: 'Slow fly-through of the main space, only where it is safe', kind: 'drone', done: false },
  { id: 'testimonial', label: 'Client testimonial', detail: 'A real member on camera, 30-60 seconds, in their own words', kind: 'interview', done: false },
];

export const SHOT_KINDS: Record<string, { icon: string; label: string }> = {
  photo: { icon: 'photo_camera', label: 'Photo' },
  video: { icon: 'videocam', label: 'Video' },
  drone: { icon: 'flight', label: 'Drone' },
  interview: { icon: 'record_voice_over', label: 'Interview' },
};

export const DEFAULT_SECTION_TITLES: Record<string, string> = {
  'overview.kpi-tiles': 'Highlights',
  'overview.ad-spend': 'Ad Spend Breakdown',
  'overview.lead-sources': 'Lead Sources',
  'overview.top-content': 'Top performing content',
  'overview.meta-account': 'Meta Ads Account',
  'content.shot-list': 'Shot list',
  'content.ideas': 'Content ideas',
  'content.analytics': 'Video performance',
  'overview.revenue': 'Revenue Projections',
  'overview.quarters': 'Quarterly Breakdown',
};

export function defaultKpis(client: Client): KpiTile[] {
  return (
    KNOWN_KPIS[client.id] || [
      { label: 'Monthly Revenue Target', value: `$${(client.kpiTargets.revenue / 1000).toFixed(0)}K`, sub: 'From your plan', color: '#0ea5e9' },
      { label: 'Lead Target', value: `${client.kpiTargets.leads}`, sub: 'Monthly goal', color: '#8b5cf6' },
      { label: 'Conversion Target', value: `${client.kpiTargets.conversionRate}%`, sub: 'Goal', color: '#ec4899' },
      { label: 'Ad Spend', value: `$${(client.kpiTargets.adSpend / 1000).toFixed(1)}K`, sub: 'Monthly budget', color: '#06b6d4' },
    ]
  );
}

export function defaultAdSpend(client: Client): AdSpendRow[] {
  return KNOWN_AD_SPEND[client.id] || [];
}

export function defaultTopPosts(client: Client): TopPostRow[] {
  return KNOWN_TOP_POSTS[client.id] || [];
}

/**
 * Merge a client_kv `kpi_targets` override onto a client's code defaults, so a
 * location's revenue goal / ad budget can be changed without a deploy.
 */
export function applyKpiTargets(client: Client, raw: unknown): Client {
  if (!raw || typeof raw !== 'object') return client;
  const o = raw as Partial<Client['kpiTargets']>;
  const merged = { ...client.kpiTargets };
  for (const k of Object.keys(merged) as (keyof Client['kpiTargets'])[]) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) merged[k] = v;
  }
  return { ...client, kpiTargets: merged };
}

export function normalizeContent(raw: unknown): PortalContent {
  return (raw && typeof raw === 'object' ? raw : {}) as PortalContent;
}
