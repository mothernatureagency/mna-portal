'use client';

import { useEffect, useState } from 'react';
import { clients, Client } from '@/lib/clients';
import { createClient } from '@/lib/supabase/client';

type KPI = { label: string; value: string; sub?: string; color: string };

type MonthData = {
  month: string; // 'Jan', 'Feb', etc.
  monthKey: string; // '2026-01', '2026-02', etc.
  actual: number;
  projected: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = 2026;

function getQuarter(monthIndex: number) {
  return Math.floor(monthIndex / 3) + 1;
}

function getMonthKey(monthIndex: number) {
  return `${CURRENT_YEAR}-${String(monthIndex + 1).padStart(2, '0')}`;
}

// Default targets based on client kpiTargets.revenue
function defaultProjections(client: Client): MonthData[] {
  const base = client.kpiTargets.revenue;
  return MONTH_LABELS.map((label, i) => ({
    month: label,
    monthKey: getMonthKey(i),
    actual: 0,
    projected: base,
  }));
}

// Hardcoded actuals for Prime IV Niceville (known data)
const KNOWN_ACTUALS: Record<string, Record<string, number>> = {
  'prime-iv': {
    '2026-01': 49400,
    '2026-02': 52500,
    '2026-03': 54500,
  },
};

const KNOWN_KPIS: Record<string, KPI[]> = {
  'prime-iv': [
    { label: 'Total Leads (30d)', value: '464', sub: 'GHL pipeline', color: '#0ea5e9' },
    { label: 'Conversion Rate', value: '16.59%', sub: 'Above 14% target', color: '#8b5cf6' },
    { label: 'Booked Appointments', value: '77', sub: 'Won opportunities', color: '#ec4899' },
    { label: 'March Revenue', value: '$54.5K', sub: '+3.8% vs February', color: '#06b6d4' },
  ],
};

const TOP_POSTS_BY_CLIENT: Record<string, { platform: string; title: string; engagement: number; reach: number; type: string }[]> = {
  'prime-iv': [
    { platform: 'Instagram', title: 'Spa walkthrough reel', engagement: 4820, reach: 28400, type: 'Reel' },
    { platform: 'Instagram', title: 'After Hours giveaway', engagement: 3210, reach: 18600, type: 'Post' },
    { platform: 'Facebook', title: 'Spring Reset Bundle launch', engagement: 1840, reach: 12200, type: 'Post' },
    { platform: 'Instagram', title: 'Real client review', engagement: 2670, reach: 14100, type: 'Reel' },
  ],
};

export default function ClientOverviewPage() {
  const [client, setClient] = useState<Client>(clients.find((c) => c.id === 'prime-iv')!);
  const [isStaff, setIsStaff] = useState(false);
  const [projections, setProjections] = useState<MonthData[]>([]);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ actual: '', projected: '' });
  const [saving, setSaving] = useState(false);

  // Resolve client from auth
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      const role = (meta.role as string) || 'staff';
      const clientId = (meta.client_id as string) || 'prime-iv';
      const found = clients.find((c) => c.id === clientId);
      if (found) setClient(found);
      setIsStaff(role === 'staff');
    });
  }, []);

  // Load projections from client_kv
  useEffect(() => {
    if (!client) return;
    const defaults = defaultProjections(client);

    // Merge known actuals
    const knownActuals = KNOWN_ACTUALS[client.id] || {};
    defaults.forEach((m) => {
      if (knownActuals[m.monthKey]) m.actual = knownActuals[m.monthKey];
    });

    // Load saved projections from KV
    fetch(`/api/client-kv?clientId=${client.id}&key=revenue_projections`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value && typeof data.value === 'object') {
          const saved = data.value as Record<string, { actual?: number; projected?: number }>;
          defaults.forEach((m) => {
            if (saved[m.monthKey]) {
              if (saved[m.monthKey].actual !== undefined) m.actual = saved[m.monthKey].actual!;
              if (saved[m.monthKey].projected !== undefined) m.projected = saved[m.monthKey].projected!;
            }
          });
        }
        setProjections(defaults);
      })
      .catch(() => setProjections(defaults));
  }, [client]);

  async function saveProjection(monthKey: string) {
    const actual = parseFloat(editValues.actual) || 0;
    const projected = parseFloat(editValues.projected) || 0;

    // Update local state
    const updated = projections.map((m) =>
      m.monthKey === monthKey ? { ...m, actual, projected } : m
    );
    setProjections(updated);
    setEditingMonth(null);

    // Build KV value
    const kvValue: Record<string, { actual: number; projected: number }> = {};
    updated.forEach((m) => {
      kvValue[m.monthKey] = { actual: m.actual, projected: m.projected };
    });

    setSaving(true);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, key: 'revenue_projections', value: kvValue }),
    });
    setSaving(false);
  }

  const { gradientFrom, gradientTo } = client.branding;
  const kpis = KNOWN_KPIS[client.id] || [
    { label: 'Monthly Revenue Target', value: `$${(client.kpiTargets.revenue / 1000).toFixed(0)}K`, sub: 'From your plan', color: '#0ea5e9' },
    { label: 'Lead Target', value: `${client.kpiTargets.leads}`, sub: 'Monthly goal', color: '#8b5cf6' },
    { label: 'Conversion Target', value: `${client.kpiTargets.conversionRate}%`, sub: 'Goal', color: '#ec4899' },
    { label: 'Ad Spend', value: `$${(client.kpiTargets.adSpend / 1000).toFixed(1)}K`, sub: 'Monthly budget', color: '#06b6d4' },
  ];
  const topPosts = TOP_POSTS_BY_CLIENT[client.id] || [];

  // Quarterly rollups
  const quarters = [1, 2, 3, 4].map((q) => {
    const qMonths = projections.filter((_, i) => getQuarter(i) === q);
    return {
      label: `Q${q}`,
      actual: qMonths.reduce((sum, m) => sum + m.actual, 0),
      projected: qMonths.reduce((sum, m) => sum + m.projected, 0),
    };
  });

  // Current month index (0-based)
  const currentMonthIdx = new Date().getMonth();
  const ytdActual = projections.slice(0, currentMonthIdx + 1).reduce((s, m) => s + m.actual, 0);
  const ytdProjected = projections.slice(0, currentMonthIdx + 1).reduce((s, m) => s + m.projected, 0);
  const annualProjected = projections.reduce((s, m) => s + m.projected, 0);

  // For bar chart: show months with data or projections
  const chartMonths = projections.filter((m, i) => i <= currentMonthIdx + 5); // show through ~6 months ahead
  const chartMax = Math.max(...chartMonths.map((m) => Math.max(m.actual, m.projected)), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-extrabold text-neutral-900">
          Hi {client.shortName}, here&apos;s the latest
        </h1>
        <p className="text-[13px] text-neutral-500 mt-1">
          Your top-line results, projections, and content performance.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 shadow-sm border border-black/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: k.color }} />
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{k.label}</div>
            <div className="text-[34px] font-black text-neutral-900 leading-none my-2">{k.value}</div>
            {k.sub && <div className="text-[11px] text-neutral-500">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Revenue Projections — Monthly */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[15px] font-bold text-neutral-900">Revenue Projections · {CURRENT_YEAR}</div>
            <div className="text-[11px] text-neutral-500">
              Click any month to update actuals or projections
              {saving && <span className="ml-2 text-amber-600">Saving...</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <div className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }} />
              Actual
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <div className="w-3 h-3 rounded bg-neutral-200 border border-neutral-300" />
              Projected
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-44 mb-4">
          {chartMonths.map((m, i) => {
            const isPast = i <= currentMonthIdx;
            const isEditing = editingMonth === m.monthKey;
            return (
              <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1">
                {/* Values */}
                <div className="text-[10px] font-bold text-neutral-700">
                  {m.actual > 0 ? `$${(m.actual / 1000).toFixed(1)}K` : isPast ? '—' : ''}
                </div>
                {/* Bars */}
                <div className="w-full flex gap-0.5 items-end" style={{ height: '100%' }}>
                  {/* Actual bar */}
                  <div
                    className="flex-1 rounded-t-md transition-all cursor-pointer hover:opacity-80"
                    style={{
                      height: m.actual > 0 ? `${(m.actual / chartMax) * 100}%` : '2px',
                      background: m.actual > 0 ? `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` : '#e5e7eb',
                      minHeight: 2,
                    }}
                    onClick={() => {
                      setEditingMonth(m.monthKey);
                      setEditValues({ actual: String(m.actual || ''), projected: String(m.projected || '') });
                    }}
                  />
                  {/* Projected bar */}
                  <div
                    className="flex-1 rounded-t-md cursor-pointer hover:opacity-80"
                    style={{
                      height: `${(m.projected / chartMax) * 100}%`,
                      background: '#e5e7eb',
                      border: '1px solid #d1d5db',
                      minHeight: 2,
                    }}
                    onClick={() => {
                      setEditingMonth(m.monthKey);
                      setEditValues({ actual: String(m.actual || ''), projected: String(m.projected || '') });
                    }}
                  />
                </div>
                <div className={`text-[10px] font-semibold ${i === currentMonthIdx ? 'text-neutral-900' : 'text-neutral-400'}`}>
                  {m.month}
                </div>

                {/* Inline edit popover */}
                {isEditing && (
                  <div className="absolute mt-2 bg-white rounded-xl shadow-xl border border-neutral-200 p-4 z-10 w-56"
                    style={{ transform: 'translateY(100%)' }}
                  >
                    <div className="text-[11px] font-bold text-neutral-700 mb-2">{m.month} {CURRENT_YEAR}</div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Actual Revenue</label>
                        <input
                          type="number"
                          value={editValues.actual}
                          onChange={(e) => setEditValues({ ...editValues, actual: e.target.value })}
                          placeholder="0"
                          className="w-full mt-1 text-[13px] px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:border-neutral-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Projected Revenue</label>
                        <input
                          type="number"
                          value={editValues.projected}
                          onChange={(e) => setEditValues({ ...editValues, projected: e.target.value })}
                          placeholder="0"
                          className="w-full mt-1 text-[13px] px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:border-neutral-400"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveProjection(m.monthKey)}
                          className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg text-white"
                          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMonth(null)}
                          className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg bg-neutral-100 text-neutral-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">YTD Actual</div>
            <div className="text-[22px] font-black text-neutral-900">${(ytdActual / 1000).toFixed(1)}K</div>
            {ytdProjected > 0 && (
              <div className={`text-[11px] font-semibold ${ytdActual >= ytdProjected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {ytdActual >= ytdProjected ? 'On track' : `${Math.round((ytdActual / ytdProjected) * 100)}% of projection`}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">YTD Projected</div>
            <div className="text-[22px] font-black text-neutral-900">${(ytdProjected / 1000).toFixed(1)}K</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Annual Projection</div>
            <div className="text-[22px] font-black text-neutral-900">${(annualProjected / 1000).toFixed(1)}K</div>
          </div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {quarters.map((q) => (
          <div key={q.label} className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{q.label} {CURRENT_YEAR}</div>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-neutral-400">Actual</div>
                <div className="text-[20px] font-black text-neutral-900">
                  {q.actual > 0 ? `$${(q.actual / 1000).toFixed(1)}K` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-400">Projected</div>
                <div className="text-[18px] font-bold text-neutral-500">${(q.projected / 1000).toFixed(1)}K</div>
              </div>
              {q.actual > 0 && q.projected > 0 && (
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((q.actual / q.projected) * 100, 100)}%`,
                      background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Content performance */}
      {topPosts.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-bold text-neutral-900">Top performing content</div>
            <span className="text-[11px] text-neutral-400">Last 30 days</span>
          </div>
          <div className="grid gap-3">
            {topPosts.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-black/5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                  >
                    {p.platform.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-neutral-900">{p.title}</div>
                    <div className="text-[10px] text-neutral-400">{p.platform} · {p.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="text-[10px] text-neutral-400">Engagement</div>
                    <div className="text-[13px] font-bold text-neutral-800">{p.engagement.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-400">Reach</div>
                    <div className="text-[13px] font-bold text-neutral-800">{p.reach.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPosts.length === 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 text-center text-neutral-500">
          <div className="text-[14px] font-semibold">Content performance</div>
          <div className="text-[12px] mt-1">We&apos;ll show your top posts here once we have engagement data.</div>
        </div>
      )}

      {/* Meta Ads Account card */}
      {client.metaAds && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <div className="text-[15px] font-bold text-neutral-900 mb-4">Meta Ads Account</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1fr 1fr' }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Business Portfolio</div>
              <div className="text-[13px] font-bold text-neutral-900 mt-1">{client.metaAds.businessPortfolioName}</div>
              <div className="text-[10px] text-neutral-500 font-mono">{client.metaAds.businessPortfolioId}</div>
              {client.metaAds.verificationStatus && (
                <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  client.metaAds.verificationStatus === 'Verified'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {client.metaAds.verificationStatus}
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Ad Account</div>
              <div className="text-[13px] font-bold text-neutral-900 mt-1 font-mono">{client.metaAds.adAccountId}</div>
              {client.metaAds.partnerName && (
                <div className="text-[10px] text-neutral-500 mt-1">Managed by {client.metaAds.partnerName}</div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pixel</div>
              {client.metaAds.datasetPixel ? (
                <>
                  <div className="text-[13px] font-bold text-neutral-900 mt-1">{client.metaAds.datasetPixel.name}</div>
                  <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {client.metaAds.datasetPixel.status || 'Active'}
                  </span>
                </>
              ) : (
                <div className="text-[11px] text-neutral-400 italic">Not connected</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
