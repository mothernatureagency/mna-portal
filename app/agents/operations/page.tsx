'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NewsletterPreview from '@/components/campaigns/NewsletterPreview';
import { useClient } from '@/context/ClientContext';
import { OPERATIONS_ROLES } from '@/lib/operations/policy';

type Plan = { source:string; text:string; bookingUrl:string; address:string; fpEmail:string; sendDate:string };
const empty: Plan = {source:'',text:'',bookingUrl:'',address:'',fpEmail:'',sendDate:''};
const field = 'w-full rounded-lg bg-white/5 border border-white/20 p-3 text-white';
export default function OperationsPage() {
  const {activeClient} = useClient();
  const [month,setMonth] = useState(new Date().toISOString().slice(0,7));
  const [data,setData] = useState<any>(null);
  const [plan,setPlan] = useState<Plan>(empty);
  const [busy,setBusy] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [sender,setSender] = useState('claude-ceo');
  const [recipient,setRecipient] = useState('crm-manager');
  const [message,setMessage] = useState('');
  const load = useCallback(async (signal?:AbortSignal) => {
    const res = await fetch(`/api/operations?clientId=${encodeURIComponent(activeClient.id)}&month=${month}`,{signal});
    const value = await res.json();
    if (!res.ok) throw new Error(value.error || 'Could not load operations');
    setData(value); setPlan(value.plan || {...empty,bookingUrl:value.client.links?.booking || ''});
  },[activeClient.id,month]);
  useEffect(()=>{const controller=new AbortController();setData(null);setPlan(empty);setError('');load(controller.signal).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[load]);
  async function action(name:string,extra:Record<string,unknown>={}) {
    setBusy(name);setError('');setNotice('');
    try {
      const res=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:name,clientId:activeClient.id,month,...extra})});
      const value=await res.json();if(!res.ok)throw new Error(value.error || 'Operation failed');
      setNotice(value.blocked ? `Needs information: ${value.missing.join(', ')}` : value.reused ? 'Showing the saved run. No new AI calls were made.' : name==='run' ? 'Drafts saved for review. Nothing was sent.' : 'Saved.');
      if(name==='handoff')setMessage('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{setBusy('');}
  }
  const run=data?.runs?.find((r:any)=>r.output);
  return <div className="space-y-6 max-w-6xl mx-auto pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-emerald-300 text-sm">Mother Nature Agency</p><h1 className="text-3xl font-bold text-white">Agent Operations</h1><p className="text-white/60 mt-2">{activeClient.name}. One monthly brief, shared handoffs, human approval.</p></div><label className="text-white/70">Planning month<input aria-label="Planning month" type="month" disabled={!!busy} value={month} onChange={e=>setMonth(e.target.value)} className={field}/></label></header>
    {error&&<div role="alert" className="p-4 bg-red-500/15 text-red-200 rounded-xl">{error}</div>}
    {notice&&<div role="status" className="p-4 bg-emerald-500/15 text-emerald-200 rounded-xl">{notice}</div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{OPERATIONS_ROLES.map(role=><section key={role.id} className="glass-card p-4"><h2 className="font-semibold text-white">{role.name}</h2><p className="text-sm text-white/60 mt-2">{role.responsibility}</p></section>)}</div>
    <section className="glass-card p-5 space-y-4"><h2 className="text-xl font-semibold text-white">Monthly plan and verified facts</h2><p className="text-sm text-white/60">Paste the existing Diamond plan. A source link records where it came from; it does not import the document by itself. Do not paste API keys or customer conversations.</p>
      <label className="block text-white/80">Plan source<input className={field} value={plan.source} maxLength={500} onChange={e=>setPlan({...plan,source:e.target.value})}/></label>
      <label className="block text-white/80">Diamond plan<textarea className={field} rows={7} maxLength={10000} value={plan.text} onChange={e=>setPlan({...plan,text:e.target.value})}/></label>
      <div className="grid md:grid-cols-2 gap-4">{([['bookingUrl','Verified booking / offer URL'],['address','Business mailing address'],['fpEmail','Franchise partner approval email'],['sendDate','Proposed send date']] as const).map(([key,label])=><label key={key} className="text-white/80">{label}<input type={key==='sendDate'?'date':key==='fpEmail'?'email':'text'} className={field} value={plan[key]} onChange={e=>setPlan({...plan,[key]:e.target.value})}/></label>)}</div>
      <div className="flex flex-wrap gap-3"><button disabled={!!busy} onClick={()=>action('save_plan',{plan})} className="px-4 py-2 rounded-lg bg-emerald-700 text-white disabled:opacity-40">Save plan</button><button disabled={!!busy} onClick={()=>action('request_info')} className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40">Request missing information</button></div><p className="text-xs text-white/50">Requests appear in Task Manager for the team or named franchise partner. No email or SMS notification is sent by this action.</p>
    </section>
    <section className="glass-card p-5 space-y-3"><h2 className="text-xl font-semibold text-white">Run the monthly handoff</h2><p className="text-white/70">Claude prepares the management brief. OpenAI writes the newsletter, SMS and social pack. Managers receive saved handoffs.</p><p className="text-sm text-white/50">Up to two AI calls per run, six new runs per day across the agency. Unchanged briefs reuse saved results. API usage is billed separately from chat subscriptions. No background AI loop.</p>
      <p className="text-sm text-white/70">Claude: {data?.providers?.claude?'configured':'needs API key'} · OpenAI: {data?.providers?.openai?'configured':'needs API key and copy model'}</p>
      <button disabled={!!busy||!data?.providers?.openai||!data?.providers?.claude} onClick={()=>action('run')} className="px-5 py-3 bg-sky-700 text-white rounded-lg disabled:opacity-40">{busy==='run'?'Preparing draft pack…':'Generate from saved plan'}</button>
      <div className="flex flex-wrap gap-4 text-emerald-300 text-sm"><Link href="/campaigns">Review email and SMS</Link><Link href="/content">Review social posts</Link><Link href="/ai-conversations">Revive connections and SMS replies</Link><Link href="/client-tasks">Information requests</Link></div>
    </section>
    <section className="glass-card p-5"><div className="flex justify-between gap-3"><h2 className="text-xl text-white font-semibold">Manager monitor</h2><button disabled={!!busy} onClick={()=>load().catch(e=>setError(e.message))} className="text-emerald-300">Refresh</button></div><p className="text-xs text-white/50 mt-2">Checks saved portal records on refresh, plus a daily check after the scheduled worker is configured. No AI cost. This is not a live delivery receipt or an automatic ads optimizer.</p><ul className="mt-3 space-y-2 text-amber-200">{data?.alerts?.map((a:string)=><li key={a}>{a}</li>)}</ul>{data?.monitor?.checkedAt&&<p className="text-xs text-white/50 mt-2">Last scheduled check: {new Date(data.monitor.checkedAt).toLocaleString()}</p>}{data&&!data.alerts.length&&<p className="text-emerald-300 mt-3">No issues found in the monitored records.</p>}<p className="text-white/50 text-sm mt-3">{data?.campaigns?.length||0} campaigns · {data?.requests?.length||0} information requests · {data?.metrics?.length||0} saved performance metrics</p></section>
    {run&&<section className="glass-card p-5 space-y-3"><h2 className="text-xl text-white font-semibold">Latest newsletter preview</h2><p className="text-white/70">{run.output.subject}</p><NewsletterPreview html={run.output.html}/><details className="text-white/70"><summary>Copy HTML for Revive</summary><textarea aria-label="Newsletter HTML" readOnly value={run.output.html} className={field} rows={8}/></details><h3 className="text-white font-semibold">Ads manager recommendations</h3><ul className="space-y-2 text-white/70">{run.output.ads.map((a:string,i:number)=><li key={i}>{a}</li>)}</ul><p className="text-xs text-white/50">Recommendations only. Ad budgets and live campaigns are unchanged.</p></section>}
    <section className="glass-card p-5 space-y-3"><h2 className="text-xl text-white font-semibold">Shared handoffs</h2><p className="text-sm text-white/60">Claude and ChatGPT can read and add handoffs through the same portal MCP. A handoff saves a task; it does not start another paid model call.</p><div className="grid md:grid-cols-2 gap-3"><label className="text-white/70">From<select className={field} value={sender} onChange={e=>setSender(e.target.value)}>{OPERATIONS_ROLES.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label><label className="text-white/70">To<select className={field} value={recipient} onChange={e=>setRecipient(e.target.value)}>{OPERATIONS_ROLES.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label></div><textarea aria-label="Handoff message" className={field} rows={3} value={message} maxLength={8000} onChange={e=>setMessage(e.target.value)}/><button disabled={!!busy||!message.trim()} onClick={()=>action('handoff',{sender,recipient,message})} className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40">Save handoff</button><div className="space-y-3">{data?.handoffs?.map((h:any)=><article key={h.id} className="border-t border-white/10 pt-3"><p className="text-emerald-300 text-sm">{h.sender} → {h.recipient}</p><p className="text-white/75 whitespace-pre-wrap text-sm mt-2">{h.message}</p><p className="text-white/40 text-xs mt-2">{h.actor} · {new Date(h.created_at).toLocaleString()}</p></article>)}</div></section>
    <section className="glass-card p-5"><h2 className="text-white font-semibold">Run history</h2>{data?.runs?.map((r:any)=><p key={r.id} className="text-sm text-white/60 mt-2">{new Date(r.created_at).toLocaleString()} · {r.status}{r.error?` · ${r.error}`:''}</p>)}</section>
  </div>;
}
