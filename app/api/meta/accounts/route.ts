import { NextResponse } from 'next/server';
import { fetchAdAccounts } from '@/lib/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * List every Meta ad account the MNA token can see, for the account picker on
 * the Meta Ads dashboard. Read-only. Returns { accounts } or { error }.
 */
export async function GET() {
  try {
    const accounts = await fetchAdAccounts();
    // Active first, then by name.
    accounts.sort((a, b) => (a.status === 1 ? -1 : 1) - (b.status === 1 ? -1 : 1) || a.name.localeCompare(b.name));
    return NextResponse.json({ accounts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list ad accounts', accounts: [] }, { status: 200 });
  }
}
