import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

/** Fetch upcoming content calendar items for the client to give AI context */
async function getContentContext(clientId: string): Promise<string> {
  // Find the project(s) for this client
  const { rows: projects } = await query(
    `select p.id, p.client_name from projects p where lower(p.client_name) like '%' || lower($1) || '%' limit 5`,
    [clientId.replace(/-/g, ' ')]
  );
  if (projects.length === 0) {
    // Try direct match with client_name containing the id
    const { rows: p2 } = await query(`select id, client_name from projects limit 10`);
    // Fallback: just grab posts from the last/next 30 days across all projects
    const { rows: posts } = await query(
      `select post_date, platform, content_type, title, caption
       from content_calendar
       where post_date >= current_date - interval '7 days'
         and post_date <= current_date + interval '30 days'
       order by post_date asc
       limit 20`
    );
    if (posts.length === 0) return '';
    return formatContentContext(posts);
  }

  const projectIds = projects.map((p: any) => p.id);
  const placeholders = projectIds.map((_: any, i: number) => `$${i + 1}`).join(',');
  const { rows: posts } = await query(
    `select post_date, platform, content_type, title, caption
     from content_calendar
     where project_id in (${placeholders})
       and post_date >= current_date - interval '7 days'
       and post_date <= current_date + interval '30 days'
     order by post_date asc
     limit 20`,
    projectIds
  );
  if (posts.length === 0) return '';
  return formatContentContext(posts);
}

function formatContentContext(posts: any[]): string {
  const lines = posts.map((p: any) => {
    const parts = [`${p.post_date} | ${p.platform} | ${p.content_type || 'Post'}`];
    if (p.title) parts.push(p.title);
    if (p.caption) {
      // Truncate caption to keep context reasonable
      const short = p.caption.length > 150 ? p.caption.slice(0, 150) + '...' : p.caption;
      parts.push(`Caption: ${short}`);
    }
    return '  - ' + parts.join(' — ');
  });
  return `\n\nHere is the upcoming social media content calendar for this client. Use it to align the email/SMS messaging with what's being posted:\n${lines.join('\n')}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const { id } = params;

  // Load campaign
  const { rows } = await query('select * from campaigns where id = $1', [id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  const campaign = rows[0];

  // Fetch content calendar context
  const contentContext = await getContentContext(campaign.client_id);

  // Get client links
  const clientConfig = clients.find((c) => c.id === campaign.client_id);
  const links = clientConfig?.links;
  const linksBlock = links
    ? `\n\nClient links (use the most appropriate one as the CTA link):
- Website: ${links.website || 'N/A'}
- Linktree: ${links.linktree || 'N/A'}
- Booking: ${links.booking || 'N/A'}
- Instagram: ${links.instagram || 'N/A'}
- Facebook: ${links.facebook || 'N/A'}`
    : '';

  // Optional guidance for redo
  let guidance = '';
  try {
    const body = await req.json();
    if (body?.guidance) guidance = body.guidance;
  } catch {
    // No body or invalid JSON — fine
  }

  const guidanceBlock = guidance
    ? `\n\nIMPORTANT — the team is redoing this copy. Here are their notes on what to change:\n"${guidance}"\nPlease follow these notes closely while still keeping the copy polished and ready to send.`
    : '';

  let prompt: string;

  if (campaign.campaign_type === 'sms') {
    prompt = `Write an SMS marketing message for a wellness/IV therapy client.

Campaign name: ${campaign.name}
Audience: ${campaign.audience_segment || 'All subscribers'}
Scheduled: ${campaign.scheduled_date}
${contentContext}${linksBlock}

Give me TWO versions:

MEMBER COPY (for existing members/patients):
[message under 160 chars including "Reply STOP to opt out"]

NON-MEMBER COPY (for leads/prospects who haven't visited yet):
[message under 160 chars including "Reply STOP to opt out"]

Rules:
- Each version MUST be under 160 characters total
- MEMBER copy should feel personal, reward loyalty, reference "your next visit" or exclusive perks
- NON-MEMBER copy should spark curiosity, highlight a first-timer offer or intro deal
- Include a clear CTA with urgency
- No hashtags
- Avoid hyphens and dashes — use commas or periods instead
- Sound human and warm, not spammy
- End with "Reply STOP to opt out"
- Reference or complement the social content themes when relevant${guidanceBlock}`;
  } else {
    prompt = `Write a marketing email for a wellness/IV therapy client.

Campaign name: ${campaign.name}
Audience: ${campaign.audience_segment || 'All subscribers'}
Scheduled: ${campaign.scheduled_date}
${contentContext}${linksBlock}

Give me TWO options:

OPTION A (primary):
Subject: [under 50 chars, compelling, no clickbait]
Body: [200-400 words, conversational, single clear CTA, end with {{unsubscribe_link}}]

OPTION B (different angle):
Subject: [under 50 chars, different angle]
Body: [200-400 words, different approach, single clear CTA, end with {{unsubscribe_link}}]

Rules:
- Write like a real human, warm and on-brand
- NO emojis anywhere — not in subject lines, not in body text
- Avoid hyphens and dashes — use commas or periods instead
- Mobile-first: short paragraphs, scannable
- Strong opening hook
- One clear call-to-action per email
- Include {{unsubscribe_link}} at the bottom of each body
- Align messaging with the social content themes when relevant (reference promotions, topics, or hooks from the calendar)${guidanceBlock}`;
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: 'You are the Email & SMS Copywriter Agent for Mother Nature Agency, a marketing agency for wellness and IV therapy clinics. You write high-converting email and SMS marketing copy. You have access to the client\'s social media content calendar so you can align messaging across channels. Write like a real person, not AI. Sound warm, human, and on-brand. No filler.',
    messages: [{ role: 'user', content: prompt }],
  });

  const generatedText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Save generated copy into the campaign body (and subject for email if parseable)
  let subject = campaign.subject;
  if (campaign.campaign_type === 'email') {
    // Look up client name for the subject line
    let clientName = campaign.client_id;
    const { rows: clientProjects } = await query(
      `select client_name from projects where lower(client_name) like '%' || lower($1) || '%' limit 1`,
      [campaign.client_id.replace(/-/g, ' ')]
    );
    if (clientProjects.length > 0) clientName = clientProjects[0].client_name;

    // Format date as "Month Day, Year"
    const d = new Date(campaign.scheduled_date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    subject = `Weekly Wrap-Up: MNA X ${clientName} ${dateStr}`;
  }

  const { rows: updated } = await query(
    'update campaigns set body = $1, subject = $2 where id = $3 returning *',
    [generatedText, subject, id]
  );

  return NextResponse.json({ campaign: updated[0] });
}
