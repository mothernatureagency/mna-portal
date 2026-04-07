'use client';
import React from 'react';

type TeamMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  clients: number;
  leadsClosed: number;
  revenue: number;
  status: 'online' | 'away' | 'offline';
};

const TEAM: TeamMember[] = [
  { id: '1', name: 'Alexus Williams', role: 'Agency Owner', initials: 'AW', clients: 12, leadsClosed: 48, revenue: 184200, status: 'online' },
  { id: '2', name: 'Jordan Reyes', role: 'Account Manager', initials: 'JR', clients: 6, leadsClosed: 31, revenue: 92400, status: 'online' },
  { id: '3', name: 'Morgan Lee', role: 'Ad Strategist', initials: 'ML', clients: 8, leadsClosed: 22, revenue: 76800, status: 'away' },
  { id: '4', name: 'Taylor Brooks', role: 'Content Lead', initials: 'TB', clients: 5, leadsClosed: 14, revenue: 41200, status: 'offline' },
];

const statusColor = { online: '#26a96c', away: '#f5a623', offline: '#6b7280' } as const;

export default function TeamRosterPage() {
  const totalRevenue = TEAM.reduce((n, t) => n + t.revenue, 0);
  const totalClosed = TEAM.reduce((n, t) => n + t.leadsClosed, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>groups</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Team Roster</h1>
        </div>
        <p className="text-white/60 mt-1">Human agents, their clients, and performance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Team Size</div>
          <div className="text-3xl font-bold text-white mt-1">{TEAM.length}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Leads Closed</div>
          <div className="text-3xl font-bold text-white mt-1">{totalClosed}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Team Revenue</div>
          <div className="text-3xl font-bold text-white mt-1">${(totalRevenue / 1000).toFixed(1)}K</div>
        </div>
      </div>

      <div className="glass-card p-2 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 uppercase text-xs tracking-wider">
              <th className="text-left font-semibold px-4 py-3">Member</th>
              <th className="text-left font-semibold px-4 py-3">Role</th>
              <th className="text-right font-semibold px-4 py-3">Clients</th>
              <th className="text-right font-semibold px-4 py-3">Leads Closed</th>
              <th className="text-right font-semibold px-4 py-3">Revenue</th>
              <th className="text-right font-semibold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((m) => (
              <tr key={m.id} className="border-t border-white/10 text-white/90">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                    >
                      {m.initials}
                    </div>
                    <div className="font-semibold">{m.name}</div>
                  </div>
                </td>
                <td className="px-4 py-4 text-white/70">{m.role}</td>
                <td className="px-4 py-4 text-right">{m.clients}</td>
                <td className="px-4 py-4 text-right">{m.leadsClosed}</td>
                <td className="px-4 py-4 text-right font-semibold">${m.revenue.toLocaleString()}</td>
                <td className="px-4 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                    <span className="w-2 h-2 rounded-full" style={{ background: statusColor[m.status], boxShadow: `0 0 8px ${statusColor[m.status]}` }} />
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
