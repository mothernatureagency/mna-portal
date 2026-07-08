'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { STAFF } from '@/lib/staff';

type Assignment = { staff_email: string; client_id: string };

const OWNER_EMAIL = 'mn@mothernatureagency.com';
const STAFF_COLORS: Record<string, string> = {
  'admin@mothernatureagency.com': '#0ea5e9',
  'info@mothernatureagency.com': '#f59e0b',
};
function colorFor(email: string) {
  return STAFF_COLORS[email.toLowerCase()] || '#7c3aed';
}
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
  const roster = useMemo(() => STAFF.filter((s) => s.email.toLowerCase() !== OWNER_EMAIL), []);
  const clients = useMemo(() => allClients.filter((c) => c.id !== 'mna'), [allClients]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/staff-assignments');
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 20 }}>groups</span>
          <div>
            <h3 className="text-[15px] font-bold text-white">Team Assignments</h3>
            <p className="text-[11px] text-white/40 mt-0.5">Tap a name to assign or unassign it from a client.</p>
          </div>
        </div>
      </div>

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
