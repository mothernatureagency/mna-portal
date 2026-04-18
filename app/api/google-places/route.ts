import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Places proxy — tries the NEW Places API first, falls back to
 * the LEGACY Places API so it works whichever one the user has enabled
 * (or both). Normalizes both responses to a single shape.
 *
 * GET ?q=Prime IV Niceville FL  → candidate places list
 * GET ?placeId=ChIJ...           → single place + reviews + rating
 *
 * Requires GOOGLE_PLACES_API_KEY.
 */

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

// ─── NEW API (places.googleapis.com) ───────────────────────────────
async function searchNew(query: string) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 10 }),
  });
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try { return { ok: true, data: JSON.parse(body) }; } catch { return { ok: false, status: r.status, body }; }
}

async function detailsNew(placeId: string) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': PLACES_KEY!,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews,primaryTypeDisplayName',
    },
  });
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try { return { ok: true, data: JSON.parse(body) }; } catch { return { ok: false, status: r.status, body }; }
}

// ─── LEGACY API (maps.googleapis.com) ──────────────────────────────
async function searchLegacy(query: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}`;
  const r = await fetch(url);
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try {
    const data = JSON.parse(body);
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { ok: false, status: r.status, body: data.error_message || data.status };
    }
    return { ok: true, data };
  } catch { return { ok: false, status: r.status, body }; }
}

async function detailsLegacy(placeId: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,rating,user_ratings_total,reviews,url,types&key=${PLACES_KEY}`;
  const r = await fetch(url);
  const body = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body };
  try {
    const data = JSON.parse(body);
    if (data.status !== 'OK') {
      return { ok: false, status: r.status, body: data.error_message || data.status };
    }
    return { ok: true, data };
  } catch { return { ok: false, status: r.status, body }; }
}

// ─── Normalizers ───────────────────────────────────────────────────
function normalizeNewCandidates(raw: any): any[] {
  return (raw.places || []).map((p: any) => ({
    placeId: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    type: p.primaryTypeDisplayName?.text || '',
    rating: p.rating || 0,
    total: p.userRatingCount || 0,
    mapsUrl: p.googleMapsUri || '',
  }));
}

function normalizeLegacyCandidates(raw: any): any[] {
  return (raw.results || []).map((p: any) => ({
    placeId: p.place_id,
    name: p.name || '',
    address: p.formatted_address || '',
    type: (p.types || [])[0] || '',
    rating: p.rating || 0,
    total: p.user_ratings_total || 0,
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
  }));
}

function normalizeNewDetails(data: any) {
  const reviews = (data.reviews || []).map((rv: any) => ({
    author_name: rv.authorAttribution?.displayName || null,
    author_photo_url: rv.authorAttribution?.photoUri || null,
    rating: rv.rating || 0,
    review_text: rv.text?.text || rv.originalText?.text || null,
    review_date: rv.publishTime || null,
    google_review_id: rv.name?.split('/').pop() || null,
  }));
  return {
    placeId: data.id,
    name: data.displayName?.text || null,
    address: data.formattedAddress || null,
    type: data.primaryTypeDisplayName?.text || null,
    rating: data.rating || 0,
    total: data.userRatingCount || 0,
    mapsUrl: data.googleMapsUri || null,
    reviews,
  };
}

function normalizeLegacyDetails(data: any, placeId: string) {
  const r = data.result || {};
  const reviews = (r.reviews || []).map((rv: any, i: number) => ({
    author_name: rv.author_name || null,
    author_photo_url: rv.profile_photo_url || null,
    rating: rv.rating || 0,
    review_text: rv.text || null,
    review_date: rv.time ? new Date(rv.time * 1000).toISOString() : null,
    google_review_id: `${placeId}-${i}`,
  }));
  return {
    placeId,
    name: r.name || null,
    address: r.formatted_address || null,
    type: (r.types || [])[0] || null,
    rating: r.rating || 0,
    total: r.user_ratings_total || 0,
    mapsUrl: r.url || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    reviews,
  };
}

// ─── Route ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!PLACES_KEY) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set in Vercel env vars' }, { status: 500 });
  }
  const q = req.nextUrl.searchParams.get('q');
  const placeId = req.nextUrl.searchParams.get('placeId');

  if (placeId) {
    // Try New API first
    const a = await detailsNew(placeId);
    if (a.ok) {
      return NextResponse.json(normalizeNewDetails(a.data));
    }
    // Fall back to Legacy
    const b = await detailsLegacy(placeId);
    if (b.ok) {
      return NextResponse.json(normalizeLegacyDetails(b.data, placeId));
    }
    // Both failed — return the more informative error
    return NextResponse.json({
      error: `Both Places APIs failed. New API: ${a.status} · ${String(a.body).slice(0, 300)}. Legacy API: ${b.status} · ${String(b.body).slice(0, 300)}`,
    }, { status: 500 });
  }

  if (q) {
    const a = await searchNew(q);
    if (a.ok) {
      return NextResponse.json({ candidates: normalizeNewCandidates(a.data), source: 'new' });
    }
    const b = await searchLegacy(q);
    if (b.ok) {
      return NextResponse.json({ candidates: normalizeLegacyCandidates(b.data), source: 'legacy' });
    }
    return NextResponse.json({
      error: `Both Places search APIs failed. New: ${a.status} · ${String(a.body).slice(0, 300)}. Legacy: ${b.status} · ${String(b.body).slice(0, 300)}`,
    }, { status: 500 });
  }

  return NextResponse.json({ error: 'Pass ?q=... or ?placeId=...' }, { status: 400 });
}
