import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { type BrandKit, type BrandKitFields } from '@/lib/brand-kit';
import { resolveBrandKit } from '@/lib/brand-kit-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Brand kits.
 *
 * GET  /api/brand-kits                      -> every kit, group kits first
 * GET  /api/brand-kits?clientId=prime-iv-x  -> that client's resolved kit, plus
 *                                              the raw group/client kits behind it
 * PUT  /api/brand-kits  body: { scope, ownerKey, name?, fields }
 * DELETE /api/brand-kits?scope=&ownerKey=
 */

async function staffOnly(): Promise<string | null> {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const role = ((user.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
    return role === 'client' ? null : role;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');

  if (clientId) {
    const { fields, groupKey, sources, groupKit, clientKit } = await resolveBrandKit(clientId);
    return NextResponse.json({ resolved: { fields, groupKey, sources }, groupKit, clientKit });
  }

  const { rows } = await query<BrandKit>(
    `select * from brand_kits order by scope desc, coalesce(name, owner_key) asc`,
  );
  return NextResponse.json({ kits: rows });
}

export async function PUT(req: NextRequest) {
  await ensureSchema();
  if (!(await staffOnly())) return NextResponse.json({ error: 'Only staff can edit brand kits' }, { status: 403 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { scope, ownerKey, name, fields, groupKey } = b || {};
  if (scope !== 'group' && scope !== 'client') {
    return NextResponse.json({ error: "scope must be 'group' or 'client'" }, { status: 400 });
  }
  if (!ownerKey || typeof ownerKey !== 'string') {
    return NextResponse.json({ error: 'ownerKey required' }, { status: 400 });
  }

  const clean: BrandKitFields = fields && typeof fields === 'object' ? fields : {};
  // groupKey is only meaningful on a client kit. undefined leaves it alone;
  // an explicit null clears it back to "work it out from the id".
  const group = scope === 'client' && groupKey !== undefined
    ? (typeof groupKey === 'string' && groupKey.trim() ? groupKey.trim() : null)
    : undefined;

  const { rows } = await query<BrandKit>(
    `insert into brand_kits (scope, owner_key, name, fields, group_key)
     values ($1, $2, $3, $4::jsonb, $5)
     on conflict (scope, owner_key)
     do update set name = coalesce(excluded.name, brand_kits.name),
                   fields = excluded.fields,
                   group_key = case when $6::boolean then excluded.group_key else brand_kits.group_key end,
                   updated_at = now()
     returning *`,
    [scope, ownerKey.trim(), name || null, JSON.stringify(clean), group ?? null, group !== undefined],
  );
  return NextResponse.json({ kit: rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  if (!(await staffOnly())) return NextResponse.json({ error: 'Only staff can edit brand kits' }, { status: 403 });
  const scope = req.nextUrl.searchParams.get('scope');
  const ownerKey = req.nextUrl.searchParams.get('ownerKey');
  if (!scope || !ownerKey) return NextResponse.json({ error: 'scope + ownerKey required' }, { status: 400 });
  await query(`delete from brand_kits where scope = $1 and owner_key = $2`, [scope, ownerKey]);
  return NextResponse.json({ ok: true });
}
