import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureOperations, snapshot, requestInfo } from '@/lib/operations/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret=process.env.CRON_SECRET;
  const given=req.headers.get('authorization') || '';
  const expected=`Bearer ${secret || ''}`;
  if(!secret || Buffer.byteLength(given)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(given),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized'},{status:401});
  await ensureOperations();
  // Small bounded batches, one daily scan. No model calls and no outbound messaging.
  const plans=(await query(`select client_id,month from operations_plans
    where month=to_char(current_date,'YYYY-MM') order by client_id limit 100`)).rows;
  const results=[];
  for(const p of plans){
    try{
      const state=await snapshot(p.client_id,p.month);
      const alerts=[...state.alerts];
      if(state.runs.some(r=>r.status==='failed'))alerts.push('Review the failed monthly agent run');
      await requestInfo(p.client_id,alerts,'');
      await query(`insert into client_kv(client_id,key,value,updated_at) values($1,'operations_monitor',$2::jsonb,now())
        on conflict(client_id,key) do update set value=excluded.value,updated_at=now()`,[p.client_id,JSON.stringify({month:p.month,checkedAt:state.checkedAt,alerts})]);
      results.push({clientId:p.client_id,ok:true,alerts:alerts.length});
    }catch{results.push({clientId:p.client_id,ok:false});}
  }
  return NextResponse.json({results});
}
