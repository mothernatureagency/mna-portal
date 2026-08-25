'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { makePrimeIVClient, makeCustomClient } from '@/lib/clients';
import { Building2, Globe, Plus, MapPin, Trash2 } from 'lucide-react';

export default function ClientsPage() {
  const { allClients, activeClient, setActiveClientId, refreshClients } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  // Add-a-Prime-IV-location form (name only — the rest is generated).
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [logoUrl, setLogoUrl] = useState('');       // logo for the new location
  const [kind, setKind] = useState<'prime-iv' | 'other'>('prime-iv');
  const [industry, setIndustry] = useState('');
  const [brandFrom, setBrandFrom] = useState('#0d6e7a');
  const [brandTo, setBrandTo] = useState('#35c4d6');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoBusyId, setLogoBusyId] = useState<string | null>(null); // per-card logo upload
  const formRef = useRef<HTMLDivElement>(null);
  const formLogoInput = useRef<HTMLInputElement>(null);

  async function loadCustom() {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setCustomIds(new Set((data.items || []).map((r: any) => r.id)));
    } catch {}
  }
  useEffect(() => { loadCustom(); }, []);

  // Upload an image and return its hosted URL (reuses the content uploader).
  async function uploadImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) { setError('Logo must be an image file.'); return null; }
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/content-calendar/upload', { method: 'POST', body: fd });
    const ct = res.headers.get('content-type') || '';
    if (res.redirected || !ct.includes('application/json')) { setError('Session may have expired — refresh and try again.'); return null; }
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Logo upload failed'); return null; }
    return data.url as string;
  }

  async function onPickFormLogo(file: File) {
    setUploadingLogo(true); setError('');
    try { const url = await uploadImageFile(file); if (url) setLogoUrl(url); }
    finally { setUploadingLogo(false); }
  }

  // Set/replace the logo on an existing custom location.
  async function changeClientLogo(id: string, file: File) {
    setLogoBusyId(id); setError('');
    try {
      const url = await uploadImageFile(file);
      if (!url) return;
      await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, logoUrl: url }),
      });
      refreshClients();
    } finally { setLogoBusyId(null); }
  }

  function openForm() {
    setAdding(true);
    setError('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }

  const preview = name.trim()
    ? (kind === 'other'
        ? makeCustomClient({ name: name.trim(), industry: industry || 'Business', brandFrom, brandTo })
        : makePrimeIVClient({ name: name.trim() }))
    : null;

  async function addClient() {
    const n = name.trim();
    if (!n) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: n,
          logoUrl: logoUrl || undefined,
          ...(kind === 'other' ? { industry: industry || undefined, brandFrom, brandTo } : {}),
        }),
        cache: 'no-store',
      });
      // If the session lapsed, the request is redirected to /login and comes
      // back as HTML — surface that clearly instead of failing silently.
      const ct = res.headers.get('content-type') || '';
      if (res.redirected || !ct.includes('application/json')) {
        throw new Error('Your session may have expired. Refresh the page, sign in, and try again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add client');
      setName('');
      setLogoUrl('');
      setAdding(false);
      await loadCustom();
      refreshClients();
      if (data.client?.id) setActiveClientId(data.client.id);
    } catch (e: any) {
      setError(e.message || 'Could not add client');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Jump into this client's portal with the Sharing & access panel open, so
   * staff can curate pages/sections and edit content from the admin side.
   */
  function openPortalSharing(clientId: string) {
    document.cookie = `mna_portal_client=${clientId};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.href = '/client?share=1';
  }

  async function removeClient(id: string, label: string) {
    if (!confirm(`Remove ${label} from the client list? Content already created for it stays in the database.`)) return;
    try {
      await fetch(`/api/clients?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadCustom();
      refreshClients();
      if (activeClient.id === id) setActiveClientId('mna');
    } catch {}
  }

  return (
    <div className="space-y-7 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1.5 h-6 rounded-full"
              style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }}
            />
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Clients</h1>
          </div>
          <p className="text-[12px] text-gray-400 pl-3.5">Manage accounts, branding, and KPI targets</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            boxShadow: `0 2px 8px ${gradientFrom}45`,
          }}
        >
          <Plus size={14} /> Add Client
        </button>
      </div>

      {/* Add a Prime IV location — name only */}
      {adding && (
        <div ref={formRef} className="bg-white rounded-[20px] p-6" style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-gray-900">Add a client</h3>
            <button onClick={() => { setAdding(false); setName(''); setError(''); }} className="text-[12px] text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          {/* Type toggle */}
          <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 mb-3">
            <button onClick={() => setKind('prime-iv')} className={`text-[12px] font-semibold px-3 py-1.5 ${kind === 'prime-iv' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>Prime IV location</button>
            <button onClick={() => setKind('other')} className={`text-[12px] font-semibold px-3 py-1.5 ${kind === 'other' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>Other business</button>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">
            {kind === 'prime-iv'
              ? 'Just type the location name — branding, KPIs, and links come from the Prime IV template.'
              : 'Enter the business name, its industry, and pick its brand colors.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addClient(); }}
              placeholder={kind === 'prime-iv' ? 'e.g. "Destin" or "Prime IV — Fort Walton Beach"' : 'e.g. "Vortex Spring"'}
              className="flex-1 text-[13px] px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 outline-none focus:border-gray-300 placeholder:text-gray-300"
            />
            <button
              onClick={addClient}
              disabled={busy || !name.trim()}
              className="text-[13px] font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #1c3d6e, #3a7ab5)' }}
            >
              <Plus size={16} /> {busy ? 'Adding…' : 'Add client'}
            </button>
          </div>

          {kind === 'other' && (
            <div className="flex flex-col sm:flex-row gap-3 mt-3 items-start sm:items-center">
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry — e.g. Campground & Springs · Events"
                className="flex-1 text-[13px] px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 outline-none focus:border-gray-300 placeholder:text-gray-300"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Brand</span>
                <input type="color" value={brandFrom} onChange={(e) => setBrandFrom(e.target.value)} title="Primary color" className="w-8 h-8 rounded-lg border border-gray-200 bg-white cursor-pointer" />
                <input type="color" value={brandTo} onChange={(e) => setBrandTo(e.target.value)} title="Accent color" className="w-8 h-8 rounded-lg border border-gray-200 bg-white cursor-pointer" />
                <span className="w-16 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${brandFrom}, ${brandTo})` }} />
              </div>
            </div>
          )}

          {/* Optional logo */}
          <div className="flex items-center gap-3 mt-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-gray-300" style={{ fontSize: 22 }}>image</span>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => formLogoInput.current?.click()}
                disabled={uploadingLogo}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo (optional)'}
              </button>
              <div className="text-[10px] text-gray-400 mt-1">PNG or SVG. Defaults to the Prime IV logo if left blank.</div>
            </div>
            <input ref={formLogoInput} type="file" accept="image/*" className="hidden"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFormLogo(f); e.target.value = ''; }} />
          </div>

          {preview && (
            <div className="text-[11px] text-gray-400 mt-2">
              Will create: <span className="text-gray-700 font-semibold">{preview.name}</span>
            </div>
          )}
          {error && <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5 mt-2">{error}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {allClients.map(client => {
          const isActive = activeClient.id === client.id;
          const clientWithMeta = client as typeof client & { location?: string };
          return (
            <div
              key={client.id}
              className="bg-white rounded-[20px] overflow-hidden transition-all duration-200 hover:-translate-y-[1px]"
              style={{
                border: isActive
                  ? `1.5px solid ${client.branding.primaryColor}35`
                  : '1px solid rgba(0,0,0,0.05)',
                boxShadow: isActive
                  ? `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px ${client.branding.primaryColor}15`
                  : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px rgba(12,109,164,0.05)',
              }}
            >
              {/* Top gradient band */}
              <div
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
              />

              <div className="p-6">
                {/* Client header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shadow-md flex-shrink-0 overflow-hidden"
                    style={client.branding.logoUrl
                      ? { background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }
                      : { background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
                  >
                    {client.branding.logoUrl
                      ? <img src={client.branding.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                      : client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[16px] font-bold text-gray-900 tracking-tight truncate">{client.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Building2 size={10} /> {client.industry}
                      </span>
                      {clientWithMeta.location && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {clientWithMeta.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
                    >
                      Active
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-gray-500 leading-relaxed mb-5">{client.notes}</p>

                {/* KPI targets */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {[
                    { label: 'Lead Target', value: client.kpiTargets.leads.toString() },
                    { label: 'CPL Target', value: `$${client.kpiTargets.costPerLead}` },
                    { label: 'Conv. Rate', value: `${client.kpiTargets.conversionRate}%` },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="text-center p-2.5 rounded-2xl"
                      style={{ background: `${client.branding.primaryColor}08`, border: `1px solid ${client.branding.primaryColor}12` }}
                    >
                      <div
                        className="text-[16px] font-extrabold"
                        style={{ color: client.branding.primaryColor }}
                      >
                        {value}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Integrations */}
                <div className="mb-5">
                  <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-300 mb-2">Integrations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {client.integrations.map(int => (
                      <span
                        key={int}
                        className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.04)', color: '#6b7280' }}
                      >
                        <Globe size={9} /> {int}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 pt-4"
                  style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
                >
                  <button
                    onClick={() => setActiveClientId(client.id)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:scale-[1.01]"
                    style={{
                      background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})`,
                      boxShadow: `0 2px 8px ${client.branding.primaryColor}35`,
                      opacity: isActive ? 0.7 : 1,
                    }}
                  >
                    {isActive ? '✓ Viewing Now' : 'Switch to Client'}
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    Edit
                  </button>
                  {customIds.has(client.id) && (
                    <label
                      title="Set or replace this location's logo"
                      className="px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1"
                      style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image</span>
                      {logoBusyId === client.id ? 'Uploading…' : 'Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) changeClientLogo(client.id, f); e.target.value = ''; }}
                      />
                    </label>
                  )}
                  {customIds.has(client.id) && (
                    <button
                      onClick={() => removeClient(client.id, client.name)}
                      title="Remove this location"
                      className="px-3 py-2 rounded-xl text-[12px] font-semibold text-rose-500 transition-colors hover:bg-rose-50"
                      style={{ border: '1px solid rgba(244,63,94,0.2)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Client placeholder */}
        <div
          onClick={openForm}
          className="rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group min-h-[220px] hover:-translate-y-[1px]"
          style={{
            border: '1.5px dashed rgba(0,0,0,0.1)',
            background: 'rgba(248,250,252,0.5)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center group-hover:border-gray-300 transition-colors"
          >
            <Plus size={20} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="text-center">
            <div className="text-[14px] font-semibold text-gray-400 group-hover:text-gray-600 transition-colors">
              Add New Client
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              Configure branding, KPIs, and integrations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
