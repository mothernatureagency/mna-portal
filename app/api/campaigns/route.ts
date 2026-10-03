import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { campaignAccess } from '@/lib/campaign-access';
import { campaignIssues, campaignReviewVersion } from '@/lib/campaign-checks';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const statuses = ['drafting','pending_review','approved','changes_requested','sent','failed'];
const contentFields = ['name','campaign_type','subject','body','scheduled_date','scheduled_time','audience_segment','audience_count','client_id'];
export async function GET(req: NextRequest) {
  const access = await campaignAccess();
  if (!access) return NextResponse.json({error:'Not authorized'},{status:403});
  const clientId=req.nextUrl.searchParams.get('clientId');
  const conditions:string[]=[]; const params:any[]=[];
  if(!access.staff){params.push(access.clientIds);conditions.push(`c.client_id=any($${params.length}) and c.client_visible=true`);}
  if(clientId&&clientId!=='mna'){params.push(clientId);conditions.push(`c.client_id=$${params.length}`);}
  if(req.nextUrl.searchParams.get('visible')==='1')conditions.push('c.client_visible=true');
  const status=req.nextUrl.searchParams.get('status');
  if(status){params.push(status);conditions.push(`c.status=$${params.length}`);}
  const {rows}=await query(`select c.*,m.recipients,m.delivered,m.bounced,m.opened,m.clicked,m.unsubscribed,m.open_rate,m.click_rate
    from campaigns c left join campaign_metrics m on m.campaign_id=c.id ${conditions.length?'where '+conditions.join(' and '):''}
    order by c.scheduled_date desc,c.created_at desc`,params);
  return NextResponse.json({campaigns:rows});
}
export async function POST(req: NextRequest) {
  const access=await campaignAccess();if(!access?.staff)return NextResponse.json({error:'Staff sign-in required'},{status:403});
  let b:any;try{b=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  if(!b.clientId||!['email','sms'].includes(b.campaignType)||!b.name||!b.scheduledDate)return NextResponse.json({error:'Client, type, name and date are required'},{status:400});
  const {rows}=await query(`insert into campaigns(client_id,campaign_type,name,subject,body,scheduled_date,scheduled_time,audience_segment,audience_count)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[b.clientId,b.campaignType,b.name,b.subject||null,b.body||null,b.scheduledDate,b.scheduledTime||null,b.audienceSegment||null,b.audienceCount||null]);
  return NextResponse.json({campaign:rows[0]},{status:201});
}
export async function PATCH(req: NextRequest) {
  const access=await campaignAccess();if(!access)return NextResponse.json({error:'Not authorized'},{status:403});
  let b:any;try{b=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  if(!b?.id)return NextResponse.json({error:'id required'},{status:400});
  if(b.status!==undefined&&!statuses.includes(b.status))return NextResponse.json({error:'Invalid status'},{status:400});
  try{
    return await transaction(async db=>{
      const current=(await db.query('select * from campaigns where id=$1 for update',[b.id])).rows[0];
      if(!current||(!access.staff&&(!access.clientIds.includes(current.client_id)||!current.client_visible)))return NextResponse.json({error:'Not found'},{status:404});
      const keys=Object.keys(b).filter(k=>k!=='id'&&k!=='reviewed_version');
      // Franchise partners can comment and request changes; sending stays with staff.
      if(!access.staff&&keys.some(k=>k!=='client_comments'&&!(k==='status'&&b.status==='changes_requested')))return NextResponse.json({error:'Only staff can edit or approve sending'},{status:403});
      const changed=contentFields.some(k=>b[k]!==undefined&&b[k]!==current[k]);
      if(current.sent_at&&(changed||b.status!==undefined))return NextResponse.json({error:'Sent campaigns are immutable. Create a new campaign.'},{status:409});
      if(b.campaign_type!==undefined&&!['sms','email'].includes(b.campaign_type))return NextResponse.json({error:'Invalid campaign type'},{status:400});
      if(changed&&b.status==='approved')return NextResponse.json({error:'Save the edited copy first, then review and approve it.'},{status:409});
      if(b.status==='approved'){
        const issues=campaignIssues(current);
        if(issues.length)return NextResponse.json({error:issues.join(' '),issues},{status:422});
        if(b.reviewed_version!==campaignReviewVersion(current))return NextResponse.json({error:'Campaign changed since it was opened. Reload and review the latest copy before approving.'},{status:409});
      }
      if(b.status==='sent')return NextResponse.json({error:'Use the delivery confirmation endpoint after a verified send.'},{status:400});
      const fields:string[]=[];const values:any[]=[];
      for(const key of [...contentFields,'client_comments','mna_comments','revive_campaign_id','client_visible']){
        if(b[key]!==undefined){values.push(b[key]);fields.push(`${key}=$${values.length}`);}
      }
      let nextStatus=b.status;
      if(changed)nextStatus='pending_review';
      else if(b.client_visible===true&&nextStatus===undefined&&current.status==='drafting')nextStatus='pending_review';
      if(nextStatus!==undefined){values.push(nextStatus);fields.push(`status=$${values.length}`);fields.push(nextStatus==='approved'?'approved_at=now()':'approved_at=null');}
      if(!fields.length)return NextResponse.json({error:'Nothing to update'},{status:400});
      values.push(b.id);
      const {rows}=await db.query(`update campaigns set ${fields.join(',')} where id=$${values.length} returning *`,values);
      return NextResponse.json({campaign:rows[0]});
    });
  }catch{return NextResponse.json({error:'Could not save this campaign. Check the supplied values.'},{status:400});}
}
export async function DELETE(req: NextRequest){
  const access=await campaignAccess();if(!access?.staff)return NextResponse.json({error:'Staff sign-in required'},{status:403});
  const id=req.nextUrl.searchParams.get('id');if(!id)return NextResponse.json({error:'id required'},{status:400});
  await query('delete from campaigns where id=$1 and sent_at is null',[id]);return NextResponse.json({ok:true});
}
