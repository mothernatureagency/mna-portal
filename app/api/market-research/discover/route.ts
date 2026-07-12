import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Auto-discover local outreach targets near a client via Google Places text
 * search, then persist any new ones (deduped by place_id per client).
 *
 * Tries the new Places API, falling back to the legacy API (same as the
 * reviews reader) so it works with whichever the project's key has enabled.
 *
 * POST { clientId, location, category }  category: 'gym' | 'urgent_care' | 'b2b'
 */

const QUERY_FOR: Record<string, string> = {
  gym: 'gyms and fitness studios',
  urgent_care: 'urgent care clinics',
  b2b: 'wellness and medical spas',
};

type Place = { id: string; name: string; address: string | null; phone: string | null; mapsUri: string | null };

async function searchNew(textQuery: string): Promise<{ ok: boolean; places?: Place[]; status?: number; body?: string }> {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery, pageSize: 20 }),
  });
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try {
    const data = JSON.parse(body);
    const places: Place[] = (data.places || []).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || 'Unknown',
      address: p.formattedAddress || null,
      phone: p.nationalPhoneNumber || null,
      mapsUri: p.googleMapsUri || null,
    }));
    return { ok: true, places };
  } catch { return { ok: false, status: r.status, body }; }
}

async function searchLegacy(textQuery: string): Promise<{ ok: boolean; places?: Place[]; status?: number; body?: string }> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${PLACES_KEY}`;
  const r = await fetch(url);
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try {
    const data = JSON.parse(body);
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { ok: false, status: r.status, body: data.error_message || data.status };
    }
    const places: Place[] = (data.results || []).map((p: any) => ({
      id: p.place_id,
      name: p.name || 'Unknown',
      address: p.formatted_address || null,
      phone: null, // legacy text search doesn't return phone
      mapsUri: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    }));
    return { ok: true, places };
  } catch { return { ok: false, status: r.status, body }; }
}

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
  if (!PLACES_KEY) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY is not set in Vercel env vars.' }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, location, category } = body || {};
  if (!clientId || !category) return NextResponse.json({ error: 'clientId and category required' }, { status: 400 });
  const loc = (location || '').toString().trim();
  if (!loc) return NextResponse.json({ error: 'Enter an address or city to search near.' }, { status: 400 });

  const textQuery = `${QUERY_FOR[category] || category} near ${loc}`;
  const a = await searchNew(textQuery);
  let result = a;
  let legacyNote = '';
  if (!a.ok) {
    const b = await searchLegacy(textQuery);
    result = b;
    if (!b.ok) legacyNote = ` · Legacy API: ${b.status} ${String(b.body).slice(0, 200)}`;
  }
  if (!result.ok) {
    return NextResponse.json({
      error: `Places lookup failed. New API: ${a.status} ${String(a.body).slice(0, 200)}${legacyNote}. Likely the API key isn't set in Vercel, or "Places API" / "Places API (New)" isn't enabled in Google Cloud, or the key is restricted.`,
    }, { status: 502 });
  }
  const places = result.places || [];

  const { rows: existing } = await query<{ place_id: string }>(
    `select place_id from market_targets where client_id = $1 and place_id is not null`,
    [clientId],
  );
  const seen = new Set(existing.map((e) => e.place_id));

  let added = 0;
  for (const p of places) {
    if (!p.id || seen.has(p.id)) continue;
    seen.add(p.id);
    await query(
      `insert into market_targets (client_id, category, name, address, phone, place_id, maps_uri)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [clientId, category, p.name, p.address, p.phone, p.id, p.mapsUri],
    );
    added++;
  }

  return NextResponse.json({ added, found: places.length });
}
