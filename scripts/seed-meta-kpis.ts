/**
 * Pull live Meta ad stats (spend, leads, CPL) per client from the Meta Graph
 * API and write them into each client's editable dashboard KPI stats
 * (client_kv key 'dashboard_stats'). Read-only against Meta; only updates the
 * Meta-derived fields, preserving your manual target/note values.
 *
 * Run:  npx tsx scripts/seed-meta-kpis.ts
 */
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { clients as staticClients } from '../lib/clients';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue;
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const TOKEN = process.env.META_ACCESS_TOKEN;
const GRAPH = 'https://graph.facebook.com/v20.0';
const DATE_PRESET = 'last_30d';

const cs = process.env.POSTGRES_URL!.replace(/[?&]sslmode=[^&]*/g, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?$/, '');
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 1 });

function actId(id: string) { return /^act_/.test(id) ? id : `act_${id}`; }
const money = (n: number) => `$${n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0)}`;

async function metaAccountInsights(adAccountId: string) {
  const url = `${GRAPH}/${actId(adAccountId)}/insights?level=account&fields=spend,actions,cost_per_action_type&date_preset=${DATE_PRESET}&access_token=${TOKEN}`;
  const r = await fetch(url);
  const j: any = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const row = (j.data || [])[0];
  if (!row) return { spend: 0, leads: 0 };
  const spend = Number(row.spend || 0);
  const leads = (row.actions || [])
    .filter((a: any) => /lead/i.test(a.action_type))
    .reduce((s: number, a: any) => s + Number(a.value || 0), 0);
  return { spend, leads };
}

// Resolve every client (static + custom) that has a Meta ad account id.
async function clientsWithAdAccounts(): Promise<{ id: string; name: string; adAccountId: string }[]> {
  const out: { id: string; name: string; adAccountId: string }[] = [];
  for (const c of staticClients) {
    if ((c as any).metaAds?.adAccountId) out.push({ id: c.id, name: c.shortName, adAccountId: (c as any).metaAds.adAccountId });
  }
  const { rows } = await pool.query(`select id, short_name from custom_clients`);
  for (const cc of rows) {
    const kv = await pool.query(`select value from client_kv where client_id=$1 and key='meta_ads'`, [cc.id]);
    const adAccountId = kv.rows[0]?.value?.adAccountId;
    if (adAccountId && !out.some((o) => o.id === cc.id)) out.push({ id: cc.id, name: cc.short_name, adAccountId });
  }
  return out;
}

async function main() {
  if (!TOKEN) { console.error('META_ACCESS_TOKEN not set in .env.local'); process.exit(1); }
  const targets = await clientsWithAdAccounts();
  if (targets.length === 0) { console.log('No clients have a Meta ad account set (add one via the dashboard Meta Ads card).'); await pool.end(); return; }

  const stamp = new Date().toISOString().slice(0, 10);
  for (const t of targets) {
    try {
      const { spend, leads } = await metaAccountInsights(t.adAccountId);
      const cpl = leads > 0 ? spend / leads : 0;

      // Merge into existing dashboard_stats, keeping manual targets/notes.
      const cur = await pool.query(`select value from client_kv where client_id=$1 and key='dashboard_stats'`, [t.id]);
      const stats = (cur.rows[0]?.value && typeof cur.rows[0].value === 'object') ? cur.rows[0].value : {};
      const note = `Meta · 30d (synced ${stamp})`;
      stats.adSpend = { ...(stats.adSpend || {}), value: money(spend), note };
      stats.leads = { ...(stats.leads || {}), value: String(leads), note };
      stats.cpl = { ...(stats.cpl || {}), value: leads > 0 ? `$${cpl.toFixed(2)}` : '—', note };

      await pool.query(
        `insert into client_kv (client_id,key,value,updated_at) values ($1,'dashboard_stats',$2::jsonb,now())
         on conflict (client_id,key) do update set value=excluded.value, updated_at=now()`,
        [t.id, JSON.stringify(stats)]);
      console.log(`✓ ${t.name.padEnd(24)} spend ${money(spend)} · leads ${leads} · CPL ${leads > 0 ? '$' + cpl.toFixed(2) : '—'}`);
    } catch (e: any) {
      console.log(`✗ ${t.name.padEnd(24)} ${e.message}`);
    }
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
