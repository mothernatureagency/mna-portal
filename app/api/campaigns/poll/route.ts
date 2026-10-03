import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { campaignAccess } from '@/lib/campaign-access';
import { campaignIssues } from '@/lib/campaign-checks';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Existing integration remains session-authenticated. This endpoint does not send messages.
export async function GET() {
  if(!(await campaignAccess())?.staff)return NextResponse.json({error:'Staff sign-in required'},{status:403});
  const {rows}=await query(`select * from campaigns where status='approved' and approved_at is not null and sent_at is null order by scheduled_date`);
  return NextResponse.json({campaigns:rows.filter(c=>campaignIssues(c).length===0)});
}
export async function PATCH(req: NextRequest){
  if(!(await campaignAccess())?.staff)return NextResponse.json({error:'Staff sign-in required'},{status:403});
  let body:any;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  if(!body.id||!body.reviveCampaignId)return NextResponse.json({error:'Campaign ID and Revive delivery reference required'},{status:400});
  const {rows}=await query(`update campaigns set status='sent',sent_at=now(),revive_campaign_id=$1
    where id=$2 and status='approved' and approved_at is not null and sent_at is null returning *`,[body.reviveCampaignId,body.id]);
  if(!rows.length)return NextResponse.json({error:'Campaign is no longer approved or was already sent'},{status:409});
  return NextResponse.json({campaign:rows[0]});
}
