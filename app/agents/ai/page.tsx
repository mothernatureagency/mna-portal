'use client';
import React, { useState } from 'react';

type Status = 'idle' | 'running' | 'error';

type AIAgent = {
  id: string;
  name: string;
  role: string;
  description: string;
  status: Status;
  lastRun: string;
  runsToday: number;
  icon: string;
};

const INITIAL: AIAgent[] = [
  { id: 'content', name: 'Content Agent', role: 'Content Creation', description: 'Drafts captions, hooks, and scripts from top-performing templates.', status: 'idle', lastRun: '2h ago', runsToday: 14, icon: 'edit_note' },
  { id: 'ads', name: 'Ads Agent', role: 'Ad Optimization', description: 'Analyzes ad spend, CTR, ROAS and suggests pauses, scales, and new creatives.', status: 'running', lastRun: 'just now', runsToday: 6, icon: 'campaign' },
  { id: 'crm', name: 'CRM Agent', role: 'Lead Follow-Up', description: 'Automates lead triage, follow-up sequences, and booking reminders.', status: 'idle', lastRun: '35m ago', runsToday: 22, icon: 'forum' },
  { id: 'insight', name: 'Insight Agent', role: 'Analytics', description: 'Generates weekly client reports and anomaly alerts from KPI data.', status: 'idle', lastRun: '1d ago', runsToday: 1, icon: 'insights' },
  { id: 'revenue', name: 'Revenue Agent', role: 'Forecasting', description: 'Projects pipeline value and monthly revenue from current trajectory.', status: 'error', lastRun: '4h ago', runsToday: 3, icon: 'trending_up' },
  { id: 'research', name: 'Research Agent', role: 'Competitive Intel', description: 'Scrapes competitors, trending hooks, and industry benchmarks.', status: 'idle', lastRun: '6h ago', runsToday: 4, icon: 'travel_explore' },
];

const statusColor: Record<Status, string> = {
  idle: '#4ab8ce',
  running: '#26a96c',
  error: '#ef4444',
};

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<AIAgent[]>(INITIAL);

  const run = (id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'running', lastRun: 'just now' } : a)));
    setTimeout(() => {
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'idle', runsToday: a.runsToday + 1 } : a)));
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>smart_toy</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Agents</h1>
        </div>
        <p className="text-white/60 mt-1">Automated workers that run your agency on autopilot.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Agents', value: agents.filter((a) => a.status !== 'error').length },
          { label: 'Running Now', value: agents.filter((a) => a.status === 'running').length },
          { label: 'Runs Today', value: agents.reduce((n, a) => n + a.runsToday, 0) },
          { label: 'Errors', value: agents.filter((a) => a.status === 'error').length },
        ].map((s) => (
          <div key={s.label} className="glass-card p-5">
            <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">{s.label}</div>
            <div className="text-3xl font-bold text-white mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {agents.map((a) => (
          <div key={a.id} className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>{a.icon}</span>
                </div>
                <div>
                  <div className="text-white font-bold text-lg leading-tight">{a.name}</div>
                  <div className="text-white/50 text-xs uppercase tracking-wider">{a.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: statusColor[a.status], boxShadow: `0 0 10px ${statusColor[a.status]}` }} />
                <span className="text-xs text-white/70 capitalize">{a.status}</span>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{a.description}</p>
            <div className="flex items-center justify-between text-xs text-white/50 pt-2 border-t border-white/10">
              <span>Last run: {a.lastRun}</span>
              <span>{a.runsToday} runs today</span>
            </div>
            <button
              onClick={() => run(a.id)}
              disabled={a.status === 'running'}
              className="mt-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
            >
              {a.status === 'running' ? 'Running…' : 'Run Agent'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
