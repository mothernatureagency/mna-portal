'use client';
import React from 'react';
import Link from 'next/link';
import { AGENTS } from '@/lib/agents/config';

export default function AIAgentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>smart_toy</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Agents</h1>
        </div>
        <p className="text-white/60 mt-1">Your always-on team for Mother Nature Agency. Click any agent to chat.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Total Agents</div>
          <div className="text-3xl font-bold text-white mt-1">{AGENTS.length}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Online</div>
          <div className="text-3xl font-bold text-white mt-1">{AGENTS.length}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Model</div>
          <div className="text-xl font-bold text-white mt-2">Claude Sonnet</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Status</div>
          <div className="text-xl font-bold text-white mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            Operational
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {AGENTS.map((a) => (
          <Link
            key={a.id}
            href={`/agents/ai/${a.id}`}
            className="glass-card p-6 flex flex-col gap-4 no-underline hover:-translate-y-0.5 transition"
          >
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
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] mt-2" />
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{a.tagline}</p>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-white/50">
              {a.model.includes('sonnet') ? 'Sonnet · Deep reasoning' : 'Haiku · Fast & cheap'}
            </div>
            <div className="mt-auto pt-3 border-t border-white/10 text-sm font-semibold text-white/90 flex items-center gap-1">
              Open chat
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
