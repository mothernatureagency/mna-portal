import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients } from '@/lib/clients';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const clientId = req.nextUrl.searchParams.get('clientId') || '';
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

    // 1. Find projects for this client
    const { rows: projects } = await query(
      `select p.id, p.client_name from projects p where lower(p.client_name) like '%' || lower($1) || '%' limit 5`,
      [clientId.replace(/-/g, ' ')]
    );

    let posts: any[] = [];
    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const placeholders = projectIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      const { rows } = await query(
        `select post_date, platform, content_type, title, caption
         from content_calendar
         where project_id in (${placeholders})
           and post_date >= current_date - interval '3 days'
           and post_date <= current_date + interval '30 days'
         order by post_date asc
         limit 30`,
        projectIds
      );
      posts = rows;
    } else if (clientId === 'mna') {
      // Only pull all projects when viewing as MNA (agency-wide view)
      const { rows } = await query(
        `select post_date, platform, content_type, title, caption
         from content_calendar
         where post_date >= current_date - interval '3 days'
           and post_date <= current_date + interval '30 days'
         order by post_date asc
         limit 30`
      );
      posts = rows;
    }

    if (posts.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'No upcoming content found to base recommendations on.',
      });
    }

    // 2. Also load existing campaigns so AI doesn't suggest duplicates
    const { rows: existing } = clientId === 'mna'
      ? await query(`select name, campaign_type, scheduled_date, status, client_id from campaigns order by scheduled_date desc limit 30`)
      : await query(
          `select name, campaign_type, scheduled_date, status from campaigns where client_id = $1 order by scheduled_date desc limit 20`,
          [clientId]
        );

    // 3. Format context
    const calendarLines = posts.map((p: any) => {
      const parts = [`${p.post_date} | ${p.platform} | ${p.content_type || 'Post'}`];
      if (p.title) parts.push(p.title);
      if (p.caption) {
        const short = p.caption.length > 120 ? p.caption.slice(0, 120) + '...' : p.caption;
        parts.push(`Caption: ${short}`);
      }
      return '  - ' + parts.join(' — ');
    }).join('\n');

    const existingLines = existing.length > 0
      ? existing.map((c: any) => `  - [${c.campaign_type}] ${c.name} (${c.scheduled_date}, ${c.status})`).join('\n')
      : '  (none yet)';

    // Get client details for context
    const clientConfig = clients.find((c) => c.id === clientId);
    const clientName = clientConfig?.name || clientId;
    const clientIndustry = clientConfig?.industry || 'wellness';
    const isAgencyWide = clientId === 'mna';

    const prompt = `You are the Email & SMS Campaign Strategist for Mother Nature Agency.

${isAgencyWide
  ? 'You are viewing the AGENCY-WIDE content calendar across all clients. Recommend campaigns that could apply to multiple clients or suggest client-specific campaigns with the client name noted.'
  : `You are recommending campaigns specifically for ${clientName} (${clientIndustry}, ${clientConfig?.location || ''}).
IMPORTANT: All recommendations must be specifically relevant to ${clientName} and their ${clientIndustry} business. Do NOT suggest generic campaigns — tailor every recommendation to this client.`}

Here is ${isAgencyWide ? 'the agency-wide' : clientName + "'s"} upcoming social media content calendar for the next 30 days:
${calendarLines}

Here are ${isAgencyWide ? 'all' : clientName + "'s"} existing email/SMS campaigns (avoid duplicating these):
${existingLines}

Based on the content calendar, recommend 3-5 email or SMS campaigns that would complement the social content. For each recommendation, provide:

1. **type**: "email" or "sms"
2. **name**: A campaign name (e.g. "NAD+ Spring Special")
3. **suggested_date**: When to send it (YYYY-MM-DD format), timed to align with or slightly precede the social content
4. **audience**: Suggested audience segment
5. **hook**: A 1-sentence description of the angle/hook
6. **why**: Why this campaign makes sense given the content calendar

Return your answer as a JSON array. Example format:
[
  {
    "type": "email",
    "name": "Spring Hydration Push",
    "suggested_date": "2025-04-15",
    "audience": "All subscribers",
    "hook": "Kick off spring with a hydration IV special — pair with the social reel going live the same week.",
    "why": "There's a hydration-themed reel on 4/16, so an email the day before primes the audience."
  }
]

Only return the JSON array, no other text.`;

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: 'You are a marketing strategist. Return only valid JSON arrays. No markdown, no code fences, just the JSON.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Parse the JSON
    let recommendations: any[] = [];
    try {
      // Strip potential markdown fences
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      recommendations = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ recommendations: [], raw, message: 'AI returned non-JSON response' });
    }

    return NextResponse.json({ recommendations });
  } catch (err: any) {
    console.error('Recommend endpoint error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error', recommendations: [] },
      { status: 500 }
    );
  }
}
