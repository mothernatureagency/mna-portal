import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';
import { createClient } from '@/lib/supabase/server';
import { clients as staticClients } from '@/lib/clients';
import { autoPickDates } from '@/lib/plan-month-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * AI month planner — turns the month's specials into a proposed content plan.
 *
 * POST {
 *   clientName, clientId?, month: 'YYYY-MM', specials,
 *   postsPerWeek?: number,      // used when no days are hand-picked (default 3)
 *   selectedDays?: string[],    // explicit YYYY-MM-DD dates to post on
 *   research?: boolean,         // pull the client website + past posts for ideas
 * }
 *
 * Plans AROUND existing posts: dates that already have a post are avoided in
 * auto-scheduling, and existing topics are passed to the model so the new plan
 * complements instead of duplicating. Returns { items } for preview — nothing
 * is inserted here; the UI bulk-inserts via POST /api/content-calendar after
 * the staff member confirms.
 */

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

// autoPickDates now lives in lib/plan-month-shared.ts so plan-month-photos
// (the photo-based planner) schedules identically without duplicating it.

// Fetch a web page and reduce it to plain text for prompt context.
async function fetchSiteText(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MNA-Portal)' } });
    clearTimeout(t);
    if (!r.ok) return '';
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can plan the month' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const clientName = (body?.clientName || '').toString();
  const clientId = (body?.clientId || '').toString();
  const month = (body?.month || '').toString();
  const specials = (body?.specials || '').toString().trim();
  const postsPerWeek = Math.min(7, Math.max(1, Number(body?.postsPerWeek) || 3));
  const selectedDays: string[] = Array.isArray(body?.selectedDays)
    ? body.selectedDays.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(month))
    : [];
  const research = body?.research === true;

  if (!clientName || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'clientName and month (YYYY-MM) required' }, { status: 400 });
  }
  if (!specials && !research) {
    return NextResponse.json({ error: 'Enter the specials for the month (or turn on website/past-post research).' }, { status: 400 });
  }

  // Existing posts that month — plan around them.
  const { rows: existing } = await query<{ post_date: string; title: string | null; platform: string }>(
    `select to_char(cc.post_date, 'YYYY-MM-DD') as post_date, cc.title, cc.platform
       from content_calendar cc join projects p on p.id = cc.project_id
      where p.client_name = $1 and to_char(cc.post_date, 'YYYY-MM') = $2
      order by cc.post_date asc`,
    [clientName, month],
  );
  const takenDates = new Set(existing.map((e) => e.post_date));

  const targets = selectedDays.length > 0
    ? Array.from(new Set(selectedDays)).sort()
    : autoPickDates(month, postsPerWeek, takenDates);
  if (targets.length === 0) {
    return NextResponse.json({ error: 'No open days left to plan in that month — pick days manually or choose another month.' }, { status: 400 });
  }

  // Optional research: client website + recent past posts.
  let researchBlock = '';
  if (research) {
    const websiteUrl = (body?.websiteUrl || '').toString().trim()
      || staticClients.find((c) => c.name === clientName)?.links?.website
      || '';
    let siteText = '';
    if (websiteUrl) siteText = await fetchSiteText(websiteUrl);
    // Merge-vars website as a fallback source.
    if (!siteText && clientId) {
      const { rows: mv } = await query<{ value: any }>(
        `select value from client_kv where client_id = $1 and key = 'merge_vars'`, [clientId],
      );
      const mvWebsite = mv[0]?.value && typeof mv[0].value === 'object' ? (mv[0].value.website || '') : '';
      if (mvWebsite) siteText = await fetchSiteText(String(mvWebsite));
    }
    const { rows: past } = await query<{ post_date: string; title: string | null; caption: string | null }>(
      `select to_char(cc.post_date, 'YYYY-MM-DD') as post_date, cc.title, cc.caption
         from content_calendar cc join projects p on p.id = cc.project_id
        where p.client_name = $1 and to_char(cc.post_date, 'YYYY-MM') < $2
        order by cc.post_date desc limit 30`,
      [clientName, month],
    );
    const pastLines = past.map((p) => `- ${p.post_date}: ${(p.title || '').slice(0, 120)}${p.caption ? ` | ${p.caption.replace(/\s+/g, ' ').slice(0, 100)}` : ''}`);
    researchBlock = [
      siteText ? `WEBSITE CONTENT (services/offers to draw ideas from):\n${siteText}` : '',
      pastLines.length ? `PAST POSTS (avoid repeating; reuse what worked with fresh angles):\n${pastLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  }

  const agent = getAgent('social-media');
  if (!agent) return NextResponse.json({ error: 'Agent missing' }, { status: 500 });
  const anthropic = new Anthropic({ apiKey });

  const userPrompt = `Plan a month of social content for ${clientName}.

MONTH: ${month}

SPECIALS / PROMOS THIS MONTH (from the owner):
${specials || '(none given — use the research below to propose content)'}

TARGET DATES — create exactly ONE post per date (${targets.length} total):
${targets.join(', ')}

${existing.length > 0
    ? `POSTS ALREADY ON THE CALENDAR — plan around these, do not duplicate their topics:\n${existing.map((e) => `- ${e.post_date} (${e.platform}): ${(e.title || '').slice(0, 120)}`).join('\n')}`
    : 'The calendar is empty this month.'}
${researchBlock ? `\n${researchBlock}\n` : ''}
INSTRUCTIONS:
- Break each special down across the month: an announcement early, a reminder mid-run, and a last-chance push near the end of the month or offer.
- Mix in non-promo posts (education, tips, social proof, behind-the-scenes) so roughly half the plan is value content, not sales.
- platform: use "Meta" for standard posts (publishes to Facebook + Instagram together); use "Instagram" only for Reels.
- content_type: one of "Post", "Reel", "Carousel", "Story".
- phase: a 1-2 word bucket like "Promo", "Education", "Social Proof".
- Captions: write like a real person, not AI — natural and conversational, no generic filler, hyphens/em dashes at most once per caption, 3-5 relevant hashtags at the end. You may use merge tags {{location}}, {{booking}}, {{linktree}} where a link or location name belongs.

Return ONLY a JSON array (no prose, no markdown fences), one object per target date, in date order:
[{"date":"YYYY-MM-DD","platform":"Meta","content_type":"Post","phase":"Promo","title":"...","hook":"...","cta":"...","caption":"..."}]`;

  try {
    const res = await anthropic.messages.create({
      model: agent.model,
      max_tokens: 8000,
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error('The AI did not return a valid plan — try again.');
    const raw = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(raw)) throw new Error('The AI did not return a valid plan — try again.');

    const items = raw
      .filter((p: any) => p && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
      .map((p: any) => {
        const title = (p.title || 'Untitled').toString().slice(0, 200);
        const hook = (p.hook || '').toString().slice(0, 300);
        const cta = (p.cta || '').toString().slice(0, 200);
        const phase = (p.phase || 'Promo').toString().slice(0, 30);
        // Match the calendar's title convention so hook/CTA render in the UI.
        const fullTitle = `[${phase}] ${title}${hook ? ` — Hook: ${hook}` : ''}${cta ? ` | CTA: ${cta}` : ''}`;
        return {
          post_date: p.date,
          platform: ['Instagram', 'Facebook', 'Meta', 'TikTok', 'LinkedIn', 'YouTube', 'Pinterest', 'X/Twitter'].includes(p.platform) ? p.platform : 'Meta',
          content_type: ['Reel', 'Carousel', 'Post', 'Story', 'Live', 'Short', 'Video', 'Pin'].includes(p.content_type) ? p.content_type : 'Post',
          title: fullTitle,
          caption: (p.caption || '').toString().slice(0, 4000) || null,
          status: 'Draft',
          assigned_role: 'Social Media Manager',
        };
      });
    if (items.length === 0) throw new Error('The AI plan came back empty — try again.');
    return NextResponse.json({ items, targetDates: targets, existingCount: existing.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Planning failed' }, { status: 500 });
  }
}
