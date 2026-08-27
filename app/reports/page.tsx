'use client';

/**
 * Reports & Analytics.
 *
 * Replaces the "Coming Soon" placeholder with two things that work today:
 *   • An intelligence brief — a couple of plain-English sentences a
 *     stakeholder can read without knowing what CPC means, generated from
 *     what the database actually holds for this client.
 *   • A real export — a print-optimized layout the browser saves as PDF, so
 *     there's no dependency on a rendering service.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';
import { BarChart2, Download, RefreshCw, Sparkles } from 'lucide-react';

type Highlight = { label: string; value: string; note?: string };
type Summary = {
  summary: string;
  highlights: Highlight[];
  facts?: any;
  generated?: boolean;
  error?: string;
};

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export default function ReportsPage() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeClient?.id) return;
    setLoading(true);
    setErr(null);
    fetch(`/api/reports/summary?clientId=${encodeURIComponent(activeClient.id)}&clientName=${encodeURIComponent(activeClient.name)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Could not build the brief');
        return d;
      })
      .then(setData)
      .catch((e) => setErr(e?.message || 'Could not build the brief'))
      .finally(() => setLoading(false));
  }, [activeClient?.id, activeClient?.name]);

  useEffect(() => { load(); }, [load]);

  const facts = data?.facts;
  const reviews = facts?.reviews;
  const content = facts?.content;
  const today = new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Print rules — the browser's "Save as PDF" becomes the export */}
      <style jsx global>{`
        @media print {
          aside, nav, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          .print-plain { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeClient?.name} · {today}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={load}
            disabled={loading}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Building…' : 'Refresh'}
          </button>
          <button
            onClick={() => window.print()}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white inline-flex items-center gap-1.5"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            <Download size={14} />
            Download report
          </button>
        </div>
      </div>

      {/* ── Intelligence brief ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 print-plain"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        {/* depth */}
        <div
          className="absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: '#fff' }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 mb-3">
            <Sparkles size={12} />
            Intelligence brief
          </div>

          {loading ? (
            <div className="text-white/70 text-[14px]">Reading the numbers…</div>
          ) : err ? (
            <div className="text-white/85 text-[14px]">{err}</div>
          ) : (
            <p className="text-white text-[17px] md:text-[19px] font-semibold leading-relaxed max-w-3xl">
              {data?.summary || 'No summary available yet.'}
            </p>
          )}

          {!!data?.highlights?.length && (
            <div className="grid gap-3 mt-6 sm:grid-cols-2 lg:grid-cols-4">
              {data.highlights.map((h, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)' }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{h.label}</div>
                  <div className="text-[22px] font-black text-white leading-none my-1">{h.value}</div>
                  {h.note && <div className="text-[10.5px] text-white/75 leading-snug">{h.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── What the brief was built from ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 print-plain">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reputation</div>
          {reviews?.total ? (
            <>
              <div className="text-[26px] font-black text-gray-900 leading-none my-1.5">
                {Number(reviews.rating).toFixed(2)}★
              </div>
              <div className="text-[12px] text-gray-500">
                {reviews.total} reviews · {reviews.last30d} in the last 30 days
              </div>
            </>
          ) : (
            <div className="text-[12px] text-gray-400 mt-2 italic">No reviews synced yet.</div>
          )}
        </Card>

        <Card className="p-5 print-plain">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Content</div>
          {content ? (
            <>
              <div className="text-[26px] font-black text-gray-900 leading-none my-1.5">
                {content.publishedLast90d}
              </div>
              <div className="text-[12px] text-gray-500">
                posts in the last 90 days · {content.scheduledAhead} scheduled ahead
              </div>
            </>
          ) : (
            <div className="text-[12px] text-gray-400 mt-2 italic">No calendar activity yet.</div>
          )}
        </Card>

        <Card className="p-5 print-plain">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Monthly goal</div>
          {facts?.revenueGoal ? (
            <>
              <div className="text-[26px] font-black text-gray-900 leading-none my-1.5">
                ${Number(facts.revenueGoal).toLocaleString()}
              </div>
              <div className="text-[12px] text-gray-500">Revenue target</div>
            </>
          ) : (
            <div className="text-[12px] text-gray-400 mt-2 italic">No revenue goal set.</div>
          )}
        </Card>
      </div>

      {/* ── Recorded KPIs ── */}
      {facts?.months && Object.keys(facts.months).length > 0 && (
        <Card className="p-5 print-plain">
          <div className="text-[13px] font-bold text-gray-900 mb-3">Recorded metrics</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-semibold">Month</th>
                  <th className="pb-2 font-semibold">Metrics</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(facts.months as Record<string, Record<string, number>>)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([ym, metrics]) => (
                    <tr key={ym} className="border-b border-gray-50 last:border-none align-top">
                      <td className="py-2.5 text-gray-900 font-semibold whitespace-nowrap">{fmtMonth(ym)}</td>
                      <td className="py-2.5 text-gray-600">
                        {Object.entries(metrics)
                          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Number(v).toLocaleString()}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && !data?.generated && !err && (
        <Card className="p-6 flex items-center gap-3 print-plain">
          <BarChart2 size={20} className="text-gray-300 shrink-0" />
          <div className="text-[12px] text-gray-500">
            The brief fills in on its own as KPIs, reviews and published content accumulate for this client.
          </div>
        </Card>
      )}
    </div>
  );
}
