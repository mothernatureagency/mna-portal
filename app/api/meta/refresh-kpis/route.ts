import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { clients as staticClients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Monthly Meta KPI refresh. Meant to run on the 1st of each month (Vercel
 * cron in vercel.json). Pulls LAST month's spend/leads/clicks/etc. for every
 * client's ad account and writes them to kpi_entries (that month) + updates
 * the editable dashboard_stats. Needs META_ACCESS_TOKEN with ads_read on the
 * MNA business. Secret-gated (CRON_SECRET header or ?secret=SEED_SECRET).
 */

const GRAPH = 'https://graph.facebook.com/v20.0';
const TOKEN = process.env.META_ACCESS_TOKEN;

function actId(id: string) { return /^act_/.test(id) ? id : `act_${id}`; }
function lastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { since: iso(start), until: iso(end), ym: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` };
}
const money = (n: number) => `$${n >= 1000 ? (n / 1000).toFixed(1) + 'K' : Math.round(n)}`;

async function accountInsights(adAccountId: string, since: string, until: string) {
  const url = `${GRAPH}/${actId(adAccountId)}/insights?level=account&fields=spend,impressions,clicks,cpc,ctr,actions&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&access_token=${TOKEN}`;
  const r = await fetch(url);
  const j: any = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const row = (j.data || [])[0] || {};
  const spend = Number(row.spend || 0);
  const clicks = Number(row.clicks || 0);
  const impressions = Number(row.impressions || 0);
  const leads = (row.actions || []).filter((a: any) => /lead/i.test(a.action_type)).reduce((s: number, a: any) => s + Number(a.value || 0), 0);
  return { spend, clicks, impressions, cpc: Number(row.cpc || 0), ctr: Number(row.ctr || 0), leads };
}

async function adAccountFor(clientId: string): Promise<string | null> {
  const s = staticClients.find((c) => c.id === clientId);
  const kv = await query<{ value: any }>(`select value from client_kv where client_id=$1 and key='meta_ads'`, [clientId]);
  return kv.rows[0]?.value?.adAccountId || (s as any)?.metaAds?.adAccountId || null;
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const authHeader = req.headers.get('authorization') || '';
  const secret = req.nextUrl.searchParams.get('secret') || '';
  const okCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const okSecret = !!process.env.SEED_SECRET && secret === process.env.SEED_SECRET;
  if (!okCron && !okSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!TOKEN) return NextResponse.json({ error: 'META_ACCESS_TOKEN not set — add a System User token to enable the monthly refresh.', updated: 0 }, { status: 200 });

  const { since, until, ym } = lastMonthRange();

  // Every client with an ad account: static built-ins + custom clients.
  const ids = new Set<string>(staticClients.filter((c) => (c as any).metaAds?.adAccountId).map((c) => c.id));
  const { rows: custom } = await query<{ id: string }>(`select id from custom_clients`);
  for (const c of custom) ids.add(c.id);

  const results: any[] = [];
  for (const clientId of Array.from(ids)) {
    const adAccountId = await adAccountFor(clientId);
    if (!adAccountId) continue;
    try {
      const d = await accountInsights(adAccountId, since, until);
      const cpl = d.leads > 0 ? d.spend / d.leads : 0;
      // kpi_entries (Niceville/Pinecrest style dashboards)
      const kpis: Record<string, number> = { ad_spend: d.spend, impressions: d.impressions, clicks: d.clicks, cpc: d.cpc, ctr: d.ctr, leads: d.leads };
      for (const [metric, value] of Object.entries(kpis)) {
        await query(
          `insert into kpi_entries (client_id, metric, year_month, value, note) values ($1,$2,$3,$4,'Meta actual')
           on conflict (client_id, metric, year_month) do update set value=excluded.value, note=excluded.note`,
          [clientId, metric, ym, value]);
      }
      // dashboard_stats (generic dashboards)
      const cur = await query<{ value: any }>(`select value from client_kv where client_id=$1 and key='dashboard_stats'`, [clientId]);
      const stats = (cur.rows[0]?.value && typeof cur.rows[0].value === 'object') ? cur.rows[0].value : {};
      const note = `Meta · ${ym}`;
      stats.adSpend = { ...(stats.adSpend || {}), value: money(d.spend), note };
      stats.leads = { ...(stats.leads || {}), value: String(d.leads), note };
      stats.cpl = { ...(stats.cpl || {}), value: d.leads > 0 ? `$${cpl.toFixed(2)}` : '—', note };
      await query(
        `insert into client_kv (client_id,key,value,updated_at) values ($1,'dashboard_stats',$2::jsonb,now())
         on conflict (client_id,key) do update set value=excluded.value, updated_at=now()`,
        [clientId, JSON.stringify(stats)]);
      results.push({ clientId, spend: d.spend, leads: d.leads });
    } catch (e: any) {
      results.push({ clientId, error: e.message });
    }
  }
  return NextResponse.json({ ym, updated: results.length, results });
}
