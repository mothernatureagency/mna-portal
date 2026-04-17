/**
 * Creator program — for influencer / content-creator accounts.
 *
 * @alexusaura is the seed creator. The account gets:
 *   - Social platform connections (TikTok, IG, YouTube, etc.)
 *   - Trending audio + topic feed
 *   - Content calendar (with view-toggle to her personal calendar)
 *   - Insights / analytics dashboard
 *   - Brand deals + sponsor pipeline
 *   - TikTok Live planning + TikTok Shop tracking
 *   - Personal task list
 *   - Mother Nature globe assistant
 *
 * MNA staff (mn@) automatically gets access since the account belongs
 * to Alexus herself.
 */

export type Creator = {
  email: string;             // login email for this creator account
  handle: string;            // primary handle (e.g. '@alexusaura')
  displayName: string;
  niche: string[];
  brandColor: 'aura' | 'sunset' | 'forest' | 'midnight';
  startedAt: string;
};

export const CREATORS: Creator[] = [
  {
    email: 'alexusaura@mothernatureagency.com',
    handle: '@alexusaura',
    displayName: 'Alexus Aura',
    niche: ['lifestyle', 'wellness', 'real estate', 'creator'],
    brandColor: 'aura',
    startedAt: '2026-04-17',
  },
];

export function getCreatorByEmail(email: string | null | undefined): Creator | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return CREATORS.find((c) => c.email.toLowerCase() === normalized) || null;
}

export function isCreator(email: string | null | undefined): boolean {
  return !!getCreatorByEmail(email);
}

// ── Theme palettes ──────────────────────────────────────────────────
export const CREATOR_THEMES = {
  aura: {
    gradientFrom: '#a855f7',
    gradientTo:   '#f472b6',
    accent:       '#f9a8d4',
    chipBg:       'rgba(244,114,182,0.18)',
    chipBorder:   'rgba(244,114,182,0.45)',
    bgGradient:   'linear-gradient(135deg,#1a0533 0%,#3b0764 25%,#7e22ce 50%,#c026d3 75%,#f472b6 100%)',
  },
  sunset: {
    gradientFrom: '#f97316',
    gradientTo:   '#facc15',
    accent:       '#fde68a',
    chipBg:       'rgba(249,115,22,0.18)',
    chipBorder:   'rgba(250,204,21,0.45)',
    bgGradient:   'linear-gradient(135deg,#27130b 0%,#5c2308 25%,#9a3412 50%,#f97316 75%,#facc15 100%)',
  },
  forest: {
    gradientFrom: '#059669',
    gradientTo:   '#a7f3d0',
    accent:       '#6ee7b7',
    chipBg:       'rgba(16,185,129,0.18)',
    chipBorder:   'rgba(110,231,183,0.45)',
    bgGradient:   'linear-gradient(135deg,#022c22 0%,#064e3b 25%,#065f46 50%,#10b981 75%,#a7f3d0 100%)',
  },
  midnight: {
    gradientFrom: '#1e3a8a',
    gradientTo:   '#60a5fa',
    accent:       '#bfdbfe',
    chipBg:       'rgba(59,130,246,0.18)',
    chipBorder:   'rgba(96,165,250,0.45)',
    bgGradient:   'linear-gradient(135deg,#020617 0%,#0f172a 25%,#1e3a8a 50%,#3b82f6 75%,#bfdbfe 100%)',
  },
} as const;

// ── Connections (which platforms are linked) ────────────────────────
export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | 'x' | 'pinterest' | 'snapchat' | 'threads';

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  threads: 'Threads',
};

export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  tiktok: '#ff0050',
  instagram: '#e1306c',
  youtube: '#ff0000',
  x: '#1f2937',
  pinterest: '#bd081c',
  snapchat: '#fffc00',
  threads: '#a855f7',
};

export type Connection = {
  platform: SocialPlatform;
  handle: string;
  followers?: number;
  connectedAt?: string;
  status: 'connected' | 'disconnected';
};

// ── Trending audio + topics (curated, refreshable) ──────────────────
export type TrendingAudio = {
  id: string;
  title: string;
  artist: string;
  platform: SocialPlatform;
  vibe: string;        // e.g. "feel-good", "dramatic", "nostalgic"
  whyTrending: string; // 1-line why it's hot right now
  uses?: number;       // estimated # of uses (kept fresh by the user)
};

export type TrendingTopic = {
  id: string;
  title: string;
  hashtag?: string;
  platform: SocialPlatform;
  angle: string;       // best angle for the creator's niche
  decay: 'rising' | 'peak' | 'fading';
};

// ── Brand deals / sponsorships ──────────────────────────────────────
export type DealStage = 'lead' | 'pitched' | 'negotiating' | 'contracted' | 'live' | 'paid' | 'declined';

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  pitched: 'Pitched',
  negotiating: 'Negotiating',
  contracted: 'Contracted',
  live: 'Live',
  paid: 'Paid',
  declined: 'Declined',
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead: '#94a3b8',
  pitched: '#0ea5e9',
  negotiating: '#f59e0b',
  contracted: '#a855f7',
  live: '#10b981',
  paid: '#22c55e',
  declined: '#ef4444',
};

export type BrandDeal = {
  id: string;
  brand: string;
  contactName?: string;
  contactEmail?: string;
  amount: number;        // total deal value USD
  deliverables: string;  // free-text e.g. "1 Reel + 3 Stories"
  dueDate?: string;
  stage: DealStage;
  notes?: string;
  createdAt: string;
};

// ── TikTok Shop tracking ────────────────────────────────────────────
export type ShopProduct = {
  id: string;
  name: string;
  link?: string;        // affiliate link
  commissionPct: number;
  pricePoint: number;
  unitsSold: number;    // running total she updates
  earnings: number;     // running total she updates
  active: boolean;
  createdAt: string;
};

// ── TikTok Live planning ────────────────────────────────────────────
export type LiveSession = {
  id: string;
  title: string;
  scheduledAt: string;  // ISO timestamp
  durationMin: number;
  topic: string;
  goals?: string;       // what she wants to accomplish
  outcomes?: string;    // post-live notes (giftedDuring, peak viewers, conversions)
  status: 'scheduled' | 'live' | 'done' | 'cancelled';
};

// ── AI helpers for creators (separate registry from MNA staff agents)
export type CreatorAgentId = 'content-strategist' | 'caption-writer' | 'trend-spotter' | 'brand-pitch' | 'live-coach';

export type CreatorAgent = {
  id: CreatorAgentId;
  name: string;
  role: string;
  icon: string;
  tagline: string;
  systemPrompt: string;
  suggestions: string[];
};

export const CREATOR_AGENTS: CreatorAgent[] = [
  {
    id: 'content-strategist',
    name: 'Content Strategist',
    role: 'Posting plans + content pillars',
    icon: 'auto_stories',
    tagline: 'Builds your weekly content plan',
    systemPrompt:
      `You are Alexus's content strategist. She runs @alexusaura — lifestyle / wellness / real estate / creator content.
Help her: build content pillars, plan weekly posting cadence (TikTok daily, IG 3-5x, YouTube 1x), batch ideas, decide what to repost vs film fresh, and balance evergreen with trend-jumping.
Be tactical. Give numbered plans, specific hooks, and post-by-post breakdowns. Acknowledge that real-estate content has slower hook windows than lifestyle.
Format: numbered lists or day-by-day plans. Short paragraphs only. No filler.`,
    suggestions: [
      'Build me a 7-day TikTok plan',
      'What content pillars should I have?',
      'How do I batch a week of content in one shoot?',
    ],
  },
  {
    id: 'caption-writer',
    name: 'Caption Writer',
    role: 'Hooks, captions, CTAs',
    icon: 'edit_note',
    tagline: 'Punchy captions that convert',
    systemPrompt:
      `You are Alexus's caption writer for @alexusaura.
Write hooks in 5-7 words max. Captions in 2-3 short paragraphs. Always end with a clear CTA (comment X, follow for Y, link in bio for Z).
Mix in TikTok line breaks (single sentences with empty lines between). Avoid hashtag spam — 3-5 targeted hashtags max. Voice: warm, confident, real, never corporate.
When asked for a caption, give 2 variants: one short/scroll-stopping, one storytelling.`,
    suggestions: [
      'Caption for a real estate market update Reel',
      'Hook ideas for a "day in the life" video',
      'CTA to drive people to my link in bio',
    ],
  },
  {
    id: 'trend-spotter',
    name: 'Trend Spotter',
    role: 'Audio + trend angles',
    icon: 'whatshot',
    tagline: 'Today\'s trends, your angle on them',
    systemPrompt:
      `You are Alexus's trend spotter for TikTok, IG Reels, and YouTube Shorts.
When she asks "what's trending," give 3-5 specific trend formats (audio name + creator who started it + the format pattern). Then suggest how each one fits HER niche (lifestyle / wellness / real estate / creator).
You don't have live trend data — say so when uncertain — but you DO know the patterns: POV format, "tell me without telling me," day-in-the-life, dramatic-reveal, behind-the-scenes, before/after.
Keep it short and immediately usable.`,
    suggestions: [
      'What trend formats fit a real estate agent?',
      'Suggest 3 audios I can use this week',
      'How do I jump on a trend without it feeling forced?',
    ],
  },
  {
    id: 'brand-pitch',
    name: 'Brand Pitch Pro',
    role: 'Outreach + media kits',
    icon: 'handshake',
    tagline: 'Cold pitches and rate negotiations',
    systemPrompt:
      `You are Alexus's brand-deal coach for @alexusaura.
Help her: write cold pitch emails to brands, build a one-pager media kit, set rates based on follower count + engagement, negotiate up when brands lowball, and decide which deals to take vs decline.
Standard rate framework: $100 per 10k followers for one Reel + 1 Story (use as floor; charge more for usage rights, exclusivity, multi-platform).
Be direct, confident, no apologetic language. Pitch emails: ≤120 words, subject line + 2 paragraphs + clear ask.`,
    suggestions: [
      'Write a cold pitch to a wellness brand',
      'A brand offered $200 — should I counter?',
      'What do I put in a media kit?',
    ],
  },
  {
    id: 'live-coach',
    name: 'Live Coach',
    role: 'TikTok Live + monetization',
    icon: 'videocam',
    tagline: 'Plan, host, and monetize Lives',
    systemPrompt:
      `You are Alexus's TikTok Live coach.
Help her: plan a Live (topic, hook, gift goal, length), structure the first 10 minutes to hold viewers, prompt for gifts/follows naturally, handle low-viewer moments, sell TikTok Shop products on Live, and track gifts → diamonds → actual cash.
Diamond math: 1 coin = $0.01, gifts cost coins, creator gets 50% of diamond value (~$0.005 per coin). 1000 coins = ~$5 for the creator.
Format: short, tactical, actionable.`,
    suggestions: [
      'Plan a 30-minute Live about real estate',
      'How do I get more gifts on Live?',
      'What products should I sell on Live this week?',
    ],
  },
];

export function getCreatorAgent(id: string): CreatorAgent | undefined {
  return CREATOR_AGENTS.find((a) => a.id === id);
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
