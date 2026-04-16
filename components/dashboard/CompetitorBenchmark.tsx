'use client';

/**
 * CompetitorBenchmark — Meta Business Suite + Google Reviews comparison.
 *
 * Two tabs:
 *   1. Meta — followers / new follows / published content vs local competitors
 *   2. Google Reviews — placeholder until we wire the Google Places API
 *
 * Data is currently hand-fed from the Meta Business Suite Benchmarking view;
 * swap the COMPETITORS_28D constant for an API pull when ready.
 */

import React, { useState, useMemo } from 'react';

type Competitor = {
  id: string;
  name: string;
  isClient?: boolean;
  followers: number;
  newFollows: number;
  publishedContent: number;
};

// ─── DATA ────────────────────────────────────────────────────────────
// Source: Meta Business Suite Benchmarking, Mar 19 – Apr 15, 2026 (28d)
const COMPETITORS_28D: Competitor[] = [
  { id: 'niceville',  name: 'Prime IV Niceville',    isClient: true, followers: 387,  newFollows: 15, publishedContent: 15 },
  { id: 'destin',     name: 'Prime IV Destin',                       followers: 504,  newFollows: 3,  publishedContent: 7  },
  { id: 'aqua-vitae', name: 'Aqua Vitae IV Drip Bar',                followers: 1100, newFollows: 8,  publishedContent: 5  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────
function pct(v: number, total: number) {
  if (!total) return 0;
  return Math.round((v / total) * 1000) / 10;
}

function fmtMultiple(client: number, other: number) {
  if (!other) return '—';
  const x = client / other;
  if (x >= 10) return `${x.toFixed(0)}×`;
  return `${x.toFixed(1)}×`;
}

// ─── COMPONENT ───────────────────────────────────────────────────────
type Tab = 'meta' | 'google';

export default function CompetitorBenchmark({
  gradientFrom,
  gradientTo,
}: {
  gradientFrom: string;
  gradientTo: string;
}) {
  const [tab, setTab] = useState<Tab>('meta');

  const data = COMPETITORS_28D;
  const client = data.find((c) => c.isClient)!;
  const competitors = data.filter((c) => !c.isClient);

  const totals = useMemo(() => ({
    posts: data.reduce((s, c) => s + c.publishedContent, 0),
    follows: data.reduce((s, c) => s + c.newFollows, 0),
    followers: data.reduce((s, c) => s + c.followers, 0),
  }), [data]);

  const clientPostShare = pct(client.publishedContent, totals.posts);
  const clientGrowthShare = pct(client.newFollows, totals.follows);
  const maxFollowers = Math.max(...data.map((c) => c.followers));
  const maxPosts = Math.max(...data.map((c) => c.publishedContent));
  const maxFollows = Math.max(...data.map((c) => c.newFollows));

  return (
    <div className="glass-card p-6">
      {/* ── Header + Tabs ── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>insights</span>
            Competitor Benchmark
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            Mar 19 – Apr 15, 2026 (last 28 days) · Source: Meta Business Suite
          </p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-white/15 text-[11px] font-semibold">
          <button
            onClick={() => setTab('meta')}
            className={`px-3 py-1.5 transition ${tab === 'meta' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            style={tab === 'meta' ? { background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            Meta
          </button>
          <button
            onClick={() => setTab('google')}
            className={`px-3 py-1.5 transition ${tab === 'google' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
            style={tab === 'google' ? { background: `linear-gradient(135deg,${gradientFrom},${gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            Google Reviews
          </button>
        </div>
      </div>

      {tab === 'meta' && (
        <>
          {/* ── Headline insight ── */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}22, ${gradientTo}11)`,
              border: `1px solid ${gradientFrom}55`,
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
              ✦ Activity & Growth Leader
            </div>
            <div className="text-white text-[13px] leading-relaxed">
              Niceville is publishing <span className="font-bold">{fmtMultiple(client.publishedContent, competitors[1].publishedContent)} more</span> than Aqua Vitae and{' '}
              <span className="font-bold">{fmtMultiple(client.publishedContent, competitors[0].publishedContent)} more</span> than the Destin location, while gaining{' '}
              <span className="font-bold">{fmtMultiple(client.newFollows, competitors[0].newFollows)} the new follows</span> of Destin and{' '}
              <span className="font-bold">{fmtMultiple(client.newFollows, competitors[1].newFollows)}</span> Aqua Vitae's. We have the smallest base but the strongest momentum.
            </div>
          </div>

          {/* ── Market Activity Share ── */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <ShareTile
              label="Market Activity Share"
              clientPct={clientPostShare}
              note={`${client.publishedContent} of ${totals.posts} posts`}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <ShareTile
              label="New-Follow Share"
              clientPct={clientGrowthShare}
              note={`${client.newFollows} of ${totals.follows} new follows`}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
          </div>

          {/* ── Bar charts ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BarColumn
              title="Followers"
              metric="followers"
              data={data}
              max={maxFollowers}
              barColor="#94a3b8"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <BarColumn
              title="New Follows (28d)"
              metric="newFollows"
              data={data}
              max={maxFollows}
              barColor="#34d399"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
            <BarColumn
              title="Published Content (28d)"
              metric="publishedContent"
              data={data}
              max={maxPosts}
              barColor="#a78bfa"
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
            />
          </div>
        </>
      )}

      {tab === 'google' && <GoogleReviewsPlaceholder gradientFrom={gradientFrom} gradientTo={gradientTo} />}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function ShareTile({
  label,
  clientPct,
  note,
  gradientFrom,
  gradientTo,
}: {
  label: string;
  clientPct: number;
  note: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-[34px] font-black text-white leading-none">{clientPct}%</div>
        <div className="text-[11px] text-white/50">{note}</div>
      </div>
      <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${clientPct}%`,
            background: `linear-gradient(90deg,${gradientFrom},${gradientTo})`,
          }}
        />
      </div>
    </div>
  );
}

function BarColumn({
  title,
  metric,
  data,
  max,
  barColor,
  gradientFrom,
  gradientTo,
}: {
  title: string;
  metric: 'followers' | 'newFollows' | 'publishedContent';
  data: Competitor[];
  max: number;
  barColor: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[11px] font-bold text-white/85 mb-3">{title}</div>
      <div className="space-y-2.5">
        {data.map((c) => {
          const v = c[metric];
          const w = max ? (v / max) * 100 : 0;
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={c.isClient ? 'font-bold text-white' : 'text-white/65'}>
                  {c.isClient && '★ '}{c.name}
                </span>
                <span className={c.isClient ? 'font-bold text-white' : 'text-white/65'}>
                  {v.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${w}%`,
                    background: c.isClient
                      ? `linear-gradient(90deg,${gradientFrom},${gradientTo})`
                      : barColor,
                    opacity: c.isClient ? 1 : 0.55,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoogleReviewsPlaceholder({ gradientFrom, gradientTo }: { gradientFrom: string; gradientTo: string }) {
  return (
    <div className="text-center py-12">
      <span
        className="material-symbols-outlined inline-block mb-3"
        style={{ fontSize: 48, color: gradientTo, opacity: 0.6 }}
      >
        rate_review
      </span>
      <div className="text-white text-[14px] font-semibold mb-1">Google Reviews comparison · coming online</div>
      <p className="text-white/55 text-[11px] max-w-md mx-auto leading-relaxed">
        Once the Google Places API key is provisioned for portal.mothernatureagency.com,
        this tab will pull each competitor's review count, average rating, and recent
        review velocity automatically. Right now we'd be guessing — and we don't fabricate
        review numbers.
      </p>
    </div>
  );
}
