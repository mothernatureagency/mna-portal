import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';
import { createClient } from '@/lib/supabase/server';
import { fetchDriveFileBytes } from '@/lib/google-drive';
import { normalizeMime, contentBlockFor } from '@/lib/specials-read';
import { uploadPublicMedia } from '@/lib/media-store';
import { autoPickDates } from '@/lib/plan-month-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PHOTOS = 20;
const CONCURRENCY = 4;

/**
 * AI month planner — photo edition. Instead of typed specials, staff pick
 * photos out of the client's Drive folder and each photo becomes one post,
 * spread across the month the same way plan-month spreads text posts.
 *
 * POST {
 *   clientName, clientId?, month: 'YYYY-MM',
 *   files: [{ id, name?, mimeType? }],   // Drive file ids, in the order picked
 *   specials?: string,                   // optional context, mentioned only where it fits
 *   postsPerWeek?: number,
 *   selectedDays?: string[],
 * }
 *
 * Each photo is mirrored into Supabase Storage (so it's actually publishable,
 * not just a Drive preview link) and handed to Claude as a vision block so
 * the caption is grounded in what the photo actually shows. Returns the same
 * { items, targetDates, existingCount } shape as plan-month so the existing
 * preview/confirm UI needs no special-casing.
 */

type PickedFile = { id: string; name?: string; mimeType?: string };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  if (!role) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (role === 'client') return NextResponse.json({ error: 'Only staff can plan the month' }, { status: 403 });

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
  const files: PickedFile[] = Array.isArray(body?.files)
    ? body.files.filter((f: any) => f && typeof f.id === 'string').slice(0, MAX_PHOTOS)
    : [];
  void clientId;

  if (!clientName || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'clientName and month (YYYY-MM) required' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'Select at least one photo from the Drive folder.' }, { status: 400 });
  }

  // Existing posts that month — plan around them, same as the text planner.
  const { rows: existing } = await query<{ post_date: string; title: string | null; platform: string }>(
    `select to_char(cc.post_date, 'YYYY-MM-DD') as post_date, cc.title, cc.platform
       from content_calendar cc join projects p on p.id = cc.project_id
      where p.client_name = $1 and to_char(cc.post_date, 'YYYY-MM') = $2
      order by cc.post_date asc`,
    [clientName, month],
  );
  const takenDates = new Set(existing.map((e) => e.post_date));

  const rawTargets = selectedDays.length > 0
    ? Array.from(new Set(selectedDays)).sort()
    : autoPickDates(month, postsPerWeek, takenDates);
  if (rawTargets.length === 0) {
    return NextResponse.json({ error: 'No open days left to plan in that month — pick days manually or choose another month.' }, { status: 400 });
  }

  // One post per photo — pair each selected photo (in the order it was
  // picked) with the next open date. Extra photos beyond the open dates are
  // simply left for next time.
  const n = Math.min(rawTargets.length, files.length);
  const targets = rawTargets.slice(0, n);
  const picked = files.slice(0, n);

  const agent = getAgent('social-media');
  if (!agent) return NextResponse.json({ error: 'Agent missing' }, { status: 500 });
  const anthropic = new Anthropic({ apiKey });
  const userEmail = user?.email || null;

  const existingLines = existing.map((e) => `- ${e.post_date} (${e.platform}): ${(e.title || '').slice(0, 120)}`).join('\n');
  const VALID_PLATFORMS = ['Instagram', 'Facebook', 'Meta', 'TikTok', 'LinkedIn', 'YouTube', 'Pinterest', 'X/Twitter'];
  const VALID_TYPES = ['Reel', 'Carousel', 'Post', 'Story', 'Live', 'Short', 'Video', 'Pin'];

  const outcomes = await mapLimit(picked, CONCURRENCY, async (file, i) => {
    const date = targets[i];
    const label = file.name || 'A photo';
    try {
      const { name, mimeType, bytes } = await fetchDriveFileBytes(userEmail, file.id);
      const mime = normalizeMime(mimeType, name || file.name || 'photo');
      let block;
      try {
        block = contentBlockFor(mime, bytes, name || label);
      } catch (e: any) {
        return { error: `${label}: ${e.message}` };
      }
      if (block.type !== 'image') {
        return { error: `${label} isn't an image — only photos can be planned this way right now.` };
      }

      const mirroredUrl = await uploadPublicMedia(bytes, mime, { prefix: 'drive' });

      const userPrompt = `Write ONE social post for ${clientName} built around the attached photo.

MONTH: ${month}
POST DATE: ${date}

${specials ? `SPECIALS / PROMOS THIS MONTH (mention only if it actually fits this photo):\n${specials}\n` : ''}${existingLines ? `POSTS ALREADY ON THE CALENDAR THIS MONTH — don't repeat their topics:\n${existingLines}\n` : ''}
INSTRUCTIONS:
- Look at the photo and write a caption grounded in what's actually shown — don't invent details that aren't visible in it.
- platform: "Meta" for a standard post (publishes to Facebook + Instagram together); use "Instagram" only if this really reads as a Reel-style clip.
- content_type: one of "Post", "Reel", "Carousel", "Story" — use "Post" unless the photo clearly calls for another format.
- phase: a 1-2 word bucket like "Promo", "Education", "Social Proof", "Behind the Scenes".
- Caption: write like a real person, not AI — natural and conversational, no generic filler, hyphens/em dashes at most once, 3-5 relevant hashtags at the end. You may use merge tags {{location}}, {{booking}}, {{linktree}} where a link or location name belongs.

Return ONLY a JSON object (no prose, no markdown fences):
{"platform":"Meta","content_type":"Post","phase":"...","title":"...","hook":"...","cta":"...","caption":"..."}`;

      const res = await anthropic.messages.create({
        model: agent.model,
        max_tokens: 1500,
        system: agent.systemPrompt,
        messages: [{ role: 'user', content: [block, { type: 'text', text: userPrompt }] }],
      });
      const text = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return { error: `${label}: the AI did not return a valid caption.` };
      const p = JSON.parse(text.slice(start, end + 1));

      const title = (p.title || 'Untitled').toString().slice(0, 200);
      const hook = (p.hook || '').toString().slice(0, 300);
      const cta = (p.cta || '').toString().slice(0, 200);
      const phase = (p.phase || 'Promo').toString().slice(0, 30);
      const fullTitle = `[${phase}] ${title}${hook ? ` — Hook: ${hook}` : ''}${cta ? ` | CTA: ${cta}` : ''}`;

      return {
        item: {
          post_date: date,
          platform: VALID_PLATFORMS.includes(p.platform) ? p.platform : 'Meta',
          content_type: VALID_TYPES.includes(p.content_type) ? p.content_type : 'Post',
          title: fullTitle,
          caption: (p.caption || '').toString().slice(0, 4000) || null,
          status: 'Draft',
          assigned_role: 'Social Media Manager',
          photo_urls: [mirroredUrl],
          photo_drive_url: mirroredUrl,
        },
      };
    } catch (e: any) {
      return { error: `${label}: ${e?.message || 'failed'}` };
    }
  });

  const items = outcomes
    .filter((o): o is { item: any } => !!o && 'item' in o)
    .map((o) => o.item)
    .sort((a, b) => a.post_date.localeCompare(b.post_date));
  const skipped = outcomes
    .filter((o): o is { error: string } => !!o && 'error' in o)
    .map((o) => o.error);

  if (items.length === 0) {
    return NextResponse.json({ error: skipped[0] || 'Could not plan any of the selected photos — try again.' }, { status: 500 });
  }

  return NextResponse.json({ items, targetDates: targets, existingCount: existing.length, skipped });
}
