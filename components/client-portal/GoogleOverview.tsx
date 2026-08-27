'use client';

/**
 * Google Overview — the Google-side counterpart to the Meta KPI card.
 *
 * Four groups in one card:
 *   Business Profile · Google Ads · GA4 website · Search Console
 *
 * Business Profile numbers auto-pull from the reviews already synced for
 * this client (falling back to the Places lookup when nothing is synced
 * yet). Ads / GA4 / Search Console have no API credentials wired up, so
 * they're staff-entered per month — same click-to-edit pattern as the Meta
 * KPI card, stored in the shared kpi_entries table via /api/kpis. When
 * those APIs are connected later, each group only needs an `auto` source
 * added to its metric defs.
 *
 * Clients see clean numbers and month-over-month movement — never the
 * auto/manual plumbing.
 */

import React, { useEffect, useMemo, useState } from 'react';

type Group = 'gbp' | 'gads' | 'ga4' | 'gsc';

type MetricDef = {
  key: string;
  label: string;
  group: Group;
  fmt: (n: number) => string;
  icon: string;
  /** false = lower is better (cost metrics, search position) */
  goodWhenUp?: boolean;
  /** Filled from live data rather than typed in. */
  auto?: boolean;
};

const GROUPS: { key: Group; label: string; icon: string; blurb: string }[] = [
  { key: 'gbp', label: 'Google Business Profile', icon: 'storefront', blurb: 'Your local listing — reviews and reputation.' },
  { key: 'gads', label: 'Google Ads', icon: 'campaign', blurb: 'Paid search performance.' },
  { key: 'ga4', label: 'Website', icon: 'language', blurb: 'Traffic and conversions from Google Analytics.' },
  { key: 'gsc', label: 'Google Search', icon: 'search', blurb: 'How your site shows up in organic search.' },
];

const METRICS: MetricDef[] = [
  // ── Business Profile (live) ──
  { key: 'gbp_rating',         label: 'Star Rating',     group: 'gbp',  fmt: (n) => n.toFixed(2),                          icon: 'star', auto: true },
  { key: 'gbp_reviews_total',  label: 'Total Reviews',   group: 'gbp',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'reviews', auto: true },
  { key: 'gbp_new_reviews',    label: 'New Reviews',     group: 'gbp',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'add_comment', auto: true },
  { key: 'gbp_response_rate',  label: 'Response Rate',   group: 'gbp',  fmt: (n) => `${n.toFixed(0)}%`,                    icon: 'quickreply', auto: true },

  // ── Google Ads ──
  { key: 'gads_spend',         label: 'Ad Spend',        group: 'gads', fmt: (n) => `$${Math.round(n).toLocaleString()}`,  icon: 'payments', goodWhenUp: false },
  { key: 'gads_impressions',   label: 'Impressions',     group: 'gads', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'visibility' },
  { key: 'gads_clicks',        label: 'Clicks',          group: 'gads', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'ads_click' },
  { key: 'gads_ctr',           label: 'CTR',             group: 'gads', fmt: (n) => `${n.toFixed(2)}%`,                    icon: 'percent' },
  { key: 'gads_cpc',           label: 'Cost / Click',    group: 'gads', fmt: (n) => `$${n.toFixed(2)}`,                    icon: 'sell', goodWhenUp: false },
  { key: 'gads_conversions',   label: 'Conversions',     group: 'gads', fmt: (n) => Math.round(n).toLocaleString(),        icon: 'target' },
  { key: 'gads_cost_per_conv', label: 'Cost / Conv.',    group: 'gads', fmt: (n) => `$${n.toFixed(2)}`,                    icon: 'request_quote', goodWhenUp: false },

  // ── GA4 ──
  { key: 'ga4_sessions', auto: true,       label: 'Sessions',        group: 'ga4',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'trending_up' },
  { key: 'ga4_users', auto: true,          label: 'Users',           group: 'ga4',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'group' },
  { key: 'ga4_engaged', auto: true,        label: 'Engaged Sessions',group: 'ga4',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'bolt' },
  { key: 'ga4_conversions', auto: true,    label: 'Conversions',     group: 'ga4',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'flag' },
  { key: 'ga4_avg_engagement', auto: true, label: 'Avg. Time (s)',   group: 'ga4',  fmt: (n) => `${Math.round(n)}s`,                   icon: 'timer' },

  // ── Search Console ──
  { key: 'gsc_impressions', auto: true,    label: 'Search Impressions', group: 'gsc', fmt: (n) => Math.round(n).toLocaleString(),      icon: 'visibility' },
  { key: 'gsc_clicks', auto: true,         label: 'Search Clicks',   group: 'gsc',  fmt: (n) => Math.round(n).toLocaleString(),        icon: 'ads_click' },
  { key: 'gsc_ctr', auto: true,            label: 'Search CTR',      group: 'gsc',  fmt: (n) => `${n.toFixed(2)}%`,                    icon: 'percent' },
  { key: 'gsc_position', auto: true,       label: 'Avg. Position',   group: 'gsc',  fmt: (n) => n.toFixed(1),                          icon: 'format_list_numbered', goodWhenUp: false },
];

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevYearMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, (m || 1) - 2, 1));
}
function labelYM(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

type LiveGbp = { rating: number | null; total: number | null; newThisMonth: number | null; responseRate: number | null };
type LiveGa4 = { sessions: number; users: number; engaged: number; conversions: number; avgEngagement: number };
type LiveGsc = { impressions: number; clicks: number; ctr: number; position: number };
type Insights = { ga4: LiveGa4 | null; gsc: LiveGsc | null; configured: boolean; connected: boolean | null };

export default function GoogleOverview({
  clientId,
  clientName,
  gradientFrom,
  gradientTo,
  editable = false,
}: {
  clientId: string;
  clientName?: string;
  gradientFrom: string;
  gradientTo: string;
  editable?: boolean;
}) {
  const realCurrentYM = useMemo(() => ymOf(new Date()), []);
  const [ym, setYm] = useState(realCurrentYM);
  const [manual, setManual] = useState<Record<string, Record<string, number>>>({});
  const [live, setLive] = useState<LiveGbp | null>(null);
  const [insights, setInsights] = useState<Record<string, Insights>>({}); // ym → insights
  const [setupOpen, setSetupOpen] = useState(false);
  const [ga4Prop, setGa4Prop] = useState('');
  const [gscSite, setGscSite] = useState('');
  const [setupSaved, setSetupSaved] = useState(false);
  const [props, setProps] = useState<{
    gsc: { siteUrl: string; permissionLevel: string }[];
    ga4: { property: string; displayName: string; account: string }[];
    connected: boolean;
    account?: string;
    notes?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      out.push(ymOf(d));
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  // Staff-entered values
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/kpis?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const byMetric: Record<string, Record<string, number>> = {};
        for (const e of d.entries || []) {
          if (!byMetric[e.metric]) byMetric[e.metric] = {};
          byMetric[e.metric][e.year_month] = Number(e.value);
        }
        setManual(byMetric);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  // Business Profile numbers from the synced reviews, falling back to Places
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const synced = await fetch(`/api/google-reviews-sync?clientId=${encodeURIComponent(clientId)}&limit=100`)
          .then((r) => r.json())
          .catch(() => null);

        const s = synced?.summary;
        const reviews: any[] = synced?.reviews || [];
        if (s && Number(s.total) > 0) {
          const monthPrefix = ym;
          const inMonth = reviews.filter((r) => (r.review_date || '').slice(0, 7) === monthPrefix);
          const replied = reviews.filter((r) => !!r.reply_text).length;
          if (!cancelled) {
            setLive({
              rating: Number(s.avg_rating) || null,
              total: Number(s.total) || null,
              newThisMonth: inMonth.length,
              responseRate: reviews.length > 0 ? (replied / reviews.length) * 100 : null,
            });
          }
          return;
        }

        // No synced reviews — try the saved Place ID for rating + count.
        const kv = await fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=google_place_id`)
          .then((r) => r.json())
          .catch(() => null);
        const placeId = kv?.value;
        if (!placeId) return;
        const place = await fetch(`/api/google-places?placeId=${encodeURIComponent(placeId)}`)
          .then((r) => r.json())
          .catch(() => null);
        if (place && !cancelled) {
          setLive({
            rating: place.rating || null,
            total: place.total || null,
            newThisMonth: null,
            responseRate: null,
          });
        }
      } catch {
        /* live data is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, ym]);

  // GA4 + Search Console for the selected month and the one before it, so the
  // MoM deltas have something to compare against.
  useEffect(() => {
    let cancelled = false;
    const wanted = [ym, prevYearMonth(ym)];
    for (const target of wanted) {
      if (insights[target]) continue;
      fetch(`/api/google/insights?clientId=${encodeURIComponent(clientId)}&ym=${target}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return;
          setInsights((prev) => ({ ...prev, [target]: d }));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
    // `insights` is intentionally omitted — it's the cache this effect fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, ym]);

  // Load the saved GA4 / Search Console identifiers for the setup panel.
  useEffect(() => {
    if (!editable) return;
    Promise.all([
      fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=ga4_property_id`).then((r) => r.json()).catch(() => null),
      fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=gsc_site_url`).then((r) => r.json()).catch(() => null),
    ]).then(([a, b]) => {
      if (typeof a?.value === 'string') setGa4Prop(a.value);
      if (typeof b?.value === 'string') setGscSite(b.value);
    });
  }, [clientId, editable]);

  useEffect(() => {
    if (!setupOpen || props) return;
    fetch('/api/google/properties')
      .then((r) => r.json())
      .then((d) => setProps(d))
      .catch(() => setProps({ gsc: [], ga4: [], connected: false }));
  }, [setupOpen, props]);

  async function saveSetup() {
    await Promise.all([
      fetch('/api/client-kv', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, key: 'ga4_property_id', value: ga4Prop.trim() }),
      }),
      fetch('/api/client-kv', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, key: 'gsc_site_url', value: gscSite.trim() }),
      }),
    ]).catch(() => {});
    setInsights({});      // drop the cache so the new property is queried
    setSetupSaved(true);
    setTimeout(() => setSetupSaved(false), 2500);
  }

  function autoVal(m: MetricDef, forYm: string): number | null {
    if (!m.auto) return null;

    if (m.group === 'ga4') {
      const g = insights[forYm]?.ga4;
      if (!g) return null;
      if (m.key === 'ga4_sessions') return g.sessions;
      if (m.key === 'ga4_users') return g.users;
      if (m.key === 'ga4_engaged') return g.engaged;
      if (m.key === 'ga4_conversions') return g.conversions;
      if (m.key === 'ga4_avg_engagement') return g.avgEngagement;
      return null;
    }

    if (m.group === 'gsc') {
      const g = insights[forYm]?.gsc;
      if (!g) return null;
      if (m.key === 'gsc_impressions') return g.impressions;
      if (m.key === 'gsc_clicks') return g.clicks;
      if (m.key === 'gsc_ctr') return g.ctr;
      if (m.key === 'gsc_position') return g.position;
      return null;
    }

    if (!live) return null;
    // Rating and lifetime totals are point-in-time, so only current month.
    if (forYm !== realCurrentYM && (m.key === 'gbp_rating' || m.key === 'gbp_reviews_total' || m.key === 'gbp_response_rate')) {
      return null;
    }
    if (m.key === 'gbp_rating') return live.rating;
    if (m.key === 'gbp_reviews_total') return live.total;
    if (m.key === 'gbp_new_reviews') return forYm === ym ? live.newThisMonth : null;
    if (m.key === 'gbp_response_rate') return live.responseRate;
    return null;
  }

  function resolve(m: MetricDef, forYm: string): { value: number | null; isAuto: boolean } {
    const man = manual[m.key]?.[forYm];
    if (man != null) return { value: man, isAuto: false };
    const auto = autoVal(m, forYm);
    return { value: auto, isAuto: auto != null };
  }

  async function saveMetric(metric: string, value: number) {
    setManual((prev) => ({ ...prev, [metric]: { ...(prev[metric] || {}), [ym]: value } }));
    await fetch('/api/kpis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, metric, yearMonth: ym, value }),
    }).catch(() => {});
  }

  async function clearMetric(metric: string) {
    setManual((prev) => {
      const next = { ...prev, [metric]: { ...(prev[metric] || {}) } };
      delete next[metric][ym];
      return next;
    });
    await fetch(`/api/kpis?clientId=${encodeURIComponent(clientId)}&metric=${encodeURIComponent(metric)}&yearMonth=${ym}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  const prevYm = prevYearMonth(ym);

  // Hide a whole group from clients when it has nothing to show yet.
  function groupHasData(g: Group) {
    return METRICS.filter((m) => m.group === g).some((m) => resolve(m, ym).value != null);
  }

  const visibleGroups = GROUPS.filter((g) => editable || groupHasData(g.key));

  if (!editable && visibleGroups.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black text-white"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              G
            </span>
            Google Performance
          </h3>
          <p className="text-[11px] text-white/55 mt-0.5">
            {editable
              ? 'Business Profile pulls live from synced reviews. Ads, website and search numbers are entered here — click any tile.'
              : <>Your Google results{clientName ? ` for ${clientName}` : ''}, compared with {labelYM(prevYm)}.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <button
              onClick={() => setSetupOpen((o) => !o)}
              title="Connect this client's GA4 property and Search Console site"
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
              Connect
            </button>
          )}
          <select
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border text-white focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            {months.map((m) => (
              <option key={m} value={m} className="bg-slate-900">{labelYM(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {editable && setupOpen && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[12px] font-bold text-white mb-1">Connect Google reporting</div>
          <p className="text-[10.5px] text-white/50 mb-3">
            Website and search numbers pull automatically once these are set. They use the agency&apos;s Google
            connection — if nothing appears, reconnect Google under Settings so the new reporting permissions apply.
          </p>
          {props === null ? (
            <div className="text-[11.5px] text-white/50 py-2">Checking what your Google account can see…</div>
          ) : (
            <>
              {!!props.notes?.length && (
                <div className="text-[11px] text-amber-300 mb-2">{props.notes.join(' ')}</div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">GA4 Property</span>
                  {props.ga4.length > 0 ? (
                    <select
                      value={ga4Prop}
                      onChange={(e) => setGa4Prop(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-white text-[12px] outline-none"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      <option value="" className="bg-slate-900">— none —</option>
                      {props.ga4.map((p) => (
                        <option key={p.property} value={p.property} className="bg-slate-900">
                          {p.displayName} ({p.property}){p.account ? ` · ${p.account}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={ga4Prop}
                      onChange={(e) => setGa4Prop(e.target.value)}
                      placeholder="e.g. 123456789"
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-white text-[12px] outline-none"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  )}
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Search Console Site</span>
                  {props.gsc.length > 0 ? (
                    <select
                      value={gscSite}
                      onChange={(e) => setGscSite(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-white text-[12px] outline-none"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      <option value="" className="bg-slate-900">— none —</option>
                      {props.gsc.map((p) => (
                        <option key={p.siteUrl} value={p.siteUrl} className="bg-slate-900">
                          {p.siteUrl} · {p.permissionLevel.replace('site', '').toLowerCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={gscSite}
                      onChange={(e) => setGscSite(e.target.value)}
                      placeholder="https://example.com/ or sc-domain:example.com"
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-white text-[12px] outline-none"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  )}
                </label>
              </div>
              {props.connected && props.gsc.length === 0 && (
                <div className="text-[10.5px] text-white/45 mt-2">
                  No Search Console properties visible to {props.account}. Ask corporate to add that address
                  as a user on the location&apos;s property, then reopen this panel.
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={saveSetup}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              Save &amp; refresh
            </button>
            {setupSaved && <span className="text-[11px] font-semibold text-emerald-400">Saved</span>}
            {insights[ym]?.connected === false && (
              <span className="text-[11px] text-amber-300">Google isn&apos;t connected — reconnect it in Settings.</span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-white/55 py-8 text-center">Loading…</div>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((g) => {
            const groupMetrics = METRICS.filter((m) => m.group === g.key);
            const shown = editable ? groupMetrics : groupMetrics.filter((m) => resolve(m, ym).value != null);
            return (
              <div key={g.key}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="material-symbols-outlined text-white/45" style={{ fontSize: 15 }}>{g.icon}</span>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-white/70">{g.label}</span>
                  <span className="text-[10.5px] text-white/35 truncate">{g.blurb}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {shown.map((m) => {
                    const { value, isAuto } = resolve(m, ym);
                    const prev = resolve(m, prevYm);
                    const delta = value != null && prev.value != null ? value - prev.value : null;
                    const deltaPct = value != null && prev.value != null && prev.value !== 0
                      ? ((value - prev.value) / Math.abs(prev.value)) * 100 : null;
                    const goodUp = m.goodWhenUp !== false;
                    const deltaGood = delta != null && (goodUp ? delta > 0 : delta < 0);
                    const deltaBad = delta != null && (goodUp ? delta < 0 : delta > 0);
                    const isEditing = editingKey === m.key;
                    const hasOverride = manual[m.key]?.[ym] != null;

                    return (
                      <div
                        key={m.key}
                        onClick={() => {
                          if (editable && !isEditing) {
                            setEditingKey(m.key);
                            setDraft(value != null ? String(value) : '');
                          }
                        }}
                        className="rounded-xl p-3 flex flex-col gap-1.5"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          cursor: editable ? 'pointer' : 'default',
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-white/45 flex items-center gap-1 min-w-0">
                            <span className="material-symbols-outlined text-white/40 shrink-0" style={{ fontSize: 13 }}>{m.icon}</span>
                            <span className="truncate">{m.label}</span>
                          </span>
                          {editable && value != null && (
                            isAuto
                              ? <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold uppercase tracking-wide shrink-0">auto</span>
                              : hasOverride && m.auto
                                ? <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold uppercase tracking-wide shrink-0">manual</span>
                                : null
                          )}
                        </div>

                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            step="any"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => {
                              const v = Number(draft);
                              if (!isNaN(v) && draft.trim() !== '') saveMetric(m.key, v);
                              setEditingKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = Number(draft);
                                if (!isNaN(v) && draft.trim() !== '') saveMetric(m.key, v);
                                setEditingKey(null);
                              } else if (e.key === 'Escape') setEditingKey(null);
                            }}
                            className="w-full px-2 py-1 rounded text-white text-[16px] font-bold outline-none"
                            style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${gradientTo}` }}
                          />
                        ) : (
                          <div className="text-[20px] font-black text-white leading-none tabular-nums">
                            {value != null ? m.fmt(value) : <span className="text-white/30 text-[15px]">—</span>}
                          </div>
                        )}

                        <div className="min-h-[14px]">
                          {delta != null && delta !== 0 && (
                            <span className={`text-[9px] font-semibold ${deltaGood ? 'text-emerald-400' : deltaBad ? 'text-rose-400' : 'text-white/45'}`}>
                              {delta > 0 ? '▲' : '▼'} {m.fmt(Math.abs(delta))}
                              {deltaPct != null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%)`}
                            </span>
                          )}
                          {editable && hasOverride && m.auto && !isEditing && (
                            <button
                              onClick={(e) => { e.stopPropagation(); clearMetric(m.key); }}
                              className="text-[8px] text-white/40 hover:text-white ml-2"
                            >
                              reset to auto
                            </button>
                          )}
                        </div>
                      </div>
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
