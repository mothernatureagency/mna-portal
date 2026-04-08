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

export type Client = {
  id: string;
  name: string;
  shortName: string;
  industry: string;
  location?: string;
  branding: ClientBranding;
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
      // Real logo files — SVGs are handled with <img> tags (no Next.js optimization needed)
      logoUrl: '/logos/mna-logo.svg',   // 500×500 square — full stacked logo mark
      iconUrl: '/logos/mna-icon.svg',   // 500×500 square — icon mark only
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
    shortName: 'Prime IV',
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
    notes: 'Premium IV therapy & wellness clinic in Niceville, FL. High-value clientele, focus on luxury health positioning and appointment-driven conversions.',
    integrations: ['Google Ads', 'Meta Ads', 'Jane App', 'Mailchimp'],
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
    notes: 'Reopening location — Prime IV Pinecrest, FL. Co-owned by Alexus Williams and partner. Grand reopening launch focus: brand awareness, lead generation, memberships, and appointment bookings.',
    integrations: ['Google Ads', 'Meta Ads', 'Jane App', 'Mailchimp'],
  },
];
