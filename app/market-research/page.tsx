'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type Target = {
  id: string;
  client_id: string;
  category: 'b2b' | 'gym' | 'urgent_care' | string;
  name: string;
  address: string | null;
  phone: string | null;
  place_id: string | null;
  maps_uri: string | null;
  status: string;
  notes: string | null;
};

const CATEGORIES: { key: string; label: string; icon: string; discoverable: boolean }[] = [
  { key: 'b2b', label: 'B2B Partners', icon: 'handshake', discoverable: true },
  { key: 'gym', label: 'Gyms & Fitness', icon: 'fitness_center', discoverable: true },
  { key: 'urgent_care', label: 'Urgent Cares', icon: 'local_hospital', discoverable: true },
];

const STATUSES: { key: string; label: string; color: string }[] = [
  { key: 'to_contact', label: 'To contact', color: '#94a3b8' },
  { key: 'contacted', label: 'Contacted', color: '#f59e0b' },
  { key: 'partnered', label: 'Partnered', color: '#10b981' },
  { key: 'passed', label: 'Passed', color: '#64748b' },
];

const DEFAULT_TEMPLATE = `Hi [Name],

I'm with {client} here in {location}. We work with local businesses and their teams on wellness — IV hydration, recovery, and immune support — and I'd love to set up a simple partnership: a member perk for your clients and a way to take care of your staff.

Could I drop off a few details this week, or is there a better person to talk to?

Thanks so much,
[Your name] · {client}`;

export default function MarketResearchPage() {
  const { activeClient } = useClient();
  const clientId = activeClient?.id;
  const location = (activeClient as any)?.location || '';

  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  // Editable search address — where "Find nearby" looks. Defaults to the
  // client's location, persisted per client so it sticks.
  const [searchLocation, setSearchLocation] = useState('');
  // Income / population lookup (US Census)
  const [zipInput, setZipInput] = useState('');
  const [areas, setAreas] = useState<{ zip: string; name: string | null; income: number | null; population: number | null }[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoSource, setDemoSource] = useState('');

  async function load() {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market-research?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      setTargets(data.targets || []);
    } catch {} finally { setLoading(false); }
  }
  async function loadTemplate() {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=outreach_template`);
      const data = await res.json();
      setTemplate(typeof data.value === 'string' && data.value ? data.value : DEFAULT_TEMPLATE);
    } catch { setTemplate(DEFAULT_TEMPLATE); }
  }
  async function loadSearchLocation() {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=market_location`);
      const data = await res.json();
      setSearchLocation(typeof data.value === 'string' && data.value ? data.value : (location || ''));
    } catch { setSearchLocation(location || ''); }
  }
  function saveSearchLocation() {
    if (!clientId) return;
    fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'market_location', value: searchLocation }),
    }).catch(() => {});
  }
  useEffect(() => { load(); loadTemplate(); loadSearchLocation(); /* eslint-disable-next-line */ }, [clientId]);

  async function saveTemplate() {
    if (!clientId) return;
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, key: 'outreach_template', value: template }),
    });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 1500);
  }

  async function discover(category: string) {
    if (!clientId) return;
    setDiscovering(category); setMsg('');
    try {
      const res = await fetch('/api/market-research/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, location: searchLocation || location, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');
      setMsg(`Added ${data.added} new ${CATEGORIES.find((c) => c.key === category)?.label || category}${data.added === 1 ? '' : ''}.`);
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setDiscovering(null); }
  }

  async function addManual(category: string) {
    const name = (newName[category] || '').trim();
    if (!name || !clientId) return;
    await fetch('/api/market-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, category, name }),
    });
    setNewName((s) => ({ ...s, [category]: '' }));
    load();
  }

  async function setStatus(id: string, status: string) {
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch('/api/market-research', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  }
  async function remove(id: string) {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/market-research?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  function useTargetZips() {
    const zips = Array.from(new Set(
      targets.map((t) => (t.address || '').match(/\b\d{5}\b/)?.[0]).filter(Boolean) as string[],
    ));
    setZipInput(zips.join(', '));
  }

  async function lookupDemographics() {
    const zips = Array.from(new Set((zipInput.match(/\d{5}/g) || [])));
    if (zips.length === 0) { setMsg('Enter at least one 5-digit ZIP code.'); return; }
    setDemoLoading(true); setMsg('');
    try {
      const res = await fetch('/api/market-research/demographics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zips }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setAreas(data.areas || []);
      setDemoSource(data.source || '');
    } catch (e: any) { setMsg(e.message); } finally { setDemoLoading(false); }
  }

  const byCat = useMemo(() => {
    const m: Record<string, Target[]> = {};
    for (const c of CATEGORIES) m[c.key] = [];
    for (const t of targets) (m[t.category] ||= []).push(t);
    return m;
  }, [targets]);

  const filledTemplate = template
    .replace(/\{client\}/g, activeClient?.shortName || 'us')
    .replace(/\{location\}/g, location || 'your area');

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>travel_explore</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Market Research</h1>
          </div>
          <p className="text-white/60 mt-1 text-sm">
            Local B2B, gyms, and urgent cares near <b className="text-white/80">{activeClient?.shortName}</b> · outreach targets within ~15 miles.
          </p>
        </div>
      </div>

      {/* Search address */}
      <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="material-symbols-outlined text-cyan-400 shrink-0" style={{ fontSize: 18 }}>location_on</span>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-0.5">Search location</div>
          <input
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            onBlur={saveSearchLocation}
            placeholder="e.g. 123 Main St, Niceville FL 32578  (or just a city/ZIP)"
            className="w-full text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30"
          />
        </div>
        <div className="text-[10px] text-white/40 sm:max-w-[220px]">“Find nearby” searches around this address. Saved per location.</div>
      </div>

      {msg && <div className="text-[12px] text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2">{msg}</div>}

      {/* Outreach template */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">Outreach template</div>
          <div className="flex items-center gap-2">
            {templateSaved && <span className="text-[11px] text-emerald-300">Saved</span>}
            <button onClick={saveTemplate} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>Save</button>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mb-2">Use <code className="text-white/60">{'{client}'}</code> and <code className="text-white/60">{'{location}'}</code> — they auto-fill. <code className="text-white/60">[Name]</code> / <code className="text-white/60">[Your name]</code> are yours to fill per message.</p>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={7}
          className="w-full text-[13px] rounded-xl p-3 text-white/85 outline-none leading-relaxed"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <div className="mt-2">
          <button
            onClick={() => { navigator.clipboard?.writeText(filledTemplate); setMsg('Outreach message copied to clipboard.'); }}
            className="text-[11px] font-semibold text-white/60 hover:text-white inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
            Copy filled message
          </button>
        </div>
      </div>

      {/* Income / population — top neighborhoods to target */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/55">Income & population — top areas to target</div>
          {demoSource && <span className="text-[10px] text-white/35">{demoSource}</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookupDemographics(); }}
            placeholder="ZIP codes, comma-separated  (e.g. 32578, 32541, 32547)"
            className="flex-1 text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30"
          />
          <button onClick={useTargetZips} className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:text-white border border-white/10">Use ZIPs from my targets</button>
          <button onClick={lookupDemographics} disabled={demoLoading} className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
            {demoLoading ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        {areas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {areas.map((a, i) => (
              <div key={a.zip} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: i < 3 ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.22)', border: `1px solid ${i < 3 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                {i < 3 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-white shrink-0">TOP {i + 1}</span>}
                <div className="text-[13px] font-bold text-white w-16 shrink-0">{a.zip}</div>
                <div className="flex-1 flex items-center gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40">Median income</div>
                    <div className="text-[13px] font-bold text-white">{a.income != null ? `$${a.income.toLocaleString()}` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40">Population</div>
                    <div className="text-[13px] font-bold text-white">{a.population != null ? a.population.toLocaleString() : '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const list = byCat[cat.key] || [];
          return (
            <div key={cat.key} className="rounded-2xl p-4 flex flex-col" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span className="text-[13px] font-bold text-white">{cat.label}</span>
                  <span className="text-[10px] text-white/35">{list.length}</span>
                </div>
                <button
                  onClick={() => discover(cat.key)}
                  disabled={discovering === cat.key || !searchLocation.trim()}
                  title={searchLocation.trim() ? 'Find nearby via Google' : 'Enter a search location above first'}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-40 inline-flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{discovering === cat.key ? 'hourglass_top' : 'search'}</span>
                  {discovering === cat.key ? 'Finding…' : 'Find nearby'}
                </button>
              </div>

              {/* Manual add */}
              <div className="flex gap-1.5 mb-3">
                <input
                  value={newName[cat.key] || ''}
                  onChange={(e) => setNewName((s) => ({ ...s, [cat.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addManual(cat.key); }}
                  placeholder="Add manually…"
                  className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30"
                />
                <button onClick={() => addManual(cat.key)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white">Add</button>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 480 }}>
                {loading && <div className="text-[12px] text-white/35">Loading…</div>}
                {!loading && list.length === 0 && <div className="text-[12px] text-white/35 py-2">None yet — hit “Find nearby” or add manually.</div>}
                {list.map((t) => {
                  const st = STATUSES.find((s) => s.key === t.status) || STATUSES[0];
                  return (
                    <div key={t.id} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-white leading-tight">{t.name}</div>
                          {t.address && <div className="text-[10px] text-white/45 mt-0.5">{t.address}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            {t.phone && <a href={`tel:${t.phone}`} className="text-[10px] text-cyan-300 hover:underline">{t.phone}</a>}
                            {t.maps_uri && <a href={t.maps_uri} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 hover:text-white inline-flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>map</span>Map</a>}
                          </div>
                        </div>
                        <button onClick={() => remove(t.id)} className="text-white/25 hover:text-rose-300 shrink-0" title="Remove">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {STATUSES.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setStatus(t.id, s.key)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={t.status === s.key
                              ? { background: s.color, color: '#fff' }
                              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
