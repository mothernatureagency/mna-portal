'use client';

import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';

/**
 * Per-location knowledge base — pricing tiers + the key facts the AI responders
 * (Google reviews, Revive/GHL CRM, Call Copilot) draw on. Fill it once per
 * location; it saves to client_kv 'knowledge_base'.
 */

type Tier = { name: string; price: string; includes: string };
type KB = {
  tiers: Tier[];
  hours: string;
  latestBooking: string;
  services: string;
  addons: string;
  policy: string;
  notes: string;
};

const BASELINE: KB = {
  tiers: [
    { name: 'Tier 1 — Essential', price: '', includes: 'Core hydration bag with a base vitamin + electrolyte blend. Everyday pick.' },
    { name: 'Tier 2 — Enhanced', price: '', includes: 'Larger bag with added vitamins, antioxidants, and an amino / B-complex boost.' },
    { name: 'Tier 3 — Premium', price: '', includes: 'Top-tier blend — high-dose glutathione / NAD+ / specialty add-ins.' },
  ],
  hours: '',
  latestBooking: '',
  services: '',
  addons: '',
  policy: '',
  notes: '',
};

export default function KnowledgePage() {
  const { activeClient } = useClient();
  const clientId = activeClient?.id;

  const [kb, setKb] = useState<KB>(BASELINE);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoaded(false);
    fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=knowledge_base`)
      .then((r) => r.json())
      .then((d) => {
        const v = d?.value;
        if (v && typeof v === 'object' && Array.isArray(v.tiers)) setKb({ ...BASELINE, ...v, tiers: v.tiers.length ? v.tiers : BASELINE.tiers });
        else setKb(BASELINE);
      })
      .catch(() => setKb(BASELINE))
      .finally(() => setLoaded(true));
  }, [clientId]);

  function setTier(i: number, patch: Partial<Tier>) {
    setKb((k) => ({ ...k, tiers: k.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }
  function addTier() { setKb((k) => ({ ...k, tiers: [...k.tiers, { name: `Tier ${k.tiers.length + 1}`, price: '', includes: '' }] })); }
  function removeTier(i: number) { setKb((k) => ({ ...k, tiers: k.tiers.filter((_, j) => j !== i) })); }

  async function save() {
    if (!clientId) return;
    setSaving(true);
    try {
      await fetch('/api/client-kv', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, key: 'knowledge_base', value: kb }) });
      setSaved(true); setTimeout(() => setSaved(false), 1600);
    } finally { setSaving(false); }
  }

  const field = 'w-full text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30';

  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>menu_book</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pricing &amp; Info</h1>
        </div>
        <p className="text-white/60 mt-1 text-sm">
          The facts for <b className="text-white/80">{activeClient?.shortName}</b> that the AI responders use — Google reviews, the CRM chat, and Call Copilot. Fill it once; edit anytime.
        </p>
      </div>

      {!loaded ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <>
          {/* Pricing tiers */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">Pricing tiers</div>
              <button onClick={addTier} className="text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200">+ Add tier</button>
            </div>
            <div className="flex flex-col gap-3">
              {kb.tiers.map((t, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-2 mb-2">
                    <input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} placeholder="Tier name" className={field + ' flex-1'} />
                    <input value={t.price} onChange={(e) => setTier(i, { price: e.target.value })} placeholder="Price (e.g. $109)" className={field + ' w-40'} />
                    <button onClick={() => removeTier(i)} className="text-white/30 hover:text-rose-300 px-2" title="Remove tier">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  </div>
                  <textarea value={t.includes} onChange={(e) => setTier(i, { includes: e.target.value })} rows={2} placeholder="What's included / good for…" className={field} />
                </div>
              ))}
            </div>
          </div>

          {/* Booking + hours */}
          <div className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Hours of operation</span>
              <textarea value={kb.hours} onChange={(e) => setKb({ ...kb, hours: e.target.value })} rows={3} placeholder="Mon–Fri 9a–7p, Sat 9a–4p, Sun closed" className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Latest time to book</span>
              <textarea value={kb.latestBooking} onChange={(e) => setKb({ ...kb, latestBooking: e.target.value })} rows={3} placeholder="Last appointment 1 hour before close; same-day OK until 2 slots remain" className={field} />
            </label>
          </div>

          {/* Services + more */}
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { k: 'services' as const, label: 'Services offered', ph: 'IV drips, IM shots (B12, lipo), NAD+, peptides…' },
              { k: 'addons' as const, label: 'Add-ons & memberships', ph: 'Vitamin boosters $X each; membership $Y/mo includes…' },
              { k: 'policy' as const, label: 'Cancellation / booking policy', ph: '24-hr cancellation; deposit required for…' },
              { k: 'notes' as const, label: 'Other FAQ / notes for the AI', ph: 'Medical director on staff; walk-ins welcome; parking in rear…' },
            ].map((f) => (
              <label key={f.k} className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{f.label}</span>
                <textarea value={kb[f.k]} onChange={(e) => setKb({ ...kb, [f.k]: e.target.value })} rows={2} placeholder={f.ph} className={field} />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="text-[13px] font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-[12px] text-emerald-300">Saved ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}
