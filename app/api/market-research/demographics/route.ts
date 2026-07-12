import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Income + population by ZIP for ad targeting, from the free US Census ACS
 * 5-year API (median household income B19013_001E, population B01003_001E).
 * No fabricated numbers — anything the Census doesn't have comes back null.
 *
 * POST { zips: string[] }  → { areas: [{ zip, name, income, population }], sortedByIncome }
 */

async function isStaff(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const role = (user?.user_metadata as Record<string, unknown> | null)?.role as string | undefined;
    return !!user && role !== 'client';
  } catch { return false; }
}

const ACS_YEAR = 2022;
const KEY = process.env.CENSUS_API_KEY; // optional — Census allows keyless low-volume

async function fetchZip(zip: string): Promise<{ zip: string; name: string | null; income: number | null; population: number | null }> {
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=NAME,B19013_001E,B01003_001E&for=zip%20code%20tabulation%20area:${encodeURIComponent(zip)}${KEY ? `&key=${KEY}` : ''}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { zip, name: null, income: null, population: null };
    const data = await r.json();
    const row = Array.isArray(data) && data[1];
    if (!row) return { zip, name: null, income: null, population: null };
    const income = Number(row[1]);
    const population = Number(row[2]);
    return {
      zip,
      name: row[0] || `ZCTA ${zip}`,
      // Census uses large negative sentinels for "no data".
      income: Number.isFinite(income) && income >= 0 ? income : null,
      population: Number.isFinite(population) && population >= 0 ? population : null,
    };
  } catch {
    return { zip, name: null, income: null, population: null };
  }
}

export async function POST(req: NextRequest) {
  if (!(await isStaff())) return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const zips: string[] = Array.from(new Set(
    (Array.isArray(body?.zips) ? body.zips : [])
      .map((z: any) => String(z).match(/\d{5}/)?.[0])
      .filter(Boolean) as string[],
  )).slice(0, 12);

  if (zips.length === 0) return NextResponse.json({ error: 'Enter at least one 5-digit ZIP code.' }, { status: 400 });

  const areas = await Promise.all(zips.map(fetchZip));
  const sorted = [...areas].sort((a, b) => (b.income || -1) - (a.income || -1));
  return NextResponse.json({ areas: sorted, source: `US Census ACS ${ACS_YEAR} (5-year)` });
}
