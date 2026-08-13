import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients, makeCustomClient, type Client } from '@/lib/clients';
import { getPortalAuth, canAccessClient } from '@/lib/portal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/client/content-ideas
 * body: { clientId, focus? }
 *
 * Generates a content-creation batch for the portal's Content Studio tab:
 * post ideas, TikTok concepts, and shot-list suggestions, grounded in the
 * client's industry, notes, links, and existing idea bank. The client (or
 * staff previewing) saves the ones they like via /api/content-concepts and
 * /api/shot-list — nothing is persisted here.
 */

async function resolveClient(clientId: string): Promise<Client | null> {
  const s = staticClients.find((c) => c.id === clientId);
  if (s) return s;
  try {
    const { rows } = await query<any>(
      `select id, name, short_name, location, logo_url, industry, brand_from, brand_to, notes
         from custom_clients where id = $1`,
      [clientId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return makeCustomClient({
      id: r.id, name: r.name, shortName: r.short_name, location: r.location,
      logoUrl: r.logo_url, industry: r.industry, brandFrom: r.brand_from, brandTo: r.brand_to, notes: r.notes,
    });
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  await ensureSchema();
  const auth = await getPortalAuth();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, focus } = b || {};
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  if (!canAccessClient(auth, clientId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = await resolveClient(clientId);
  if (!client) return NextResponse.json({ error: 'Unknown client' }, { status: 404 });

  // Ground the generation in what already exists so ideas stay fresh.
  const { rows: concepts } = await query<{ title: string }>(
    `select title from content_concepts where client_id = $1 order by created_at desc limit 25`,
    [clientId],
  );
  const { rows: shots } = await query<{ title: string }>(
    `select title from shot_list_items where client_id = $1 order by created_at desc limit 25`,
    [clientId],
  );
  const kv = await query<{ value: any }>(
    `select value from client_kv where client_id = $1 and key = 'tiktok_handle'`,
    [clientId],
  );
  const tiktokHandle = typeof kv.rows[0]?.value === 'string' ? kv.rows[0].value : kv.rows[0]?.value?.handle;

  const links = client.links
    ? Object.entries(client.links).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
    : '';

  const prompt = `You are the content strategist at Mother Nature Agency planning shootable, platform-native social content for a client.

CLIENT: ${client.name}
INDUSTRY: ${client.industry}
${client.location ? `LOCATION: ${client.location}\n` : ''}${links ? `LINKS: ${links}\n` : ''}${tiktokHandle ? `TIKTOK: @${tiktokHandle}\n` : ''}ABOUT: ${client.notes || 'n/a'}
${focus ? `\nTHIS BATCH SHOULD FOCUS ON: ${focus}\n` : ''}
IDEAS ALREADY IN THE BANK (do not repeat these): ${concepts.map((c) => c.title).join('; ') || 'none yet'}
SHOTS ALREADY LISTED (do not repeat these): ${shots.map((s) => s.title).join('; ') || 'none yet'}

Return STRICT JSON only, no markdown, exactly this shape:
{
  "postIdeas": [
    { "title": "short idea name", "hook": "scroll-stopping first line", "caption": "1-2 sentence caption draft", "format": "reel | carousel | photo | story", "platform": "instagram | facebook | both" }
  ],
  "tiktokIdeas": [
    { "title": "short concept name", "hook": "first-2-second spoken/visual hook", "format": "talking head | b-roll + text | POV | tutorial | trend audio | day-in-the-life", "sound": "audio suggestion or 'trending audio of the week'", "hashtags": ["3-5 fitting hashtags"] }
  ],
  "shotList": [
    { "title": "concrete shot to capture", "description": "what to film/photograph and how (angle, lighting, action)", "shotType": "b-roll | talking head | product | testimonial | behind the scenes | before-after", "platform": "tiktok | instagram | any", "priority": "high | medium | low" }
  ]
}

Rules: 5-6 postIdeas, 5-6 tiktokIdeas, 6-8 shotList items. Every shot must be capturable by the client's own team with a phone in a normal week at their business. Shot list items should supply the raw footage the post and TikTok ideas need. Be specific to this business and location — no generic filler.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    if ((res as any).stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Generation was declined — try adjusting the focus.' }, { status: 502 });
    }
    const text = res.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'No JSON in AI output' }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      postIdeas: Array.isArray(parsed.postIdeas) ? parsed.postIdeas : [],
      tiktokIdeas: Array.isArray(parsed.tiktokIdeas) ? parsed.tiktokIdeas : [],
      shotList: Array.isArray(parsed.shotList) ? parsed.shotList : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Idea generation failed' }, { status: 500 });
  }
}
