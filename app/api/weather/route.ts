import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Current weather for Mother's spoken briefing (and the HUD chip).
 *
 * GET /api/weather?lat=..&lon=..  → { tempF, desc, high, low }
 *
 * Uses Open-Meteo — free, no API key. The browser passes the user's
 * coordinates when geolocation is granted; otherwise we fall back to the
 * agency's home turf (Niceville, FL — override with WEATHER_DEFAULT_LAT /
 * WEATHER_DEFAULT_LON in env). Responses are cached in memory for 10
 * minutes per rounded location so the briefing never hammers the API.
 */

const DEFAULT_LAT = Number(process.env.WEATHER_DEFAULT_LAT) || 30.5169;
const DEFAULT_LON = Number(process.env.WEATHER_DEFAULT_LON) || -86.4822;

// WMO weather codes → something worth saying out loud.
function describe(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzling';
  if (code >= 61 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mild';
}

type Cached = { at: number; data: { tempF: number; desc: string; high: number; low: number } };
const cache = new Map<string, Cached>();
const TTL_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  const useLat = Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : DEFAULT_LAT;
  const useLon = Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : DEFAULT_LON;

  const key = `${useLat.toFixed(1)},${useLon.toFixed(1)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.data);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLon}`
      + `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min`
      + `&temperature_unit=fahrenheit&forecast_days=1&timezone=auto`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`weather ${r.status}`);
    const j: any = await r.json();
    const data = {
      tempF: Number(j?.current?.temperature_2m ?? 0),
      desc: describe(Number(j?.current?.weather_code ?? -1)),
      high: Number(j?.daily?.temperature_2m_max?.[0] ?? 0),
      low: Number(j?.daily?.temperature_2m_min?.[0] ?? 0),
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'weather unavailable' }, { status: 502 });
  }
}
