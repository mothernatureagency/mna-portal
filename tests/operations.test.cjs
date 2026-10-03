const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file,mocks={}) {
  const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',js)(id=>{if(id in mocks)return mocks[id];throw new Error(`Unmocked dependency: ${id}`);},m,m.exports);
  return m.exports;
}
const checks=load('lib/campaign-checks.ts');
const policy=load('lib/operations/policy.ts');
test('SMS counts GSM extensions, Unicode, emoji and concatenated segments',()=>{
  assert.equal(checks.smsSegments('a'.repeat(160)).segments,1);
  assert.equal(checks.smsSegments('a'.repeat(161)).segments,2);
  assert.equal(checks.smsSegments('^'.repeat(81)).segments,2);
  assert.equal(checks.smsSegments('“'+'a'.repeat(70)).segments,2);
  assert.equal(checks.smsSegments('😀'.repeat(36)).segments,2);
  assert.equal(checks.smsSegments('').segments,0);
  assert.equal(checks.smsSegments('^'.repeat(153)).segments,3);
  assert.equal(checks.smsSegments('😀'.repeat(67)).segments,3);
  assert.equal(checks.smsSegments('a'.repeat(305),true).segments,3);
});
test('both SMS variants must have their own links and STOP text',()=>{
  const valid='Prime IV: Book https://example.com Reply STOP to opt out';
  assert.deepEqual(checks.campaignIssues({campaign_type:'sms',body:valid}),[]);
  const bad=`MEMBER COPY:\n${valid}\n\nNON-MEMBER COPY:\nCome visit us`;
  assert.ok(checks.campaignIssues({campaign_type:'sms',body:bad}).some(x=>x.includes('Version 2: Add')));
  assert.equal(checks.smsVariants('NON-MEMBER COPY:\nhello')[0],'hello');
});
test('unfinished copy and missing unsubscribe cannot be approved',()=>{
  assert.ok(checks.campaignIssues({campaign_type:'sms',body:'Book [link] now — offer'}).length>=3);
  assert.ok(checks.campaignIssues({campaign_type:'email',body:'https://example.com',subject:'Hello'}).some(x=>x.includes('unsubscribe')));
});
test('client scope fails closed, including an empty allowlist',()=>{
  assert.throws(()=>policy.assertClientScope('pinecrest',[]));
  assert.throws(()=>policy.assertClientScope('pinecrest',['niceville']));
  assert.doesNotThrow(()=>policy.assertClientScope('pinecrest',['pinecrest']));
});
test('month validation rejects malformed months',()=>{
  assert.throws(()=>policy.requireMonth('2026-13'));
  assert.equal(policy.requireMonth('2026-10'),'2026-10');
});
test('newsletter escapes copy and URLs, retaining only unsubscribe placeholder',()=>{
  const html=policy.newsletterHtml({heading:'<script>x</script>',paragraphs:['<img src=x onerror=alert(1)>'],cta:'Book'},'Clinic','https://example.com/?a=1&b=2','123 Main St');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('a=1&amp;b=2'));
  assert.ok(html.includes('{{unsubscribe_link}}'));
});
function campaignRoute({access={staff:true,email:'staff@test'},row={id:'one',client_id:'pinecrest',status:'approved',body:'old',subject:null,sent_at:null},writes=[]}={}) {
  const db={query:async(sql,values)=>{if(sql.startsWith('select'))return {rows:[row]};writes.push({sql,values});return {rows:[row]};}};
  return {writes,route:load('app/api/campaigns/route.ts',{
    'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200})}},
    '@/lib/db':{query:db.query,transaction:fn=>fn(db)},
    '@/lib/campaign-access':{campaignAccess:async()=>access},
    '@/lib/campaign-checks':checks,
  })};
}
test('editing an approved campaign clears approval in the same update',async()=>{
  const {route,writes}=campaignRoute();
  await route.PATCH({json:async()=>({id:'one',body:'new'})});
  assert.equal(writes.length,1);
  assert.ok(writes[0].sql.includes('approved_at=null'));
  assert.ok(writes[0].values.includes('pending_review'));
});
test('cannot approve new copy in the same request',async()=>{
  const {route,writes}=campaignRoute();
  assert.equal((await route.PATCH({json:async()=>({id:'one',body:'new',status:'approved'})})).status,409);
  assert.equal(writes.length,0);
});
test('approval validates final link and opt-out text',async()=>{
  const {route,writes}=campaignRoute({row:{id:'one',client_id:'pinecrest',campaign_type:'sms',body:'Hello',sent_at:null}});
  assert.equal((await route.PATCH({json:async()=>({id:'one',status:'approved'})})).status,422);
  assert.equal(writes.length,0);
});
test('anonymous and cross-client requests cannot mutate campaigns',async()=>{
  const a=campaignRoute({access:null});
  assert.equal((await a.route.PATCH({json:async()=>({id:'one',body:'x'})})).status,403);
  const b=campaignRoute({access:{staff:false,clientIds:['niceville']}});
  assert.equal((await b.route.PATCH({json:async()=>({id:'one',client_comments:'x'})})).status,404);
  assert.equal(b.writes.length,0);
});
test('sent copy cannot be rewritten or re-approved',async()=>{
  const {route,writes}=campaignRoute({row:{id:'one',client_id:'pinecrest',sent_at:'2026-10-01',body:'sent'}});
  assert.equal((await route.PATCH({json:async()=>({id:'one',status:'approved'})})).status,409);
  assert.equal(writes.length,0);
});
function runnerFixture(t,{existing=false,invalid=false,missing=false}={}) {
  const originalFetch=global.fetch;
  const previous={...process.env};
  process.env.ANTHROPIC_API_KEY='test';process.env.OPENAI_API_KEY='test';process.env.OPENAI_COPY_MODEL='test-copy-model';
  t.after(()=>{global.fetch=originalFetch;for(const k of ['ANTHROPIC_API_KEY','OPENAI_API_KEY','OPENAI_COPY_MODEL']){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
  const calls=[];const writes=[];
  const pack={subject:'October at Pinecrest',heading:'Your next visit',paragraphs:['Make time for yourself this month.'],cta:'Book your visit',memberSms:'Prime IV: Book https://example.com Reply STOP to opt out',prospectSms:'Visit Prime IV: https://example.com Reply STOP to opt out',social:[{day:3,platform:'Instagram',caption:'Make time for yourself.'}],ads:['Request fresh data.'],missing:[]};
  global.fetch=async(url,options)=>{calls.push('openai');assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,4000);return {ok:true,json:async()=>({status:invalid?'incomplete':'completed',model:'test-copy-model',usage:{input_tokens:20,output_tokens:20},output:[{content:[{type:'output_text',text:JSON.stringify(pack)}]}]})};};
  const query=async(sql,values)=>{
    if(sql.includes('monthly_specials'))return {rows:[]};
    if(sql.includes('select * from operations_runs')&&sql.includes('fingerprint'))return {rows:existing?[{id:'old',status:'pending_review'}]:[]};
    if(sql.includes('count(*)'))return {rows:[{n:0}]};
    if(sql.includes('insert into operations_runs'))return {rows:[{id:'run-1'}]};
    if(sql.includes('select id from projects'))return {rows:[{id:'project-1'}]};
    if(sql.startsWith('select'))return {rows:[{id:'run-1',status:'pending_review'}]};
    writes.push({sql,values});return {rows:[]};
  };
  const runner=load('lib/operations/runner.ts',{
    'node:crypto':require('node:crypto'),'@/lib/db':{query,transaction:fn=>fn({query})},
    '@/lib/anthropic':{anthropicFor:()=>({messages:{create:async()=>{calls.push('claude');return {stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:10},content:[{type:'text',text:'Create a concise pack.'}]};}}})},
    '@/lib/campaign-checks':checks,'./policy':policy,
    './store':{ensureOperations:async()=>{},getPlan:async()=>missing?null:{text:'One newsletter, two SMS variants, one Instagram post.',source:'Approved plan',bookingUrl:'https://example.com',address:'123 Main St',sendDate:'2026-10-20',fpEmail:''},snapshot:async()=>({metrics:[],crm:[],alerts:[]}),addHandoff:async()=>{},requestInfo:async()=>{}},
  });
  return {runner,calls,writes};
}
test('monthly run makes exactly two provider calls and saves review-only deliverables',async t=>{
  const {runner,calls,writes}=runnerFixture(t);
  await runner.runMonthly({id:'pinecrest',name:'Prime IV'},'2026-10','staff@test');
  assert.deepEqual(calls,['claude','openai']);
  const campaigns=writes.filter(w=>w.sql.includes('insert into campaigns'));
  assert.equal(campaigns.length,3);
  assert.ok(campaigns.every(w=>w.sql.includes("'pending_review'")));
  assert.ok(writes.find(w=>w.sql.includes('insert into content_calendar')).sql.includes('false'));
});
test('unchanged monthly work reuses the saved run without an AI call',async t=>{
  const {runner,calls}=runnerFixture(t,{existing:true});
  const result=await runner.runMonthly({id:'pinecrest',name:'Prime IV'},'2026-10','staff@test');
  assert.equal(result.reused,true);assert.equal(calls.length,0);
});
test('missing plan blocks paid generation',async t=>{
  const {runner,calls}=runnerFixture(t,{missing:true});
  const result=await runner.runMonthly({id:'pinecrest',name:'Prime IV'},'2026-10','staff@test');
  assert.equal(result.blocked,true);assert.equal(calls.length,0);
});
test('incomplete AI output creates no campaigns and is not retried',async t=>{
  const {runner,calls,writes}=runnerFixture(t,{invalid:true});
  await assert.rejects(()=>runner.runMonthly({id:'pinecrest',name:'Prime IV'},'2026-10','staff@test'),/did not finish/);
  assert.equal(calls.length,2);
  assert.equal(writes.filter(w=>w.sql.includes('insert into campaigns')).length,0);
});
test('stale preview cannot approve a newer campaign revision',async()=>{
  const current={id:'one',name:'Campaign',campaign_type:'sms',body:'Prime IV: https://example.com Reply STOP to opt out',sent_at:null};
  const {route,writes}=campaignRoute({row:current});
  const result=await route.PATCH({json:async()=>({id:'one',status:'approved',reviewed_version:checks.campaignReviewVersion({...current,body:'Older copy'})})});
  assert.equal(result.status,409);assert.equal(writes.length,0);
});
