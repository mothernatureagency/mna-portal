import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live Google Places API (New) proxy — no OAuth required, just an API key.
 *
 * ── Modes ──
 * GET /api/google-places?q=Prime IV Niceville FL
 *   → Text Search: returns candidate places so user can pick the right one
 *     when there are multiple profiles on the map
 *
 * GET /api/google-places?placeId=ChIJ...
 *   → Place Details: returns rating, review count, and up to 5 reviews
 *
 * Requires GOOGLE_PLACES_API_KEY env var in Vercel.
 */

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function searchPlaces(query: string) {
  if (!PLACES_KEY) return { error: 'GOOGLE_PLACES_API_KEY not set' };
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 10 }),
  });
  if (!r.ok) {
    const errText = await r.text();
    return { error: `Places searchText failed: ${r.status} ${errText.slice(0, 200)}` };
  }
  return r.json();
}

async function placeDetails(placeId: string) {
  if (!PLACES_KEY) return { error: 'GOOGLE_PLACES_API_KEY not set' };
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews,primaryTypeDisplayName',
    },
  });
  if (!r.ok) {
    const errText = await r.text();
    return { error: `Places details failed: ${r.status} ${errText.slice(0, 200)}` };
  }
  const data = await r.json();
  // Normalize reviews to the shape used elsewhere in the app.
  const reviews = (data.reviews || []).map((rv: any) => ({
    author_name: rv.authorAttribution?.displayName || null,
    author_photo_url: rv.authorAttribution?.photoUri || null,
    rating: rv.rating || 0,
    review_text: rv.text?.text || rv.originalText?.text || null,
    review_date: rv.publishTime || null,
    relative_time: rv.relativePublishTimeDescription || null,
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const placeId = req.nextUrl.searchParams.get('placeId');

  if (placeId) {
    const res = await placeDetails(placeId);
    return NextResponse.json(res);
  }
  if (q) {
    const data: any = await searchPlaces(q);
    if (data.error) return NextResponse.json(data, { status: 500 });
    const candidates = (data.places || []).map((p: any) => ({
      placeId: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      type: p.primaryTypeDisplayName?.text || '',
      rating: p.rating || 0,
      total: p.userRatingCount || 0,
      mapsUrl: p.googleMapsUri || '',
    }));
    return NextResponse.json({ candidates });
  }

  return NextResponse.json({ error: 'Pass ?q=... or ?placeId=...' }, { status: 400 });
}
