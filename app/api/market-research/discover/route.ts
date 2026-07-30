import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Auto-discover local outreach targets near a client using OpenStreetMap —
 * Nominatim to geocode the address, Overpass to find POIs within ~15 miles.
 * Free, keyless, no billing (no Google API needed). New results are saved,
 * deduped by their OSM id per client.
 *
 * POST { clientId, location, category }  category: 'gym' | 'urgent_care' | 'b2b'
 */

const UA = 'MotherNatureAgencyPortal/1.0 (mn@mothernatureagency.com)';
const RADIUS_M = 24140; // ~15 miles

// Overpass tag filters per category (each gets the (around:…) clause appended).
const FILTERS: Record<string, string[]> = {
  gym: ['nwr[leisure=fitness_centre]', 'nwr[leisure=sports_centre]', 'nwr["sport"="fitness"]'],
  urgent_care: ['nwr[amenity=clinic]', 'nwr[healthcare=clinic]', 'nwr[amenity=doctors]', 'nwr["healthcare:speciality"~"urgent",i]'],
  ob: ['nwr["healthcare:speciality"~"gyn|obstet",i]', 'nwr[amenity=clinic]["name"~"OB|OBGYN|gynec|obstet|women",i]', 'nwr[amenity=doctors]["name"~"OB|OBGYN|gynec|obstet|women",i]'],
  surgery: ['nwr["healthcare:speciality"~"surgery",i]', 'nwr[healthcare=hospital]', 'nwr[amenity=hospital]', 'nwr["name"~"surgery|surgical",i][amenity~"clinic|doctors|hospital"]'],
  b2b: ['nwr[leisure=spa]', 'nwr[shop=massage]', 'nwr[shop=beauty]', 'nwr[amenity=spa]'],
};

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

const OVERPASS_HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

async function geocode(loc: string): Promise<{ lat: number; lon: number } | null> {
  const trimmed = loc.trim();
  // Bare ZIPs and plain city names resolve much better with ", USA" appended.
  const tries = [trimmed];
  if (!/usa|united states/i.test(trimmed)) tries.push(`${trimmed}, USA`);
  for (const q of tries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en', 'Referer': 'https://portal.mothernatureagency.com' } });
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data) && data.length) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch { /* try next */ }
  }
  return null;
}

async function overpass(ql: string): Promise<any[] | null> {
  for (const host of OVERPASS_HOSTS) {
    try {
      const r = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(ql)}`,
      });
      if (!r.ok) continue;
      const data = await r.json();
      return Array.isArray(data.elements) ? data.elements : [];
    } catch { /* try next host */ }
  }
  return null; // all endpoints failed
}

function composeAddress(tags: any): string | null {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    [tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Only staff can run discovery' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { clientId, location, category } = body || {};
  if (!clientId || !category) return NextResponse.json({ error: 'clientId and category required' }, { status: 400 });
  const loc = (location || '').toString().trim();
  if (!loc) return NextResponse.json({ error: 'Enter an address, city/state, or ZIP to search near.' }, { status: 400 });

  const geo = await geocode(loc);
  if (!geo) return NextResponse.json({ error: `Couldn't find "${loc}" on the map — try "City, State" or a ZIP.` }, { status: 400 });

  const filters = FILTERS[category] || FILTERS.b2b;
  const clauses = filters.map((f) => `${f}(around:${RADIUS_M},${geo.lat},${geo.lon});`).join('');
  const overpassQL = `[out:json][timeout:25];(${clauses});out center 80;`;

  const elements = await overpass(overpassQL);
  if (elements === null) {
    return NextResponse.json({ error: 'The map search service is busy right now — please try again in a few seconds.' }, { status: 503 });
  }

  const { rows: existing } = await query<{ place_id: string }>(
    `select place_id from market_targets where client_id = $1 and place_id is not null`,
    [clientId],
  );
  const seen = new Set(existing.map((e) => e.place_id));

  let added = 0;
  let found = 0;
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue; // skip unnamed POIs
    found++;
    const placeId = `osm_${el.type}${el.id}`;
    if (seen.has(placeId)) continue;
    seen.add(placeId);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const phone = tags.phone || tags['contact:phone'] || null;
    const mapsUri = lat && lon
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}%20${lat},${lon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + loc)}`;
    await query(
      `insert into market_targets (client_id, category, name, address, phone, place_id, maps_uri)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [clientId, category, name, composeAddress(tags), phone, placeId, mapsUri],
    );
    added++;
  }

  return NextResponse.json({ added, found });
}
