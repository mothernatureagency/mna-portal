import { NextRequest, NextResponse } from 'next/server';
import { fetchLeadForms, getDefaultAdAccountId } from '@/lib/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/leads
 *
 * Scaffold for the Lead Ads retrieval flow. Today it returns the list of
 * lead gen forms visible from the ad account (empty array if the token
 * lacks pages_manage_ads or pages_read_engagement, which is the common
 * case with an ads_management-only token).
 *
 * When you upgrade the token scope, add:
 *   1. A second helper in lib/meta.ts that takes a form_id and fetches
 *      /{form_id}/leads with fields=created_time,field_data
 *   2. A query param ?formId= on this route to drill into a specific form
 */
export async function GET(req: NextRequest) {
  try {
    const adAccountId = req.nextUrl.searchParams.get('adAccountId') || getDefaultAdAccountId();
    const forms = await fetchLeadForms(adAccountId);
    return NextResponse.json({
      adAccountId,
      forms,
      note:
        forms.length === 0
          ? 'No lead forms returned. Token may need pages_manage_ads / pages_read_engagement scopes, or forms live on the Page rather than the ad account.'
          : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
