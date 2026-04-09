/**
 * Seed VRBO Launch Checklist tasks for serenity-bayfront
 * via the /api/client-requests endpoint.
 *
 * Usage: npx tsx scripts/seed-serenity-tasks.ts
 *
 * Requires the dev server to be running (or hits the production URL).
 */

const BASE_URL = process.env.PORTAL_URL || 'http://localhost:3000';

const TASKS = [
  {
    title: 'Finalize VRBO listing copy and photos',
    description: 'Write optimized VRBO listing title, description, house rules, and upload the new photo shoot set. Ensure all photos are high-res and ordered for maximum conversion.',
  },
  {
    title: 'Set VRBO pricing calendar (May-Sep peak, shoulder, off-season rates)',
    description: 'Configure nightly rates by season: peak (May-Sep), shoulder (Mar-Apr, Oct), off-season (Nov-Feb). Add premium pricing for holiday weekends (Memorial Day, July 4th, Labor Day). Set minimum stay requirements per season.',
  },
  {
    title: 'Connect Hospitable for cross-platform sync',
    description: 'Link Airbnb and VRBO calendars through Hospitable to prevent double bookings. Set up automated pricing sync, unified inbox, and guest messaging templates.',
  },
  {
    title: 'Set up direct booking page (bypass OTA fees)',
    description: 'Create a simple direct booking landing page with availability calendar, photo gallery, and payment processing. Goal: shift 20%+ of bookings off-platform to cut 15-20% OTA commission fees.',
  },
  {
    title: 'Order professional welcome guide / house manual',
    description: 'Design and print a branded welcome guide covering house rules, WiFi info, local restaurant recommendations, beach access directions, dock usage, kayak/paddleboard instructions, and emergency contacts.',
  },
  {
    title: 'Set up automated guest messaging sequences',
    description: 'Configure Hospitable automated messages: booking confirmation, pre-arrival info (check-in details, directions), mid-stay check-in, checkout instructions, post-stay review request.',
  },
  {
    title: 'Create Google Business Profile for the property',
    description: 'Set up Google Business Profile for "Serenity on the Bay" to capture search traffic for "vacation rental freeport fl" and "bayfront rental emerald coast". Add photos, description, and link to direct booking page.',
  },
  {
    title: 'Schedule property photoshoot for hero images',
    description: 'Book professional photographer for golden hour exterior shots, drone aerials of the bayfront, interior detail shots, dock/water lifestyle shots, and seasonal decor updates. These become hero images for VRBO, Airbnb, social, and the direct booking page.',
  },
  {
    title: 'Set up Mailchimp list for past guest re-engagement',
    description: 'Create a Mailchimp audience for past and current guests. Design a welcome sequence: thank you email, review request, off-season discount offer, and seasonal newsletter with local events and property updates.',
  },
  {
    title: 'Configure Meta pixel on direct booking page',
    description: 'Install Meta pixel on the direct booking page for retargeting website visitors who viewed availability but did not book. Set up custom audiences for lookalike targeting in future Meta ad campaigns.',
  },
];

async function seed() {
  console.log(`Seeding ${TASKS.length} VRBO launch tasks for serenity-bayfront...`);
  console.log(`Target: ${BASE_URL}/api/client-requests\n`);

  for (const task of TASKS) {
    try {
      const res = await fetch(`${BASE_URL}/api/client-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'serenity-bayfront',
          title: task.title,
          description: task.description,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`  ✗ ${task.title} — ${res.status}: ${err}`);
      } else {
        const data = await res.json();
        console.log(`  ✓ ${task.title} (id: ${data.item?.id || '?'})`);
      }
    } catch (e: any) {
      console.error(`  ✗ ${task.title} — ${e.message}`);
    }
  }

  console.log('\nDone!');
}

seed();
