'use client';

/**
 * TikTok Content Plan — deep AI read of a connected account.
 *
 * Sits alongside TikTokAnalytics. Reads the same saved handle from
 * client_kv, pulls the connected profile data through /api/tiktok/profile,
 * then feeds the full video list into /api/tiktok/plan for a structured
 * 30-day plan: pillars, voice rules, daily calendar, recurring series,
 * stop-doing list, KPI targets.
 *
 * No setup of its own — if the TikTok card above is connected, this one
 * works. Safe to mount anywhere.
 */

import React, { useEffect, useMemo, useState } from 'react';

type Plan = {
  summary: string;
  voice: { tone: string; doThis: string[]; avoidThis: string[] };
  pillars: { name: string; description: string; shareOfPosts: string; exampleHooks: string[] }[];
  thirtyDayPlan: {
    day: number;
    pillar: string;
    title: string;
    hook: string;
    format: string;
    cta: string;
    hashtags: string[];
    audio: string;
  }[];
  seriesIdeas: { name: string; premise: string; cadence: string; episodes: string[] }[];
  stopDoing: string[];
  kpiTargets: { followers30d: string; avgViews: string; engagementRate: string };
};

export default function TikTokContentPlan({
  ownerKey,
  kvClientId,
  kvKey = 'tiktok_handle',
  label,
  niche,
  gradientFrom,
  gradientTo,
}: {
  ownerKey: string;
  kvClientId: string;
  kvKey?: string;
  label?: string;
  niche?: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [handle, setHandle] = useState<string>('');
  const [busy, setBusy] = useState<'idle' | 'fetching' | 'planning'>('idle');
  const [err, setErr] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activePillar, setActivePillar] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/client-kv?clientId=${encodeURIComponent(kvClientId)}&key=${encodeURIComponent(kvKey)}`);
        const d = await r.json();
        if (d?.value) setHandle(String(d.value).trim().replace(/^@/, ''));
      } catch {}
    })();
  }, [kvClientId, kvKey]);

  async function build() {
    if (!handle) { setErr('Connect a TikTok handle on the analytics card above first.'); return; }
    setErr(''); setBusy('fetching');
    try {
      const r = await fetch(`/api/tiktok/profile?handle=${encodeURIComponent(handle)}&ownerKey=${encodeURIComponent(ownerKey)}`);
      const d = await r.json();
      if (!r.ok || !d.profile) { setErr(d.error || 'Could not pull profile'); setBusy('idle'); return; }

      setBusy('planning');
      const p = await fetch('/api/tiktok/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: d.profile.handle,
          bio: d.profile.bio,
          niche,
          followers: d.profile.followers,
          totalLikes: d.profile.totalLikes,
          videosCount: d.profile.videosCount,
          videos: d.videos || [],
        }),
      });
      const pd = await p.json();
      if (!p.ok) { setErr(pd.error || 'Plan agent failed'); setBusy('idle'); return; }
      setPlan(pd);
    } catch (e: any) {
      setErr(e?.message || 'Something broke');
    } finally {
      setBusy('idle');
    }
  }

  const days = useMemo(() => {
    if (!plan) return [];
    if (activePillar === 'all') return plan.thirtyDayPlan;
    return plan.thirtyDayPlan.filter((d) => d.pillar === activePillar);
  }, [plan, activePillar]);

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>auto_awesome</span>
            <h3 className="text-[15px] font-bold text-white">Content Plan Agent {label ? `· ${label}` : ''}</h3>
            {plan && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(147,51,234,0.18)', color: '#c4b5fd' }}>Plan Ready</span>}
          </div>
          <p className="text-[11px] text-white/55">
            Reads @{handle || '…'}'s top + bottom performers · builds pillars, 30-day calendar, series, KPI targets.
          </p>
        </div>
        <button
          onClick={build}
          disabled={busy !== 'idle' || !handle}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
          style={{ background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` }}
        >
          {busy === 'fetching' ? 'Reading account…' : busy === 'planning' ? 'Building plan…' : plan ? 'Rebuild' : '✨ Build Content Plan'}
        </button>
      </div>

      {err && (
        <div className="rounded-xl p-3 mb-3 text-[11px]" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <span className="font-bold text-rose-300">Error: </span><span className="text-white/75">{err}</span>
        </div>
      )}

      {!plan && busy === 'idle' && (
        <div className="text-center py-8">
          <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: gradientTo, opacity: 0.5 }}>psychology</span>
          <div className="text-[13px] font-bold">
            {handle ? `Build a plan for @${handle}` : 'Connect TikTok first'}
          </div>
          <p className="text-[11px] text-white/55 mt-1 max-w-md mx-auto">
            The agent pulls every video on the profile, clusters hooks + formats, and produces a 30-day
            calendar grounded in what's already earning views.
          </p>
        </div>
      )}

      {busy !== 'idle' && (
        <div className="text-[12px] text-white/60 py-6 text-center">
          {busy === 'fetching' ? 'Pulling latest videos…' : 'Agent is analyzing patterns and drafting the plan…'}
        </div>
      )}

      {plan && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(196,181,253,0.25)' }}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-purple-300 mb-1">Account read</div>
            <p className="text-[13px] text-white/85 leading-relaxed">{plan.summary}</p>
          </div>

          {/* Voice */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Voice · tone</div>
              <div className="text-[12px] text-white/85 font-semibold">{plan.voice.tone}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-1">Do</div>
              <ul className="space-y-0.5">
                {plan.voice.doThis.map((d, i) => <li key={i} className="text-[11px] text-white/80">✓ {d}</li>)}
              </ul>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-300 mb-1">Avoid</div>
              <ul className="space-y-0.5">
                {plan.voice.avoidThis.map((d, i) => <li key={i} className="text-[11px] text-white/80">✗ {d}</li>)}
              </ul>
            </div>
          </div>

          {/* Pillars */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-2">Content Pillars</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {plan.pillars.map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3 cursor-pointer transition"
                  onClick={() => setActivePillar(activePillar === p.name ? 'all' : p.name)}
                  style={{
                    background: activePillar === p.name ? 'rgba(147,51,234,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${activePillar === p.name ? 'rgba(196,181,253,0.45)' : 'rgba(255,255,255,0.08)'}`,
                    borderLeft: `3px solid ${gradientFrom}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-[13px] font-bold text-white">{p.name}</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${gradientFrom}22`, color: gradientFrom }}>
                      {p.shareOfPosts}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/65 leading-relaxed">{p.description}</div>
                  {p.exampleHooks?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {p.exampleHooks.slice(0, 3).map((h, j) => (
                        <div key={j} className="text-[10px] text-white/50 italic">"{h}"</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {activePillar !== 'all' && (
              <button onClick={() => setActivePillar('all')} className="text-[10px] text-white/50 hover:text-white/80 mt-2">
                × clear filter
              </button>
            )}
          </div>

          {/* 30-day calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/45">
                30-Day Plan {activePillar !== 'all' ? `· ${activePillar} only` : ''}
              </div>
              <div className="text-[10px] text-white/40">{days.length} posts</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {days.map((d) => (
                <div key={d.day} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: gradientFrom, color: '#fff' }}>Day {d.day}</span>
                    <span className="text-[9px] uppercase tracking-wider text-white/45">{d.pillar}</span>
                    <span className="text-[9px] uppercase tracking-wider text-white/35 ml-auto">{d.format}</span>
                  </div>
                  <div className="text-[12px] font-bold text-white">{d.title}</div>
                  <div className="text-[11px] text-white/70 mt-1"><span className="text-white/40">Hook:</span> {d.hook}</div>
                  <div className="text-[10px] text-white/55 mt-1"><span className="text-white/35">CTA:</span> {d.cta}</div>
                  <div className="text-[10px] text-white/45 mt-1"><span className="text-white/30">Audio:</span> {d.audio}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {d.hashtags?.map((h, i) => (
                      <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(74,184,206,0.15)', color: '#67e8f9' }}>
                        #{h.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Series + stop-doing side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-2">Recurring series</div>
              <div className="space-y-2">
                {plan.seriesIdeas.map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="text-[12px] font-bold text-white">{s.name}</div>
                      <span className="text-[9px] uppercase tracking-wider text-white/45">{s.cadence}</span>
                    </div>
                    <div className="text-[11px] text-white/65 mb-1">{s.premise}</div>
                    <ul className="space-y-0.5">
                      {s.episodes.map((e, j) => <li key={j} className="text-[10px] text-white/70">· {e}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-300 mb-2">Stop doing</div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <ul className="space-y-1">
                  {plan.stopDoing.map((s, i) => <li key={i} className="text-[11px] text-white/80">✗ {s}</li>)}
                </ul>
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mt-4 mb-2">30-day KPI targets</div>
              <div className="grid grid-cols-3 gap-2">
                <Kpi label="Followers" value={plan.kpiTargets.followers30d} color={gradientFrom} />
                <Kpi label="Avg Views" value={plan.kpiTargets.avgViews} color="#ec4899" />
                <Kpi label="Engagement" value={plan.kpiTargets.engagementRate} color="#10b981" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderTop: `2px solid ${color}` }}>
      <div className="text-[9px] uppercase tracking-wider font-bold text-white/45">{label}</div>
      <div className="text-[13px] font-black text-white mt-0.5">{value}</div>
    </div>
  );
}
