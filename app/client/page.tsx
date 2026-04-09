import { createClient } from '@/lib/supabase/server';
import { clients } from '@/lib/clients';

/**
 * Client Overview — the only stats the client sees.
 *
 * Deliberately omitted:
 *  - Lead follow-up warnings
 *  - MNA internal checklist
 *  - AI insights / agents
 *  - Cost per lead when we don't have ad platform data (so we don't show a "$—" that looks broken)
 *
 * For Prime IV Niceville the numbers come straight from the GHL manual pull
 * (464 leads, 16.59% conv, 77 Won, $72.99K revenue, pipeline $160.62K).
 * Those values mirror what app/page.tsx renders for staff, minus the warning UI.
 */

type KPI = { label: string; value: string; sub?: string; color: string };

function primeIvNicevilleKPIs(): KPI[] {
  return [
    { label: 'Total Leads (30d)',    value: '464',     sub: 'GHL pipeline',           color: '#0ea5e9' },
    { label: 'Conversion Rate',      value: '16.59%',  sub: 'Above 14% target',       color: '#8b5cf6' },
    { label: 'Booked Appointments',  value: '77',      sub: 'Won opportunities',      color: '#ec4899' },
    { label: 'March Revenue',        value: '$54.5K',  sub: '+3.8% vs February',      color: '#06b6d4' },
  ];
}

function defaultKPIs(): KPI[] {
  return [
    { label: 'Leads this month', value: '—', sub: 'Waiting on live data', color: '#0ea5e9' },
  ];
}

// Real monthly revenue from the client (Jan/Feb/Mar 2026). Shown as a
// revenue trajectory, not leads, since revenue is the number Jennifer
// actually cares about and we have it confirmed.
const REVENUE_HISTORY_NICEVILLE = [
  { month: 'Jan', value: 49400 },
  { month: 'Feb', value: 52500 },
  { month: 'Mar', value: 54500 },
];

const TOP_POSTS = [
  { platform: 'Instagram', title: 'Spa walkthrough reel',        engagement: 4820, reach: 28400, type: 'Reel' },
  { platform: 'Instagram', title: 'After Hours giveaway',        engagement: 3210, reach: 18600, type: 'Post' },
  { platform: 'Facebook',  title: 'Spring Reset Bundle launch',  engagement: 1840, reach: 12200, type: 'Post' },
  { platform: 'Instagram', title: 'Real client review',          engagement: 2670, reach: 14100, type: 'Reel' },
];

export default async function ClientOverviewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const clientId = (meta.client_id as string) || 'prime-iv';
  const client = clients.find((c) => c.id === clientId) || clients.find((c) => c.id === 'prime-iv')!;

  const isNiceville = client.id === 'prime-iv';
  const kpis = isNiceville ? primeIvNicevilleKPIs() : defaultKPIs();
  const history = isNiceville ? REVENUE_HISTORY_NICEVILLE : [];
  const historyMax = history.length > 0 ? Math.max(...history.map((t) => t.value)) : 1;
  const { gradientFrom, gradientTo } = client.branding;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-extrabold text-neutral-900">Hi {client.shortName}, here's the latest 👋</h1>
        <p className="text-[13px] text-neutral-500 mt-1">
          Your top-line results, content performance, and the content calendar for your review.
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

      {/* Revenue trajectory (real numbers) */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold text-neutral-900">Revenue · last 3 months</div>
              <div className="text-[11px] text-neutral-500">Actuals confirmed with the team</div>
            </div>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              +{Math.round(((history[history.length - 1].value / history[0].value) - 1) * 100)}% vs Jan
            </span>
          </div>
          <div className="flex items-end gap-4 h-36">
            {history.map((t) => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[11px] font-bold text-neutral-800">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(t.value)}
                </div>
                <div
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${(t.value / historyMax) * 100}%`,
                    background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})`,
                  }}
                />
                <div className="text-[10px] font-semibold text-neutral-500">{t.month} 2026</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content performance */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold text-neutral-900">Top performing content</div>
          <span className="text-[11px] text-neutral-400">Last 30 days</span>
        </div>
        <div className="grid gap-3">
          {TOP_POSTS.map((p, i) => (
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

      {/* Meta Ads Account card (only if client has one configured) */}
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
                    ✓ {client.metaAds.datasetPixel.status || 'Active'}
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
