export type ClientBranding = {
  primaryColor: string;
  secondaryColor: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  mode: 'light' | 'dark';
  logoUrl?: string;
  logoText?: string;
  iconUrl?: string;
};

export type MetaAdsAccount = {
  businessPortfolioId: string;
  businessPortfolioName: string;
  adAccountId: string;
  partnerName?: string;
  partnerBusinessId?: string;
  partnerAccessLevel?: 'Full control' | 'Standard' | 'Limited';
  admin?: { name: string; email?: string };
  datasetPixel?: { name: string; id: string; sources?: string[]; status?: string };
  verificationStatus?: 'Verified' | 'Unverified' | 'Pending';
  createdDate?: string;
  notes?: string;
};

export type ClientLinks = {
  website?: string;
  linktree?: string;
  booking?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  google?: string;
};

export type Client = {
  id: string;
  name: string;
  shortName: string;
  industry: string;
  location?: string;
  branding: ClientBranding;
  links?: ClientLinks;
  kpiTargets: {
    leads: number;
    costPerLead: number;
    conversionRate: number;
    adSpend: number;
    appointments: number;
    revenue: number;
  };
  notes: string;
  integrations: string[];
  metaAds?: MetaAdsAccount;
};

export const clients: Client[] = [
  {
    id: 'mna',
    name: 'Mother Nature Agency',
    shortName: 'MNA',
    industry: 'Marketing Agency',
    branding: {
      primaryColor: '#0c6da4',
      secondaryColor: '#86d6e1',
      gradientFrom: '#0c6da4',
      gradientTo: '#4ab8ce',
      accentColor: '#5bc4d4',
      mode: 'light',
      logoText: 'Mother Nature Agency',
      // MNA gradient logo (PNG) — used in sidebar, header, login, etc.
      logoUrl: '/logos/mna-logo.png',
      iconUrl: '/logos/mna-logo.png',
    },
    kpiTargets: {
      leads: 500,
      costPerLead: 45,
      conversionRate: 12,
      adSpend: 25000,
      appointments: 60,
      revenue: 180000,
    },
    notes: 'Our own agency account. Used for internal tracking and showcasing capabilities to prospective clients.',
    integrations: ['Google Analytics', 'Meta Ads', 'HubSpot', 'Mailchimp'],
  },
  {
    id: 'prime-iv',
    name: 'Prime IV — Niceville',
    shortName: 'Prime IV Niceville',
    industry: 'IV Therapy & Wellness',
    location: 'Niceville, FL',
    branding: {
      primaryColor: '#1c3d6e',
      secondaryColor: '#7aafd4',
      gradientFrom: '#1c3d6e',
      gradientTo: '#3a7ab5',
      accentColor: '#c8a96e',
      mode: 'light',
      logoText: 'Prime IV',
      // Real logo files — PNG handled via next/image for automatic optimization + retina srcSet
      // Source: 9088×4420px RGBA → display at computed sizes (aspect ratio 2.0543:1)
      logoUrl: '/logos/primeiv-logo.png',
      iconUrl: undefined,               // No separate icon file — falls back to scaled logoUrl
    },
    kpiTargets: {
      leads: 280,
      costPerLead: 52,
      conversionRate: 14,
      adSpend: 9500,
      appointments: 68,
      revenue: 88000,
    },
    links: {
      website: 'https://primeivniceville.com',
      linktree: 'https://linktr.ee/primeivniceville',
      booking: 'https://primeivniceville.com/book',
      instagram: 'https://instagram.com/primeivniceville',
      facebook: 'https://facebook.com/primeivniceville',
    },
    notes: 'Premium IV therapy & wellness clinic in Niceville, FL. High-value clientele, focus on luxury health positioning and appointment-driven conversions.',
    integrations: ['Google Ads', 'Meta Ads', 'Jane App', 'Mailchimp'],
    metaAds: {
      businessPortfolioId: '1612011663383887',
      businessPortfolioName: 'Prime IV Niceville',
      adAccountId: '1975481426317109',
      partnerName: 'Mother Nature Agency',
      partnerBusinessId: '211318884636384',
      partnerAccessLevel: 'Full control',
      admin: { name: 'Jennifer Burlison', email: 'niceville@primeivhydration.com' },
      datasetPixel: {
        name: 'PIV Niceville',
        id: '766587706175457',
        sources: ['Meta Pixel', 'Conversions API'],
        status: 'Receiving events',
      },
      verificationStatus: 'Unverified',
      createdDate: '2026-03-03',
      notes:
        'Portfolio created 2026-03-03, still unverified. No primary page set; legal name, address, phone, and website not filled in. Outstanding balance $54.86. Payment: AmEx ···3019. Next payment due at $58.00 threshold or 2026-04-21. Daily spending limit $111.04. Opportunity score 63/100. 9 total campaigns, 1 active (Lead generation). Last 7 day spend $142.79.',
    },
  },
  {
    id: 'prime-iv-pinecrest',
    name: 'Prime IV — Pinecrest',
    shortName: 'Prime IV Pinecrest',
    industry: 'IV Therapy & Wellness',
    location: 'Pinecrest, FL',
    branding: {
      primaryColor: '#1c3d6e',
      secondaryColor: '#7aafd4',
      gradientFrom: '#1c3d6e',
      gradientTo: '#3a7ab5',
      accentColor: '#c8a96e',
      mode: 'light',
      logoText: 'Prime IV Pinecrest',
      logoUrl: '/logos/primeiv-logo.png',
      iconUrl: undefined,
    },
    kpiTargets: {
      leads: 220,
      costPerLead: 55,
      conversionRate: 12,
      adSpend: 8500,
      appointments: 50,
      revenue: 72000,
    },
    links: {
      website: 'https://primeivpinecrest.com',
    },
    notes: 'Reopening location — Prime IV Pinecrest, FL. Co-owned by Alexus Williams and partner. Grand reopening launch focus: brand awareness, lead generation, memberships, and appointment bookings.',
    integrations: ['Google Ads', 'Meta Ads', 'Jane App', 'Mailchimp'],
  },
  {
    id: 'serenity-bayfront',
    name: 'Serenity — Bayfront Freeport',
    shortName: 'Serenity STR',
    industry: 'Short-Term Rental / Vacation Home',
    location: 'Freeport, FL',
    branding: {
      // Coastal bayfront palette: deep sea blue + soft sand + sunset accent
      primaryColor: '#0f4c5c',
      secondaryColor: '#9fd8cb',
      gradientFrom: '#0f4c5c',
      gradientTo: '#4fa3a0',
      accentColor: '#e8b96c',
      mode: 'light',
      logoText: 'Serenity',
    },
    // Vacation rental KPIs think in nights booked + ADR + occupancy,
    // not leads + appointments. The dashboard still reads the same field
    // names, so we map them: "leads" = inquiries, "appointments" = bookings,
    // "revenue" = gross rental revenue, "conversionRate" = inquiry→book %.
    kpiTargets: {
      leads: 120,          // monthly inquiries across Airbnb / VRBO / direct
      costPerLead: 18,     // blended ad CPL across Meta + Google
      conversionRate: 22,  // inquiry to confirmed booking %
      adSpend: 1800,       // monthly brand + retargeting spend
      appointments: 22,    // confirmed bookings per month
      revenue: 14500,      // gross rental revenue per month target
    },
    notes:
      'Bayfront vacation rental on the Freeport, FL waterfront. Focus: Airbnb/VRBO/direct-booking funnel, 5-star review velocity, Instagrammable content from on-property shoots, off-season demand generation, and repeat-guest email list growth. Secondary goal: drive direct bookings to cut OTA fees.',
    integrations: ['Airbnb', 'VRBO', 'Meta Ads', 'Google Ads', 'Mailchimp', 'Hospitable'],
  },
  {
    id: 'mna-realty',
    name: 'MNA Realty — Agent Growth',
    shortName: 'MNA Realty',
    industry: 'Real Estate — Agents & Websites',
    location: 'Niceville / Emerald Coast, FL',
    branding: {
      // Warm realty palette: deep navy + gold accent, feels upscale/trustworthy
      primaryColor: '#1a2a4a',
      secondaryColor: '#c9a25c',
      gradientFrom: '#1a2a4a',
      gradientTo: '#3b4f7f',
      accentColor: '#c9a25c',
      mode: 'light',
      logoText: 'MNA Realty',
    },
    // Realty KPIs map slightly differently:
    //  • "leads" = buyer + seller lead form fills + IDX registrations
    //  • "appointments" = listing appointments + buyer consults booked
    //  • "revenue" = GCI (gross commission income) from closed deals
    //  • "conversionRate" = lead to appointment %
    kpiTargets: {
      leads: 180,          // IDX regs + form fills + open house sign-ins
      costPerLead: 12,     // paid lead gen CPL target (Meta + Google)
      conversionRate: 8,   // lead → appointment
      adSpend: 2200,       // agent + website dev lead gen spend
      appointments: 14,    // listing appointments + buyer consults
      revenue: 48000,      // projected GCI from the pipeline
    },
    notes:
      'Alexus Williams is a licensed real estate agent on the Emerald Coast AND builds websites for other agents. This account serves dual-purpose: (1) grow her own buyer/seller pipeline (listings, open houses, market updates, neighborhood spotlights, video tours) and (2) act as the showcase/portfolio for the website-building service she sells to other agents — templates, IDX setups, lead capture flows, CRM wiring, SEO for local search. Content should rotate between personal agent brand posts, listing content, and "I build websites for agents" educational/lead-gen content.',
    integrations: ['IDX Broker', 'Follow Up Boss', 'Meta Ads', 'Google Ads', 'YouTube', 'Mailchimp', 'Cal.com'],
  },
];
