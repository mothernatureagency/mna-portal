/**
 * Seed real Meta Ads KPIs into kpi_entries so each client portal's
 * "Performance KPIs" card shows accurate numbers (with MoM deltas).
 *
 * Numbers below were pulled live from the Meta Marketing API on 2026-08-07
 * (account-level insights per ad account):
 *   - Prime IV Holland, MI      (act_528867749112682)  — Jul 1–31 + Aug 1–6 MTD
 *   - Prime IV High Street, AZ  (act_1388386341735193) — Jul 1–31 + Aug 1–6 MTD
 *   - Prime IV Niceville, FL    (act_2442716609415436) — Aug 1–6 MTD only
 *     (July already captured on the portal — picking up where we left off)
 *
 * Metric keys match KPISection.tsx (ad_spend, impressions, clicks, ctr, cpc).
 * ctr is stored as the percent number (2.70 → "2.70%"). Re-running is safe:
 * rows upsert on (client_id, metric, year_month).
 *
 * Run: npx tsx scripts/seed-meta-kpis.ts
 */
import { readFileSync } from 'fs';
import { Pool } from 'pg';

for (const line of readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m) continue;
  let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(process.env[m[1]]===undefined)process.env[m[1]]=v;
}
const cs=process.env.POSTGRES_URL!.replace(/[?&]sslmode=[^&]*/g,(m)=>m.startsWith('?')?'?':'').replace(/\?$/,'');
const pool=new Pool({connectionString:cs,ssl:{rejectUnauthorized:false},max:1});

// `followers` renders on the portal KPI card too — add it to any period below
// once the count is known (the Meta Ads connection can't read page/IG follower
// counts until the IG accounts are linked with instagram_basic permission).
type Metrics = { ad_spend: number; impressions: number; clicks: number; ctr: number; cpc: number; followers?: number };
type Period = { yearMonth: string; note: string; metrics: Metrics };
type ClientSeed = {
  label: string;
  staticId?: string;        // built-in clients (lib/clients.ts)
  namePattern?: string;     // custom clients — resolved against custom_clients by name
  periods: Period[];
};

const SEEDS: ClientSeed[] = [
  {
    label: 'Prime IV — Holland, MI',
    namePattern: '%holland%',
    periods: [
      { yearMonth: '2026-07', note: 'Meta Ads · Jul 1–31 · pulled 2026-08-07',
        metrics: { ad_spend: 561.48, impressions: 40091, clicks: 1083, ctr: 2.70, cpc: 0.52 } },
      { yearMonth: '2026-08', note: 'Meta Ads · Aug 1–6 month-to-date · pulled 2026-08-07',
        metrics: { ad_spend: 149.39, impressions: 14783, clicks: 304, ctr: 2.06, cpc: 0.49 } },
    ],
  },
  {
    label: 'Prime IV — High Street (Phoenix, AZ)',
    namePattern: '%high%street%',
    periods: [
      { yearMonth: '2026-07', note: 'Meta Ads · Jul 1–31 · pulled 2026-08-07',
        metrics: { ad_spend: 1542.13, impressions: 46507, clicks: 1079, ctr: 2.32, cpc: 1.43 } },
      { yearMonth: '2026-08', note: 'Meta Ads · Aug 1–6 month-to-date · pulled 2026-08-07',
        metrics: { ad_spend: 258.81, impressions: 7452, clicks: 143, ctr: 1.92, cpc: 1.81 } },
    ],
  },
  {
    label: 'Prime IV — Niceville',
    staticId: 'prime-iv',
    periods: [
      { yearMonth: '2026-08', note: 'Meta Ads · Aug 1–6 month-to-date · pulled 2026-08-07',
        metrics: { ad_spend: 39.49, impressions: 2539, clicks: 59, ctr: 2.32, cpc: 0.67 } },
    ],
  },
];

async function resolveClientId(seed: ClientSeed): Promise<string | null> {
  if (seed.staticId) return seed.staticId;
  const { rows } = await pool.query(
    'select id, name from custom_clients where name ilike $1 order by created_at asc',
    [seed.namePattern],
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) console.warn(`  multiple matches for ${seed.label}: ${rows.map(r=>r.id).join(', ')} — using ${rows[0].id}`);
  return rows[0].id;
}

async function main() {
  for (const seed of SEEDS) {
    const clientId = await resolveClientId(seed);
    if (!clientId) {
      const { rows } = await pool.query('select id, name from custom_clients order by created_at asc');
      console.error(`✗ ${seed.label}: no custom_clients row matches "${seed.namePattern}".`);
      console.error(`  Existing custom clients: ${rows.map(r=>`${r.id} (${r.name})`).join(', ') || '(none)'}`);
      continue;
    }
    for (const p of seed.periods) {
      for (const [metric, value] of Object.entries(p.metrics)) {
        await pool.query(
          `insert into kpi_entries (client_id, metric, year_month, value, note)
           values ($1,$2,$3,$4,$5)
           on conflict (client_id, metric, year_month)
           do update set value = excluded.value, note = excluded.note, updated_at = now()`,
          [clientId, metric, p.yearMonth, value, p.note],
        );
      }
      console.log(`✓ ${seed.label} [${clientId}] ${p.yearMonth}: ad_spend $${p.metrics.ad_spend}, ${p.metrics.impressions} impressions, ${p.metrics.clicks} clicks, ${p.metrics.ctr}% CTR, $${p.metrics.cpc} CPC`);
    }
  }
  await pool.end();
}
main().catch((e)=>{console.error(e.message);process.exit(1);});
