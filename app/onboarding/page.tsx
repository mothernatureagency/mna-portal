'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type Step = { done: boolean; note?: string; url?: string; date?: string; na?: boolean };
type QA = { q: string; a: string };
type Onboarding = {
  steps: Record<string, Step>;
  pricing: { tier: string; monthly: string; introOffer: string };
  channels: Record<string, Step>;
  discovery: QA[];
  qa: QA[];
};

// Discovery questions to go over with a new Prime IV client.
const PRIME_DISCOVERY: string[] = [
  // Pricing & services
  'What membership tiers do you offer, and what are the prices? (SELECT / ESSENTIALS / TRANSFORMATION / ENLIGHTENMENT)',
  'What tier pricing are you / what are your à-la-carte drip + injection prices?',
  'What are your best-selling / signature services?',
  'Do you offer peptides? If so, which — itemize them with pricing.',
  'Do you offer NAD+, hormone therapy, weight loss / GLP-1, or aesthetic services? Which?',
  'Do you offer packages, financing, or gift cards?',
  // Specials & programs
  'What specials do you currently offer? Limited-time or always-on? New-client vs member specials?',
  'Please submit any special pricing and exclusions.',
  'Referral program — started, want, or no? (e.g. $25 credit for both referee and referrer)',
  'Do you have a loyalty / rewards program?',
  // Operations & compliance
  'What is the age limit?',
  'When do we need medical director approval?',
  'Appointment-only, walk-ins, or both? Booking system + link (Jane, GHL, etc.) and phone number?',
  'Hours of operation?',
  'Cancellation / no-show policy?',
  'Do you do follow-up calls? What is the process?',
  'Any corporate (PDM) brand guidelines or medical-claim restrictions we should follow?',
  // Digital presence & access
  'Do you have a website or own a custom domain? (URL + who owns it)',
  'Socials — Instagram, Facebook, YouTube, TikTok, X? Provide @ handles.',
  'Google Business Profile — can we be added as a manager? (needed to respond to reviews)',
  'Meta Business Manager / ad account — have we been granted access?',
  'Google Ads account — have we been granted access?',
  'Email / SMS platform and list size? (Mailchimp, GHL, etc.)',
  // Marketing, goals & contacts
  'Monthly ad budget? Extra budget/time for Blip, billboards, B2B, or flyers?',
  'Service area / target radius?',
  'Who is your target customer / ideal demographic?',
  'Top local competitors you want to beat?',
  'Primary point of contact + preferred contact method?',
  'Who approves content before it posts?',
  'Top business goals for the next 90 days?',
  'Brand assets available — logo files, brand colors, photos/video?',
  'Any additional information we need to know?',
];

// Generic discovery for non-Prime-IV clients.
const GENERIC_DISCOVERY: string[] = [
  'What are your core products/services and pricing?',
  'What makes you different from competitors?',
  'Who is your target customer / ideal demographic?',
  'What specials or promotions do you currently offer?',
  'Referral or loyalty program — have one, want one, or no?',
  'Business hours and how do customers book/buy?',
  'Do you have a website or own a custom domain? (URL + who owns it)',
  'Socials — Instagram, Facebook, YouTube, TikTok, X? Provide @ handles.',
  'Google Business Profile — can we be added as a manager?',
  'Meta / Google Ads accounts — have we been granted access?',
  'Monthly ad budget? Extra budget for print/outdoor/B2B?',
  'Primary point of contact + preferred contact method?',
  'Who approves content before it posts?',
  'Top business goals for the next 90 days?',
  'Brand assets available — logo files, colors, photos/video?',
  'Any additional information we need to know?',
];

function seedDiscovery(clientId?: string): QA[] {
  const isPrime = clientId === 'prime-iv' || (clientId || '').startsWith('prime-iv-');
  return (isPrime ? PRIME_DISCOVERY : GENERIC_DISCOVERY).map((q) => ({ q, a: '' }));
}

const SETUP_STEPS: { key: string; label: string; extra?: 'url' | 'date' | 'na'; hint?: string }[] = [
  { key: 'contract', label: 'Contract sent & signed' },
  { key: 'invoicing', label: 'Invoicing set up' },
  { key: 'vendor', label: 'Vendor access agreement' },
  { key: 'assetsFolder', label: 'Assets folder created', extra: 'url', hint: 'Paste the Drive/Dropbox link' },
  { key: 'requestAssets', label: 'Assets requested from client' },
  { key: 'onboardingCall', label: 'Onboarding call scheduled', extra: 'date' },
  { key: 'ghl', label: 'GHL created (if applicable)', extra: 'na' },
];

const CHANNELS: { key: string; label: string }[] = [
  { key: 'blip', label: 'Blip / Billboard' },
  { key: 'b2b', label: 'B2B outreach' },
  { key: 'flyers', label: 'Flyers / Print' },
];

function emptyOnboarding(): Onboarding {
  return {
    steps: Object.fromEntries(SETUP_STEPS.map((s) => [s.key, { done: false }])),
    pricing: { tier: '', monthly: '', introOffer: '' },
    channels: Object.fromEntries(CHANNELS.map((c) => [c.key, { done: false }])),
    discovery: [],
    qa: [],
  };
}

export default function OnboardingPage() {
  const { activeClient } = useClient();
  const clientId = activeClient?.id;

  const [data, setData] = useState<Onboarding>(emptyOnboarding());
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const loadedRef = useRef(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!clientId) return;
    loadedRef.current = false;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=onboarding`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.value;
        const base = emptyOnboarding();
        if (v && typeof v === 'object') {
          setData({
            steps: { ...base.steps, ...(v.steps || {}) },
            pricing: { ...base.pricing, ...(v.pricing || {}) },
            channels: { ...base.channels, ...(v.channels || {}) },
            // Seed the discovery questions the first time (per client type);
            // once saved, keep whatever's there.
            discovery: Array.isArray(v.discovery) && v.discovery.length ? v.discovery : seedDiscovery(clientId),
            qa: Array.isArray(v.qa) ? v.qa : [],
          });
        } else {
          setData({ ...base, discovery: seedDiscovery(clientId) });
        }
      })
      .catch(() => setData(emptyOnboarding()))
      .finally(() => { loadedRef.current = true; });
  }, [clientId]);

  // Debounced autosave whenever data changes (after the initial load).
  useEffect(() => {
    if (!clientId || !loadedRef.current) return;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await fetch('/api/client-kv', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, key: 'onboarding', value: data }),
        });
        setStatus('saved');
      } catch { setStatus('idle'); }
    }, 700);
    return () => clearTimeout(timer.current);
  }, [data, clientId]);

  const setStep = (key: string, patch: Partial<Step>) =>
    setData((d) => ({ ...d, steps: { ...d.steps, [key]: { ...d.steps[key], ...patch } } }));
  const setChannel = (key: string, patch: Partial<Step>) =>
    setData((d) => ({ ...d, channels: { ...d.channels, [key]: { ...d.channels[key], ...patch } } }));
  const setPricing = (patch: Partial<Onboarding['pricing']>) =>
    setData((d) => ({ ...d, pricing: { ...d.pricing, ...patch } }));

  const doneCount = SETUP_STEPS.filter((s) => data.steps[s.key]?.done || (s.extra === 'na' && data.steps[s.key]?.na)).length;
  const pct = Math.round((doneCount / SETUP_STEPS.length) * 100);

  const inputCls = 'w-full text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30';

  return (
    <div className="flex flex-col gap-5 max-w-[1100px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>rocket_launch</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Onboarding</h1>
          </div>
          <p className="text-white/60 mt-1 text-sm">New-client setup for <b className="text-white/80">{activeClient?.shortName}</b> — switch clients up top to onboard a different one.</p>
        </div>
        <div className="text-[11px] text-white/50">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes saved' : ''}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">Setup progress</span>
          <span className="text-[12px] font-bold text-white">{doneCount}/{SETUP_STEPS.length} · {pct}%</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0c6da4,#4ab8ce)' }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Setup checklist */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-3">Setup checklist</div>
          <div className="flex flex-col gap-2.5">
            {SETUP_STEPS.map((s) => {
              const st = data.steps[s.key] || { done: false };
              const checked = st.done || (s.extra === 'na' && st.na);
              return (
                <div key={s.key} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setStep(s.key, { done: !st.done })}
                      className="w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors"
                      style={{ borderColor: checked ? '#10b981' : 'rgba(255,255,255,0.3)', background: checked ? 'rgba(16,185,129,0.2)' : 'transparent' }}
                    >
                      {checked && <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: 14 }}>check</span>}
                    </button>
                    <span className={`text-[13px] font-semibold ${checked ? 'text-white/60 line-through' : 'text-white'}`}>{s.label}</span>
                    {s.extra === 'na' && (
                      <button
                        onClick={() => setStep(s.key, { na: !st.na })}
                        className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded"
                        style={st.na ? { background: 'rgba(148,163,184,0.3)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
                      >N/A</button>
                    )}
                  </div>
                  {s.extra === 'url' && (
                    <input value={st.url || ''} onChange={(e) => setStep(s.key, { url: e.target.value })} placeholder={s.hint || 'Link'} className={`${inputCls} mt-2`} />
                  )}
                  {s.extra === 'date' && (
                    <input type="date" value={st.date || ''} onChange={(e) => setStep(s.key, { date: e.target.value })} className={`${inputCls} mt-2`} />
                  )}
                  <input value={st.note || ''} onChange={(e) => setStep(s.key, { note: e.target.value })} placeholder="Note (optional)" className={`${inputCls} mt-1.5`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Pricing & offer */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-3">Tier pricing & intro offer</div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/45">Tier</label>
                  <input value={data.pricing.tier} onChange={(e) => setPricing({ tier: e.target.value })} placeholder="e.g. Growth" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-white/45">Monthly</label>
                  <input value={data.pricing.monthly} onChange={(e) => setPricing({ monthly: e.target.value })} placeholder="e.g. $2,500/mo" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/45">Intro offer / special</label>
                <input value={data.pricing.introOffer} onChange={(e) => setPricing({ introOffer: e.target.value })} placeholder="e.g. First month 50% off + free landing page" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Ad budget & extra channels */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-1">Ad budget & extra channels</div>
            <p className="text-[10px] text-white/40 mb-3">Toggle on if there's extra budget/time for these.</p>
            <div className="flex flex-col gap-2">
              {CHANNELS.map((c) => {
                const st = data.channels[c.key] || { done: false };
                return (
                  <div key={c.key} className="flex items-center gap-2.5">
                    <button
                      onClick={() => setChannel(c.key, { done: !st.done })}
                      className="w-9 h-5 rounded-full shrink-0 relative transition-colors"
                      style={{ background: st.done ? '#10b981' : 'rgba(255,255,255,0.15)' }}
                    >
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: st.done ? 18 : 2 }} />
                    </button>
                    <span className="text-[12.5px] font-semibold text-white w-28 shrink-0">{c.label}</span>
                    <input value={st.note || ''} onChange={(e) => setChannel(c.key, { note: e.target.value })} placeholder="Budget / notes" className={inputCls} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Discovery */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>quiz</span>
            <div className="text-[13px] font-bold text-white">Discovery — questions to ask</div>
            <span className="text-[10px] text-white/35">{data.discovery.filter((x) => x.a.trim()).length}/{data.discovery.length} answered</span>
          </div>
          <div className="flex items-center gap-2">
            {data.discovery.length === 0 && (
              <button onClick={() => setData((d) => ({ ...d, discovery: seedDiscovery(clientId) }))}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white/80 hover:text-white">Load questions</button>
            )}
            <button onClick={() => setData((d) => ({ ...d, discovery: [...d.discovery, { q: '', a: '' }] }))}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white/80 hover:text-white inline-flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Add
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mb-3">Work through these on the discovery call and capture answers. Autosaves.</p>
        <div className="flex flex-col gap-2">
          {data.discovery.map((item, i) => (
            <div key={i} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-cyan-300/60 mt-1.5 w-5 shrink-0 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <input value={item.q} onChange={(e) => setData((d) => ({ ...d, discovery: d.discovery.map((x, j) => j === i ? { ...x, q: e.target.value } : x) }))} placeholder="Question" className={`${inputCls} font-semibold`} />
                  <textarea value={item.a} onChange={(e) => setData((d) => ({ ...d, discovery: d.discovery.map((x, j) => j === i ? { ...x, a: e.target.value } : x) }))} placeholder="Their answer…" rows={2} className={`${inputCls} mt-1.5`} />
                </div>
                <button onClick={() => setData((d) => ({ ...d, discovery: d.discovery.filter((_, j) => j !== i) }))} className="text-white/25 hover:text-rose-300 mt-1 shrink-0" title="Remove">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>help</span>
            <div className="text-[13px] font-bold text-white">FAQ — to go over with the client</div>
          </div>
          <button
            onClick={() => setData((d) => ({ ...d, qa: [...d.qa, { q: '', a: '' }] }))}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white/80 hover:text-white inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Add
          </button>
        </div>
        <p className="text-[10px] text-white/40 mb-3">Common questions + your answers to review with the client (process, approvals, timelines…).</p>
        {data.qa.length === 0 && <div className="text-[12px] text-white/35">No FAQs yet. Add anything the client commonly asks or that the team needs to confirm.</div>}
        <div className="flex flex-col gap-2.5">
          {data.qa.map((item, i) => (
            <div key={i} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input value={item.q} onChange={(e) => setData((d) => ({ ...d, qa: d.qa.map((x, j) => j === i ? { ...x, q: e.target.value } : x) }))} placeholder="Question" className={inputCls} />
                  <input value={item.a} onChange={(e) => setData((d) => ({ ...d, qa: d.qa.map((x, j) => j === i ? { ...x, a: e.target.value } : x) }))} placeholder="Answer" className={inputCls} />
                </div>
                <button onClick={() => setData((d) => ({ ...d, qa: d.qa.filter((_, j) => j !== i) }))} className="text-white/25 hover:text-rose-300 mt-1" title="Remove">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
