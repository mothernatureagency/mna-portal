'use client';

import React, { useEffect, useState } from 'react';
import type { Client, MetaAdsAccount } from '@/lib/clients';

/**
 * Meta Ads Account card — shows the client's Business Portfolio / ad account /
 * pixel, and lets staff edit it. The static config in lib/clients.ts is the
 * base; edits are stored per client in client_kv (key 'meta_ads') and merged
 * on top, so any client (including ones with no static metaAds) can have it.
 */
export default function MetaAdsCard({ client, accent }: { client: Client; accent?: string }) {
  const gradientFrom = accent || client.branding.gradientFrom;
  const [override, setOverride] = useState<Partial<MetaAdsAccount> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [isStaff, setIsStaff] = useState(true);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=meta_ads`)
      .then((r) => r.json())
      .then((d) => { if (!cancel && d && typeof d.value === 'object' && d.value) setOverride(d.value); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [client.id]);

  const base = (client.metaAds || {}) as Partial<MetaAdsAccount>;
  const m: Partial<MetaAdsAccount> = { ...base, ...(override || {}) };
  const hasAny = !!(m.businessPortfolioName || m.businessPortfolioId || m.adAccountId);

  function openEdit() {
    setForm({
      businessPortfolioName: m.businessPortfolioName || '',
      businessPortfolioId: m.businessPortfolioId || '',
      adAccountId: m.adAccountId || '',
      partnerName: m.partnerName || '',
      partnerAccessLevel: m.partnerAccessLevel || '',
      adminName: m.admin?.name || '',
      adminEmail: m.admin?.email || '',
      pixelName: m.datasetPixel?.name || '',
      pixelId: m.datasetPixel?.id || '',
      pixelStatus: m.datasetPixel?.status || '',
      verificationStatus: m.verificationStatus || '',
      createdDate: m.createdDate || '',
      notes: m.notes || '',
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const value: Partial<MetaAdsAccount> = {
      businessPortfolioName: form.businessPortfolioName || undefined,
      businessPortfolioId: form.businessPortfolioId || undefined,
      adAccountId: form.adAccountId || undefined,
      partnerName: form.partnerName || undefined,
      partnerAccessLevel: form.partnerAccessLevel || undefined,
      admin: (form.adminName || form.adminEmail) ? { name: form.adminName, email: form.adminEmail || undefined } : undefined,
      datasetPixel: (form.pixelName || form.pixelId) ? { name: form.pixelName, id: form.pixelId, status: form.pixelStatus || undefined } : undefined,
      verificationStatus: form.verificationStatus || undefined,
      createdDate: form.createdDate || undefined,
      notes: form.notes || undefined,
    } as any;
    try {
      const res = await fetch('/api/client-kv', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, key: 'meta_ads', value }),
      });
      if (res.status === 403) { setIsStaff(false); throw new Error('staff only'); }
      setOverride(value);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }

  const label = 'text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1';
  const inp = 'w-full text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30';

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pl-0.5">
        <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/40">Meta Ads Account</div>
        {isStaff && !editing && (
          <button onClick={openEdit} className="text-[11px] font-semibold text-white/50 hover:text-white inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            {hasAny ? 'Edit' : 'Add portfolio'}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="glass-card p-5" style={{ borderLeft: `3px solid ${gradientFrom}` }}>
          {!hasAny ? (
            <div className="text-[12px] text-white/50">No Meta Business Portfolio set. {isStaff && <button onClick={openEdit} className="text-white/80 underline">Add it</button>}</div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
              <div>
                <div className={label}>Business Portfolio</div>
                <div className="text-[14px] font-bold text-white">{m.businessPortfolioName || '—'}</div>
                {m.businessPortfolioId && <div className="text-[11px] text-white/70 font-mono">{m.businessPortfolioId}</div>}
                {m.verificationStatus && (
                  <span className={`mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${m.verificationStatus === 'Verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {m.verificationStatus}
                  </span>
                )}
              </div>
              <div>
                <div className={label}>Ad Account</div>
                <div className="text-[13px] font-bold text-white font-mono">{m.adAccountId || '—'}</div>
                {m.partnerName && <div className="text-[11px] text-white/70 mt-1">Partner: <span className="font-semibold text-white/85">{m.partnerName}</span></div>}
                {m.admin?.name && <div className="text-[11px] text-white/60 mt-0.5">Admin: {m.admin.name}</div>}
              </div>
              <div>
                <div className={label}>Pixel / Dataset</div>
                {m.datasetPixel?.name ? (
                  <>
                    <div className="text-[13px] font-bold text-white">{m.datasetPixel.name}</div>
                    {m.datasetPixel.id && <div className="text-[11px] text-white/60 font-mono">{m.datasetPixel.id}</div>}
                    {m.datasetPixel.status && <span className="mt-1 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">✓ {m.datasetPixel.status}</span>}
                  </>
                ) : <div className="text-[11px] text-white/40 italic">Not connected</div>}
              </div>
              {m.notes && <div className="col-span-3 mt-1 pt-3 border-t border-white/10 text-[11px] text-white/55 leading-relaxed">{m.notes}</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-5" style={{ borderLeft: `3px solid ${gradientFrom}` }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><div className={label}>Portfolio name</div><input className={inp} value={form.businessPortfolioName} onChange={(e) => setForm({ ...form, businessPortfolioName: e.target.value })} /></div>
            <div><div className={label}>Portfolio ID</div><input className={inp} value={form.businessPortfolioId} onChange={(e) => setForm({ ...form, businessPortfolioId: e.target.value })} /></div>
            <div><div className={label}>Ad account ID</div><input className={inp} value={form.adAccountId} onChange={(e) => setForm({ ...form, adAccountId: e.target.value })} /></div>
            <div><div className={label}>Partner name</div><input className={inp} value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} /></div>
            <div>
              <div className={label}>Access level</div>
              <select className={inp} value={form.partnerAccessLevel} onChange={(e) => setForm({ ...form, partnerAccessLevel: e.target.value })}>
                <option value="">—</option><option>Full control</option><option>Standard</option><option>Limited</option>
              </select>
            </div>
            <div>
              <div className={label}>Verification</div>
              <select className={inp} value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}>
                <option value="">—</option><option>Verified</option><option>Unverified</option><option>Pending</option>
              </select>
            </div>
            <div><div className={label}>Admin name</div><input className={inp} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></div>
            <div><div className={label}>Admin email</div><input className={inp} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></div>
            <div><div className={label}>Created date</div><input className={inp} value={form.createdDate} onChange={(e) => setForm({ ...form, createdDate: e.target.value })} placeholder="YYYY-MM-DD" /></div>
            <div><div className={label}>Pixel name</div><input className={inp} value={form.pixelName} onChange={(e) => setForm({ ...form, pixelName: e.target.value })} /></div>
            <div><div className={label}>Pixel ID</div><input className={inp} value={form.pixelId} onChange={(e) => setForm({ ...form, pixelId: e.target.value })} /></div>
            <div><div className={label}>Pixel status</div><input className={inp} value={form.pixelStatus} onChange={(e) => setForm({ ...form, pixelStatus: e.target.value })} placeholder="e.g. Receiving events" /></div>
          </div>
          <div className="mt-3"><div className={label}>Notes</div><textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={save} disabled={saving} className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${client.branding.gradientTo})` }}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/70 border border-white/10">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
