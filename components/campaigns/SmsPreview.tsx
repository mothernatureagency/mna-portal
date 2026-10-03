'use client';
import React, { useState } from 'react';
import { smsSegments, smsVariants } from '@/lib/campaign-checks';
export default function SmsPreview({body,audienceCount}:{body:string;audienceCount:number|null}) {
  const [rate,setRate]=useState('');
  const [recipients,setRecipients]=useState(audienceCount?String(audienceCount):'');
  const [tollFree,setTollFree]=useState(false);
  return <div className="space-y-4">
    {smsVariants(body).map((copy,index)=>{
      const stats=smsSegments(copy,tollFree);
      return <div key={index} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-white/80 text-sm whitespace-pre-wrap">{copy}</p>
        <p className="text-white/50 text-xs mt-2">{stats.encoding} · {stats.units} encoded units · {stats.segments} segment{stats.segments===1?'':'s'} per recipient</p>
        {rate&&Number(rate)>=0&&Number(recipients)>0&&<p className="text-emerald-300 mt-2">Estimated base cost: ${(stats.segments*Number(recipients)*Number(rate)).toFixed(2)}</p>}
      </div>;
    })}
    <div className="flex flex-wrap gap-3 text-xs text-white/60">
      <label>Recipients per version<input aria-label="SMS estimate recipients" type="number" min="0" value={recipients} onChange={e=>setRecipients(e.target.value)} className="block bg-white/5 border border-white/20 rounded p-2"/></label>
      <label>Your Revive rate per segment (USD)<input aria-label="SMS segment price" type="number" min="0" step="0.0001" value={rate} onChange={e=>setRate(e.target.value)} className="block bg-white/5 border border-white/20 rounded p-2"/></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={tollFree} onChange={e=>setTollFree(e.target.checked)}/>US/Canada toll-free sender</label>
    </div>
    <p className="text-xs text-white/40">Estimate only. Excludes carrier fees, MMS and changes caused by personalization or link tracking. Use the rate from your Revive account.</p>
  </div>;
}
