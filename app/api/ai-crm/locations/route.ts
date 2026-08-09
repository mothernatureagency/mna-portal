import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import {
  deleteLocation,
  listLocations,
  sanitizeLocation,
  upsertLocation,
} from '@/lib/ai-crm/locations';
import { audit } from '@/lib/ai-crm/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Location (tenant) management. Session-authenticated via middleware.
 * Tokens are write-only: POST accepts a plaintext `token` field which is
 * encrypted at rest; GET only ever returns has_token.
 */

export async function GET() {
  await ensureSchema();
  const locations = await listLocations();
  return NextResponse.json({ locations: locations.map(sanitizeLocation) });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id: string | null = body?.id || null;
  if (!id && (!body?.ghl_location_id || !body?.name)) {
    return NextResponse.json({ error: 'ghl_location_id and name are required' }, { status: 400 });
  }
  try {
    const loc = await upsertLocation(body, id);
    await audit({
      ghlLocationId: loc.ghl_location_id,
      event: id ? 'location_updated' : 'location_created',
      detail: { fields: Object.keys(body).filter((k) => k !== 'token'), token_updated: !!body.token },
      actor: 'staff',
    });
    return NextResponse.json({ location: sanitizeLocation(loc) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteLocation(id);
  return NextResponse.json({ ok: true });
}
