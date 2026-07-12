import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Auto-discover local outreach targets near a client via Google Places
 * text search, then persist any new ones (deduped by place_id per client).
 *
 * POST { clientId, location, category }  category: 'gym' | 'urgent_care' | 'b2b'
 */

const QUERY_FOR: Record<string, string> = {
  gym: 'gyms and fitness studios',
  urgent_care: 'urgent care clinics',
  b2b: 'wellness and medical spas',
};

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can run discovery' }, { status: 403 });
  if (!PLACES_KEY) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, location, category } = body || {};
  if (!clientId || !category) return NextResponse.json({ error: 'clientId and category required' }, { status: 400 });
  const loc = (location || '').toString().trim();
  if (!loc) return NextResponse.json({ error: 'This location has no address set — add one first, then discover.' }, { status: 400 });

  const textQuery = `${QUERY_FOR[category] || category} near ${loc}`;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery, pageSize: 20 }),
  });
  const raw = await res.text();
  if (!res.ok) return NextResponse.json({ error: `Places error: ${raw.slice(0, 200)}` }, { status: 502 });
  let data: any;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad Places response' }, { status: 502 }); }

  const places: any[] = Array.isArray(data.places) ? data.places : [];
  // Existing place_ids for this client + category to avoid duplicates.
  const { rows: existing } = await query<{ place_id: string }>(
    `select place_id from market_targets where client_id = $1 and place_id is not null`,
    [clientId],
  );
  const seen = new Set(existing.map((e) => e.place_id));

  let added = 0;
  for (const p of places) {
    const placeId = p.id;
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);
    await query(
      `insert into market_targets (client_id, category, name, address, phone, place_id, maps_uri)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        clientId,
        category,
        p.displayName?.text || 'Unknown',
        p.formattedAddress || null,
        p.nationalPhoneNumber || null,
        placeId,
        p.googleMapsUri || null,
      ],
    );
    added++;
  }

  return NextResponse.json({ added, found: places.length });
}
