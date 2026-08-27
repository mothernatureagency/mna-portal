/**
 * RFAD — Request for Access & Deliverables.
 *
 * The onboarding checklist a new client works through: account access, domain
 * and website, brand assets, and coordination. The client ticks items off in
 * their portal; each item carries an `owner`, so completing it hands the
 * follow-up work to the right person on our side instead of landing in one
 * undifferentiated pile.
 */

export const RFAD_KEY = 'rfad';

/** Who picks the work up once the client has done their part. */
export type RfadOwner = 'social' | 'manager' | 'ads';

export const RFAD_OWNERS: Record<RfadOwner, { label: string; email: string; blurb: string }> = {
  social: {
    label: 'Social Media',
    email: 'admin@mothernatureagency.com', // Sable
    blurb: 'Content, brand assets, social and video channels',
  },
  manager: {
    label: 'Manager',
    email: 'marketing@mothernatureagency.com', // Vanessa
    blurb: 'CRM, booking, website, coordination',
  },
  ads: {
    label: 'Ads',
    email: 'ads@mothernatureagency.com',
    blurb: 'Ad accounts, pixels, budgets and billing',
  },
};

export type RfadItem = {
  id: string;
  label: string;
  detail?: string;
  owner: RfadOwner;
  /** Items that also capture a value from the client (domain, contact, …). */
  field?: { label: string; placeholder?: string };
  /** Follow-up task created for the owner once the client marks this done. */
  task: string;
};

export type RfadSection = { id: string; title: string; note?: string; items: RfadItem[] };

export const AGENCY_BUSINESS_ID = '211318884636384';

export const RFAD_SECTIONS: RfadSection[] = [
  {
    id: 'crm',
    title: 'CRM & Email/SMS Marketing',
    items: [
      {
        id: 'crm-access',
        label: 'CRM platform access',
        detail:
          'Add mn@, marketing@, socials@ and crm@mothernatureagency.com for CRM management. If you don’t have a CRM, tell us whether to add you as a GHL sub-account or if you’ll create your own.',
        owner: 'manager',
        task: 'Confirm CRM access and set up the pipeline',
      },
      {
        id: 'booking',
        label: 'Booking platform',
        detail: 'Provide access or integration details, if applicable.',
        owner: 'manager',
        task: 'Connect the booking platform and verify integration',
      },
      {
        id: 'automations',
        label: 'Existing automations & workflows',
        detail: 'Current automations, forms, funnels, landing pages, calendars or follow-up sequences.',
        owner: 'manager',
        task: 'Audit existing automations and follow-up sequences',
      },
    ],
  },
  {
    id: 'google',
    title: 'Google & YouTube',
    items: [
      {
        id: 'gbp',
        label: 'Google Business Profile — add as Manager',
        detail: 'Add mn@mothernatureagency.com as a Manager.',
        owner: 'manager',
        task: 'Verify Google Business Profile access and complete the listing',
      },
      {
        id: 'google-ads',
        label: 'Google Ads — Admin access',
        detail: 'Provide Admin access to mn@mothernatureagency.com.',
        owner: 'ads',
        task: 'Confirm Google Ads admin access and review account structure',
      },
      {
        id: 'ga4',
        label: 'Google Analytics (GA4)',
        detail: 'Provide access to mn@mothernatureagency.com, if applicable.',
        owner: 'ads',
        task: 'Connect GA4 and set the property ID on the Google Performance card',
      },
      {
        id: 'gtm',
        label: 'Google Tag Manager',
        detail: 'Provide access to mn@mothernatureagency.com, if applicable.',
        owner: 'ads',
        task: 'Verify Tag Manager access and tracking tags',
      },
      {
        id: 'gsc',
        label: 'Google Search Console',
        detail: 'Provide access to mn@mothernatureagency.com, if applicable.',
        owner: 'ads',
        task: 'Connect Search Console and set the site on the Google Performance card',
      },
      {
        id: 'youtube',
        label: 'YouTube channel access',
        detail:
          'YouTube → YouTube Studio → Settings → Permissions → Invite → add marketing@ and socials@mothernatureagency.com → Manager → Save. Enable Channel Permissions first if prompted, then confirm the invite was sent.',
        owner: 'social',
        task: 'Accept the YouTube invite and set the channel handle',
      },
    ],
  },
  {
    id: 'meta',
    title: 'Meta',
    note: `Meta Business Settings → Partners → Add → Give a Partner Access to Your Assets → enter Business ID ${AGENCY_BUSINESS_ID} → select assets and assign permissions.`,
    items: [
      {
        id: 'meta-partner',
        label: 'Add Mother Nature Agency as a Partner',
        detail: `Business ID ${AGENCY_BUSINESS_ID}. Assign the Facebook Page, Instagram account, ad account, pixel/dataset and leads access.`,
        owner: 'ads',
        task: 'Accept Meta partner access and confirm every asset came through',
      },
      {
        id: 'meta-page-ig',
        label: 'Facebook Page & Instagram connected',
        detail: 'Confirm the Page is on the correct Business Portfolio and Instagram is connected to both the Page and the Portfolio.',
        owner: 'social',
        task: 'Verify Page/Instagram connection and publishing access',
      },
      {
        id: 'meta-adaccount',
        label: 'Ad account & pixel connected',
        detail: 'Confirm the existing ad account and pixel/dataset are attached to the Business Portfolio.',
        owner: 'ads',
        task: 'Set the ad account on the client’s Meta Ads card and check pixel events',
      },
      {
        id: 'meta-billing',
        label: 'Payment method active on the ad account',
        owner: 'ads',
        task: 'Confirm ad account billing is active before launch',
      },
    ],
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    items: [
      {
        id: 'tiktok-business',
        label: 'TikTok Business account — Manager access',
        detail: 'Scan the QR we send for access. If no account exists, we can create and set one up.',
        owner: 'social',
        task: 'Accept TikTok access and set the handle on the Content tab',
      },
      {
        id: 'tiktok-ads',
        label: 'TikTok Ads Manager',
        detail: 'Provide access if an ad account already exists.',
        owner: 'ads',
        task: 'Confirm TikTok Ads access, if applicable',
      },
    ],
  },
  {
    id: 'domain',
    title: 'Domain & Website',
    items: [
      {
        id: 'domain-name',
        label: 'Domain name',
        owner: 'manager',
        field: { label: 'Domain', placeholder: 'example.com' },
        task: 'Record the domain and check DNS/verification needs',
      },
      {
        id: 'website-url',
        label: 'Website URL',
        owner: 'manager',
        field: { label: 'Website', placeholder: 'https://example.com' },
        task: 'Record the website and set it in the client’s merge fields',
      },
      {
        id: 'website-platform',
        label: 'Website platform access',
        detail: 'Provide access if we’ll be managing or making website changes.',
        owner: 'manager',
        task: 'Confirm website platform access',
      },
      {
        id: 'dns',
        label: 'Domain / DNS access',
        detail: 'Registrar or DNS access for tracking, verification, landing pages or site management.',
        owner: 'ads',
        task: 'Complete domain verification and tracking setup',
      },
      {
        id: 'landing-pages',
        label: 'Existing landing pages / funnels',
        detail: 'Links and access, if applicable.',
        owner: 'manager',
        task: 'Review existing landing pages and funnels',
      },
    ],
  },
  {
    id: 'brand',
    title: 'Brand & Media',
    note: 'Upload to the shared drive (preferred) or email mn@mothernatureagency.com.',
    items: [
      {
        id: 'logos',
        label: 'Logos & branding',
        detail: 'Main logo (PNG preferred), secondary marks, fonts, brand guidelines and color codes.',
        owner: 'social',
        task: 'File brand assets and set the client’s branding in the portal',
      },
      {
        id: 'photos',
        label: 'Photos & videos',
        detail: 'Team, storefront, services, UGC and lifestyle content.',
        owner: 'social',
        task: 'Sort media into the content library and build the shot list',
      },
      {
        id: 'promos',
        label: 'Promotional materials',
        detail: 'Menus, flyers, brochures, promotions and offers.',
        owner: 'social',
        task: 'Review promotional materials for content angles',
      },
      {
        id: 'services',
        label: 'Services & pricing',
        detail: 'Current service list/menu and pricing.',
        owner: 'manager',
        task: 'Load services and pricing into the knowledge base',
      },
      {
        id: 'offers',
        label: 'Current offers',
        detail: 'Specials, introductory offers, memberships, packages or promotions.',
        owner: 'ads',
        task: 'Build the launch offer into the ad plan',
      },
      {
        id: 'testimonials',
        label: 'Testimonials & reviews',
        detail: 'Approved testimonials, reviews, before/after or other customer content.',
        owner: 'social',
        task: 'Queue approved testimonials for content',
      },
      {
        id: 'social-links',
        label: 'Social media links',
        detail: 'Confirm active handles and URLs for Facebook, Instagram, TikTok, YouTube and Google Business Profile.',
        owner: 'social',
        task: 'Set every social handle and the link-in-bio merge field',
      },
    ],
  },
  {
    id: 'coordination',
    title: 'Coordination',
    items: [
      {
        id: 'poc',
        label: 'Point of contact',
        owner: 'manager',
        field: { label: 'Name, role, email, phone', placeholder: 'Jane Doe · Owner · jane@… · (555) 000-0000' },
        task: 'Add the point of contact to Contacts',
      },
      {
        id: 'approver',
        label: 'Content & ad approval',
        detail: 'Who signs off on marketing materials?',
        owner: 'manager',
        field: { label: 'Approver', placeholder: 'Name and email' },
        task: 'Set the approver on the content calendar',
      },
      {
        id: 'weekly-call',
        label: 'Weekly call',
        detail: 'A recurring 30–60 minute Google Meet.',
        owner: 'manager',
        field: { label: 'Preferred day & time', placeholder: 'e.g. Tuesdays 10:00am CT' },
        task: 'Send the recurring weekly call invite',
      },
      {
        id: 'shared-drive',
        label: 'Shared drive',
        detail: 'Upload approved logos, photos, videos and brand materials.',
        owner: 'social',
        task: 'Link the shared drive folder on the Content Tracker',
      },
      {
        id: 'ad-budget',
        label: 'Advertising budget',
        detail: 'Monthly budget for each applicable platform.',
        owner: 'ads',
        field: { label: 'Monthly budget', placeholder: 'e.g. $1,750/mo Meta' },
        task: 'Set the monthly ad budget on the client’s portal',
      },
      {
        id: 'billing',
        label: 'Ad account billing',
        detail: 'Confirm an active payment method on each advertising account.',
        owner: 'ads',
        task: 'Verify billing on every ad account',
      },
      {
        id: 'corporate',
        label: 'Corporate / franchise requirements',
        detail: 'Brand guidelines, advertising restrictions, approval processes or corporate contacts.',
        owner: 'manager',
        task: 'File corporate brand and advertising requirements',
      },
    ],
  },
];

export const RFAD_ALL_ITEMS: RfadItem[] = RFAD_SECTIONS.flatMap((s) => s.items);

export type RfadState = {
  items: Record<string, { done?: boolean; value?: string; completedAt?: string }>;
  /** Item ids already turned into follow-up tasks, so they're never doubled. */
  dispatched?: string[];
  startedAt?: string;
  completedAt?: string;
};

export const EMPTY_RFAD: RfadState = { items: {}, dispatched: [] };

export function normalizeRfad(raw: unknown): RfadState {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<RfadState>;
  return {
    items: (v.items && typeof v.items === 'object' ? v.items : {}) as RfadState['items'],
    dispatched: Array.isArray(v.dispatched) ? v.dispatched : [],
    startedAt: v.startedAt,
    completedAt: v.completedAt,
  };
}

export function rfadProgress(state: RfadState) {
  const done = RFAD_ALL_ITEMS.filter((i) => state.items[i.id]?.done).length;
  return { done, total: RFAD_ALL_ITEMS.length, pct: Math.round((done / RFAD_ALL_ITEMS.length) * 100) };
}
