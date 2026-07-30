'use client';

import React, { useEffect, useState } from 'react';
import type { Client } from '@/lib/clients';

type Stat = { value: string; target: string; note: string };
type Stats = Record<string, Stat>;

const METRICS: { key: string; label: string; color: string }[] = [
  { key: 'leads', label: 'Total Leads', color: '#0ea5e9' },
  { key: 'cpl', label: 'Cost Per Lead', color: '#6366f1' },
  { key: 'conv', label: 'Conversion Rate', color: '#8b5cf6' },
  { key: 'adSpend', label: 'Ad Spend', color: '#f59e0b' },
  { key: 'appts', label: 'Appointments', color: '#ec4899' },
  { key: 'revenue', label: 'Revenue', color: '#06b6d4' },
];

/**
 * Editable KPI stats for a client's dashboard. Values persist per client in
 * client_kv (key 'dashboard_stats'); `defaults` seed the display until real
 * numbers are entered. Staff-only editing (client-kv rejects client writes).
 */
export default function DashboardStats({ client, defaults }: { client: Client; defaults: Stats }) {
  const { gradientFrom, gradientTo } = client.branding;
  const [stats, setStats] = useState<Stats>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Stats>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/client-kv?clientId=${encodeURIComponent(client.id)}&key=dashboard_stats`)
      .then((r) => r.json())
      .then((d) => { if (!cancel && d && typeof d.value === 'object' && d.value) setStats(d.value); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [client.id]);

  const val = (k: string): Stat => ({ ...(defaults[k] || { value: '', target: '', note: '' }), ...(stats[k] || {}) });

  function openEdit() {
    const d: Stats = {};
    for (const m of METRICS) d[m.key] = val(m.key);
    setDraft(d);
    setEditing(true);
  }
  async function save() {
    setSaving(true);
    try {
      await fetch('/api/client-kv', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, key: 'dashboard_stats', value: draft }),
      });
      setStats(draft);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }
  const setD = (k: string, patch: Partial<Stat>) => setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }));

  const inp = 'w-full text-[13px] px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 outline-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-300 pl-0.5">Key Metrics</div>
        {!editing ? (
          <button onClick={openEdit} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span> Edit stats
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-gray-500 border border-gray-200">Cancel</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {METRICS.map((m, i) => {
          const s = editing ? (draft[m.key] || { value: '', target: '', note: '' }) : val(m.key);
          const hero = i === 0;
          if (editing) {
            return (
              <div key={m.key} className="glass-card p-4">
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-2">{m.label}</div>
                <div className="flex flex-col gap-1.5">
                  <input className={inp} value={s.value} onChange={(e) => setD(m.key, { value: e.target.value })} placeholder="Value (e.g. 464 or $72.99K)" />
                  <input className={inp} value={s.target} onChange={(e) => setD(m.key, { target: e.target.value })} placeholder="Target (e.g. 280)" />
                  <input className={inp} value={s.note} onChange={(e) => setD(m.key, { note: e.target.value })} placeholder="Note (e.g. +18% vs last month)" />
                </div>
              </div>
            );
          }
          return (
            <div key={m.key}
              className={hero ? 'rounded-[20px] p-6 text-white relative overflow-hidden' : 'glass-card p-5 relative overflow-hidden'}
              style={hero ? { background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` } : undefined}>
              {!hero && <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px]" style={{ background: m.color }} />}
              <span className={`text-[10px] font-bold uppercase ${hero ? 'opacity-85' : 'text-gray-400'}`}>{m.label}</span>
              <div className={`${hero ? 'text-[44px]' : 'text-[30px]'} font-black leading-none my-2 ${hero ? '' : 'text-gray-900'}`}>{s.value || '—'}</div>
              <div className={`text-[11px] mb-2 ${hero ? 'opacity-70' : 'text-gray-400'}`}>{s.target ? `Target: ${s.target}` : ' '}</div>
              {s.note && <div className={`text-[11px] font-bold ${hero ? '' : ''}`} style={hero ? undefined : { color: m.color }}>{s.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
