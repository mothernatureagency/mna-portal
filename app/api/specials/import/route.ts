import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { blockFromRequest } from '@/lib/specials-read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Structured import — read a specials flyer / sheet and return one object per
 * special, ready to become rows in monthly_specials.
 *
 * Nothing is written here. The staff page previews what came back, lets it be
 * edited, and posts to /api/specials — so an OCR misread never lands in front
 * of a client unseen.
 *
 * POST multipart/form-data { file, month? }
 *   OR POST application/json { driveUrl, month? }
 *
 * Returns { items: [{ name, offer, description, starts_on, ends_on, terms }], source }.
 */

function prompt(month: string | null): string {
  return `This is a business's monthly specials — the promotions, offers and packages they run for a month.

Pull out every distinct special as its own object.

For each one:
- "name": what the offer is called, short. Required.
- "offer": the price or discount exactly as written ("$50 off", "20% off", "$149", "buy 2 get 1 free"). Null if there isn't one.
- "description": any extra detail about what it includes. Null if there isn't any.
- "starts_on" / "ends_on": ISO dates (YYYY-MM-DD) if the file gives a date range${month ? `. The month is ${month}, so a bare "Oct 1-15" means ${month}-01 to ${month}-15` : ''}. Null if no dates are given — do not invent them.
- "terms": conditions like "members only", "first-time guests", "while supplies last", "Wednesdays only". Null if none.

Rules:
- Only what is actually in the file. Never invent a special, a price, or a date.
- If a value is present but unreadable, use the string "(unclear)" rather than guessing.
- A theme or awareness-month banner ("Immunity Month") is not a special — skip it.
- Return ONLY a JSON array. No prose, no markdown fences.
- If there are no specials at all, return [].`;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  if (role === 'client') return NextResponse.json({ error: 'Only staff can import specials' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // The month rides along as a query param so the multipart body stays a file.
  const month = req.nextUrl.searchParams.get('month');

  let block: Anthropic.ContentBlockParam;
  let source: string;
  try {
    ({ block, source } = await blockFromRequest(req, user.email || null));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read that file' }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: [block, { type: 'text', text: prompt(month) }] }],
    });

    if (res.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'That file could not be read. Try a different export of it.' }, { status: 422 });
    }

    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text).join('\n');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) {
      return NextResponse.json({ error: `Could not make sense of "${source}". Try a clearer copy, or add the specials by hand.` }, { status: 422 });
    }

    let raw: any;
    try { raw = JSON.parse(text.slice(start, end + 1)); } catch {
      return NextResponse.json({ error: `Could not make sense of "${source}". Try a clearer copy, or add the specials by hand.` }, { status: 422 });
    }
    if (!Array.isArray(raw)) raw = [];

    const isoOrNull = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const strOrNull = (v: unknown, max: number) => {
      const t = typeof v === 'string' ? v.trim() : '';
      return t ? t.slice(0, max) : null;
    };

    const items = raw
      .filter((r: any) => r && typeof r.name === 'string' && r.name.trim())
      .map((r: any) => ({
        name: String(r.name).trim().slice(0, 200),
        offer: strOrNull(r.offer, 120),
        description: strOrNull(r.description, 2000),
        starts_on: isoOrNull(r.starts_on),
        ends_on: isoOrNull(r.ends_on),
        terms: strOrNull(r.terms, 500),
      }));

    if (items.length === 0) {
      return NextResponse.json({
        error: `No specials found in "${source}". Check it's the right file, or add them by hand.`,
      }, { status: 422 });
    }

    return NextResponse.json({ items, source });
  } catch (e: any) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Rate limited — try again in a moment.' }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Could not read the file (${e.status}): ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: e?.message || 'Importing the specials failed' }, { status: 500 });
  }
}
