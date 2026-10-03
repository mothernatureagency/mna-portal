import { NextRequest, NextResponse } from 'next/server';
import { identityForSession } from '@/lib/mcp/local';
import { query } from '@/lib/db';
import { cleanText, requireMonth, OPERATIONS_ROLES } from '@/lib/operations/policy';
import { ensureOperations, requireClient, getPlan, snapshot, addHandoff, requestInfo } from '@/lib/operations/store';
import { providerReadiness, runMonthly } from '@/lib/operations/runner';
import { publicHttpsUrl } from '@/lib/campaign-checks';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function GET(req: NextRequest) {
  const identity = await identityForSession();
  if (!identity) return NextResponse.json({error:'Staff sign-in required'},{status:403});
  try {
    const client = await requireClient(req.nextUrl.searchParams.get('clientId'),identity);
    const month = requireMonth(req.nextUrl.searchParams.get('month'));
    return NextResponse.json({client,month,roles:OPERATIONS_ROLES,providers:providerReadiness(),plan:await getPlan(client.id,month),...await snapshot(client.id,month)});
  } catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : 'Could not load operations'},{status:400}); }
}
export async function POST(req: NextRequest) {
  const identity = await identityForSession();
  if (!identity) return NextResponse.json({error:'Staff sign-in required'},{status:403});
  try {
    const body = await req.json();
    const client = await requireClient(body.clientId,identity);
    const month = requireMonth(body.month);
    await ensureOperations();
    if (body.action === 'save_plan') {
      const p = body.plan;
      const plan = { source:cleanText(p.source,500,'Plan source',false),text:cleanText(p.text,10000,'Diamond plan',false),
        bookingUrl:cleanText(p.bookingUrl,1000,'Booking URL',false),address:cleanText(p.address,500,'Mailing address',false),
        fpEmail:cleanText(p.fpEmail,254,'Franchise partner email',false),sendDate:cleanText(p.sendDate,10,'Send date',false) };
      if (plan.bookingUrl && !publicHttpsUrl(plan.bookingUrl)) throw new Error('Use a complete public HTTPS booking link.');
      if (plan.fpEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plan.fpEmail)) throw new Error('Enter a valid franchise partner email.');
      if (plan.sendDate && (!/^20\d{2}-\d{2}-\d{2}$/.test(plan.sendDate) || new Date(plan.sendDate+'T12:00:00Z').toISOString().slice(0,10) !== plan.sendDate || !plan.sendDate.startsWith(month+'-'))) throw new Error('Choose a valid send date in this month.');
      await query(`insert into operations_plans(client_id,month,plan,updated_by) values($1,$2,$3::jsonb,$4)
        on conflict(client_id,month) do update set plan=excluded.plan,updated_by=excluded.updated_by,updated_at=now()`,[client.id,month,JSON.stringify(plan),identity.email]);
      return NextResponse.json({plan});
    }
    if (body.action === 'run') return NextResponse.json(await runMonthly(client,month,identity.email));
    if (body.action === 'handoff') return NextResponse.json({handoff:await addHandoff(client.id,month,body.sender,body.recipient,body.message,identity.email)});
    if (body.action === 'request_info') {
      const p = await getPlan(client.id,month);
      const items = [];
      if (!p?.text) items.push('Import the Diamond plan');
      if (!p?.bookingUrl) items.push('Confirm the booking link');
      if (!p?.address) items.push('Confirm the newsletter business mailing address');
      if (!p?.fpEmail) items.push('Identify the franchise partner and approval contact');
      if (!(await snapshot(client.id,month)).locations.some(l=>l.connected)) items.push('Connect the Revive location token');
      await requestInfo(client.id,items,p?.fpEmail || '');
      return NextResponse.json({requested:items});
    }
    return NextResponse.json({error:'Unknown action'},{status:400});
  } catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : 'Operation failed'},{status:400}); }
}
