import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Plain-language analytics summary for the Reports page.
 *
 * Pulls what the database actually holds for a client — entered KPIs, review
 * standing, published content volume, revenue against goal — and has Claude
 * turn it into a couple of sentences a stakeholder can read without knowing
 * what CPC means.
 *
 * The brief is deliberately encouraging: it leads with what's going well.
 * It is NOT allowed to invent numbers or claim growth the data doesn't show —
 * when a metric is flat or missing it stays quiet about it rather than
 * dressing it up.
 *
 * GET ?clientId=prime-iv
 */

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthsBack(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return ymOf(d);
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId') || '';
  const clientName = req.nextUrl.searchParams.get('clientName') || clientId;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const thisYm = ymOf(new Date());
  const lastYm = monthsBack(1);
  const priorYm = monthsBack(2);

  // ── Gather ────────────────────────────────────────────────
  const [kpis, reviews, content, stats] = await Promise.all([
    query<{ metric: string; year_month: string; value: string }>(
      `select metric, year_month, value from kpi_entries
        where client_id = $1 and year_month = any($2::text[])
        order by year_month desc`,
      [clientId, [thisYm, lastYm, priorYm]],
    ).catch(() => ({ rows: [] as any[] })),

    query<{ total: string; avg_rating: string; last_30d: string }>(
      `select count(*)::text as total,
              coalesce(round(avg(rating)::numeric, 2), 0)::text as avg_rating,
              count(*) filter (where review_date >= now() - interval '30 days')::text as last_30d
         from google_reviews where client_id = $1`,
      [clientId],
    ).catch(() => ({ rows: [] as any[] })),

    query<{ published: string; upcoming: string }>(
      `select count(*) filter (where cc.post_date <= current_date)::text as published,
              count(*) filter (where cc.post_date > current_date)::text as upcoming
         from content_calendar cc join projects p on p.id = cc.project_id
        where p.client_name = $1
          and cc.post_date >= current_date - interval '90 days'`,
      [clientName],
    ).catch(() => ({ rows: [] as any[] })),

    query<{ value: any }>(
      `select value from client_kv where client_id = $1 and key = 'overview_stats'`,
      [clientId],
    ).catch(() => ({ rows: [] as any[] })),
  ]);

  const byMonth: Record<string, Record<string, number>> = {};
  for (const r of kpis.rows) {
    (byMonth[r.year_month] ||= {})[r.metric] = Number(r.value);
  }

  const rev = reviews.rows[0];
  const con = content.rows[0];
  const overview = stats.rows[0]?.value || {};
  const revenueRows: any[] = Array.isArray(overview?.revenue) ? overview.revenue : [];
  const revenueGoal = typeof overview?.revenueGoal === 'number' ? overview.revenueGoal : null;

  const facts = {
    client: clientName,
    months: byMonth,
    reviews: rev ? { total: Number(rev.total), rating: Number(rev.avg_rating), last30d: Number(rev.last_30d) } : null,
    content: con ? { publishedLast90d: Number(con.published), scheduledAhead: Number(con.upcoming) } : null,
    revenue: revenueRows.slice(-3),
    revenueGoal,
  };

  const hasAnything =
    Object.keys(byMonth).length > 0 ||
    (facts.reviews?.total || 0) > 0 ||
    (facts.content?.publishedLast90d || 0) > 0 ||
    revenueRows.length > 0;

  if (!hasAnything) {
    return NextResponse.json({
      summary: `We don't have enough recorded data for ${clientName} yet to summarize. Once KPIs, reviews or published content start landing, this brief fills in automatically.`,
      highlights: [],
      facts,
      generated: false,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ summary: '', highlights: [], facts, generated: false });

  const anthropic = new Anthropic({ apiKey });
  const prompt = `Write a short performance brief for a business owner who does not read marketing dashboards.

CLIENT: ${clientName}

DATA (the only numbers you may use — anything absent simply isn't known):
${JSON.stringify(facts, null, 2)}

Rules:
- 2-3 sentences, plain English. No jargon: say "cost per click" not CPC, "people who saw the ad" not impressions.
- Lead with what is genuinely going well. Keep the tone encouraging.
- Never invent a number, a trend, or a comparison that isn't in the data above.
- If something is flat or missing, just don't mention it. Do not spin it, and do not
  point out weaknesses — this brief is the positive summary only.
- Refer to real figures where you have them, rounded sensibly.

Return STRICT JSON only:
{
  "summary": "the 2-3 sentence brief",
  "highlights": [
    { "label": "short metric name", "value": "the figure", "note": "6-10 words on why it's good" }
  ]
}

Return 2-4 highlights, only for metrics actually present. No commentary outside the JSON.`;

  try {
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text).join('').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch {
      const a = text.indexOf('{'), b = text.lastIndexOf('}');
      parsed = a >= 0 && b > a ? JSON.parse(text.slice(a, b + 1)) : {};
    }

    return NextResponse.json({
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : [],
      facts,
      generated: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Summary failed';
    return NextResponse.json({ summary: '', highlights: [], facts, generated: false, error: msg });
  }
}
