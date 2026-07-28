'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { STAFF } from '@/lib/staff';

type Assignment = { staff_email: string; client_id: string };
type Member = { email: string; name: string; role?: string; color?: string; custom?: boolean };

const OWNER_EMAIL = 'mn@mothernatureagency.com';
const STAFF_COLORS: Record<string, string> = {
  'admin@mothernatureagency.com': '#0ea5e9',
  'info@mothernatureagency.com': '#f59e0b',
};
function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Team assignments — who works on which client. Shown on the owner's home
 * dashboard; toggling a staff chip assigns/unassigns them (persisted to
 * /api/staff-assignments). Owner is excluded (she sees everything).
 */
export default function StaffAssignments() {
  const { allClients } = useClient();
  const clients = useMemo(() => allClients.filter((c) => c.id !== 'mna'), [allClients]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [custom, setCustom] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-teammate form
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nRole, setNRole] = useState('');
  const [err, setErr] = useState('');

  // Built-in staff (minus owner) + custom teammates, de-duped by email.
  const roster = useMemo<Member[]>(() => {
    const base: Member[] = STAFF
      .filter((s) => s.email.toLowerCase() !== OWNER_EMAIL)
      .map((s) => ({ email: s.email, name: s.name, role: s.role }));
    const seen = new Set(base.map((m) => m.email.toLowerCase()));
    for (const c of custom) {
      if (!seen.has(c.email.toLowerCase())) base.push({ ...c, custom: true });
    }
    return base;
  }, [custom]);

  function colorFor(email: string) {
    const c = custom.find((m) => m.email.toLowerCase() === email.toLowerCase());
    return c?.color || STAFF_COLORS[email.toLowerCase()] || '#7c3aed';
  }

  async function load() {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('/api/staff-assignments').then((r) => r.json()),
        fetch('/api/staff').then((r) => r.json()),
      ]);
      setAssignments(aRes.assignments || []);
      setCustom((sRes.staff || []).map((s: any) => ({ email: s.email, name: s.name, role: s.role, color: s.color, custom: true })));
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addTeammate() {
    const name = nName.trim(); const email = nEmail.trim();
    if (!name || !email) { setErr('Name and email required.'); return; }
    setErr('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role: nRole.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not add');
      setCustom((prev) => [...prev.filter((m) => m.email.toLowerCase() !== email.toLowerCase()), { email: d.member.email, name: d.member.name, role: d.member.role, color: d.member.color, custom: true }]);
      setNName(''); setNEmail(''); setNRole(''); setAdding(false);
    } catch (e: any) { setErr(e.message); }
  }

  async function removeTeammate(email: string, name: string) {
    if (!confirm(`Remove ${name} from the team roster? Their client assignments are cleared too.`)) return;
    setCustom((prev) => prev.filter((m) => m.email.toLowerCase() !== email.toLowerCase()));
    setAssignments((prev) => prev.filter((a) => a.staff_email.toLowerCase() !== email.toLowerCase()));
    try { await fetch(`/api/staff?email=${encodeURIComponent(email)}`, { method: 'DELETE' }); } catch {}
  }

  const isAssigned = (email: string, clientId: string) =>
    assignments.some((a) => a.staff_email.toLowerCase() === email.toLowerCase() && a.client_id === clientId);

  async function toggle(email: string, clientId: string) {
    const on = isAssigned(email, clientId);
    // Optimistic update
    setAssignments((prev) =>
      on
        ? prev.filter((a) => !(a.staff_email.toLowerCase() === email.toLowerCase() && a.client_id === clientId))
        : [...prev, { staff_email: email.toLowerCase(), client_id: clientId }],
    );
    try {
      if (on) {
        await fetch(`/api/staff-assignments?staffEmail=${encodeURIComponent(email)}&clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/staff-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffEmail: email, clientId }),
        });
      }
    } catch { load(); }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 20 }}>groups</span>
          <div>
            <h3 className="text-[15px] font-bold text-white">Team Assignments</h3>
            <p className="text-[11px] text-white/40 mt-0.5">Tap a name to assign or unassign it from a client.</p>
          </div>
        </div>
        <button onClick={() => { setAdding((s) => !s); setErr(''); }}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white inline-flex items-center gap-1 shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person_add</span>
          Add teammate
        </button>
      </div>

      {/* Add teammate form */}
      {adding && (
        <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Name"
              className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
            <input value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="email@mothernatureagency.com"
              className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
            <input value={nRole} onChange={(e) => setNRole(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTeammate(); }} placeholder="Role (optional)"
              className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
          </div>
          {err && <div className="text-[11px] text-rose-300 mt-1.5">{err}</div>}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={addTeammate} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>Add</button>
            <button onClick={() => { setAdding(false); setErr(''); }} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 border border-white/10">Cancel</button>
          </div>
        </div>
      )}

      {/* Roster — custom teammates can be removed */}
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {custom.map((m) => (
            <span key={m.email} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: (m.color || '#7c3aed') + '22', color: m.color || '#c4b5fd', border: `1px solid ${(m.color || '#7c3aed')}44` }}>
              {m.name}
              <button onClick={() => removeTeammate(m.email, m.name)} title="Remove teammate" className="opacity-70 hover:opacity-100">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
              </button>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-white/40 py-3">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="text-[12px] text-white/40 py-3">No clients yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c) => {
            const assigned = roster.filter((m) => isAssigned(m.email, c.id));
            return (
              <div key={c.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[12px] font-extrabold shrink-0"
                       style={{ background: `linear-gradient(135deg, ${c.branding.gradientFrom}, ${c.branding.gradientTo})` }}>
                    {c.shortName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-white truncate">{c.name}</div>
                    <div className="text-[10px] text-white/40">
                      {assigned.length === 0 ? 'Unassigned' : `${assigned.length} assigned`}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roster.map((m) => {
                    const on = isAssigned(m.email, c.id);
                    const color = colorFor(m.email);
                    return (
                      <button
                        key={m.email}
                        onClick={() => toggle(m.email, c.id)}
                        title={`${m.name} · ${m.role}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={
                          on
                            ? { background: color, color: '#fff', boxShadow: `0 2px 6px ${color}40` }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }
                        }
                      >
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-extrabold"
                          style={on ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: color + '33', color }}
                        >
                          {initials(m.name)}
                        </span>
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
