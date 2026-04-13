import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureSchema();
  const { id } = params;

  // Load campaign
  const { rows } = await query('select * from campaigns where id = $1', [id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  const campaign = rows[0];

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

Give me TWO options:

OPTION A (primary):
[message under 160 chars including "Reply STOP to opt out"]

OPTION B (different angle):
[message under 160 chars including "Reply STOP to opt out"]

Rules:
- Each option MUST be under 160 characters total
- Include a clear CTA with urgency
- No hashtags
- Sound human and warm, not spammy
- End with "Reply STOP to opt out"${guidanceBlock}`;
  } else {
    prompt = `Write a marketing email for a wellness/IV therapy client.

Campaign name: ${campaign.name}
Audience: ${campaign.audience_segment || 'All subscribers'}
Scheduled: ${campaign.scheduled_date}

Give me TWO options:

OPTION A (primary):
Subject: [under 50 chars, compelling, no clickbait]
Body: [200-400 words, conversational, single clear CTA, end with {{unsubscribe_link}}]

OPTION B (different angle):
Subject: [under 50 chars, different angle]
Body: [200-400 words, different approach, single clear CTA, end with {{unsubscribe_link}}]

Rules:
- Write like a real human, warm and on-brand
- Mobile-first: short paragraphs, scannable
- Strong opening hook
- One clear call-to-action per email
- Include {{unsubscribe_link}} at the bottom of each body${guidanceBlock}`;
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: 'You are the Email & SMS Copywriter Agent for Mother Nature Agency, a marketing agency for wellness and IV therapy clinics. You write high-converting email and SMS marketing copy. Write like a real person, not AI. Sound warm, human, and on-brand. No filler.',
    messages: [{ role: 'user', content: prompt }],
  });

  const generatedText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Save generated copy into the campaign body (and subject for email if parseable)
  let subject = campaign.subject;
  if (campaign.campaign_type === 'email') {
    const subjectMatch = generatedText.match(/Subject:\s*(.+)/i);
    if (subjectMatch) subject = subjectMatch[1].trim();
  }

  const { rows: updated } = await query(
    'update campaigns set body = $1, subject = $2 where id = $3 returning *',
    [generatedText, subject, id]
  );

  return NextResponse.json({ campaign: updated[0] });
}
