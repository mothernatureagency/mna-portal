/**
 * One-off manual seed: load the June 2026 PDM brand-cascade calendar into
 * the live content_calendar for Prime IV — Niceville. Mirrors the exact
 * insert logic of app/api/content-calendar/route.ts (dedupe + PDM
 * auto-approve). Idempotent — safe to re-run.
 *
 * Run:  npx tsx scripts/seed-june-pdm.ts
 */
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { getPlaybook } from '../lib/agents/playbooks';

const CLIENT_NAME = 'Prime IV — Niceville';
const PLAYBOOK_ID = 'prime-iv-pdm-jun-2026';
const START_DATE = '2026-06-01';

// Load .env.local into process.env (simple KEY=VALUE parser, strips quotes).
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const raw = process.env.POSTGRES_URL;
if (!raw) throw new Error('POSTGRES_URL is not set');
const connectionString = raw.replace(/[?&]sslmode=[^&]*/g, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?$/, '');
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1 });

function dayOffsetDate(startDate: string, day: number): string {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + (day - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getOrCreateProject(clientName: string): Promise<string> {
  const existing = await pool.query('select id from projects where client_name = $1 limit 1', [clientName]);
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await pool.query('insert into projects (name, client_name) values ($1, $2) returning id', [`${clientName} Content`, clientName]);
  return created.rows[0].id;
}

async function main() {
  const pb = getPlaybook(PLAYBOOK_ID);
  if (!pb) throw new Error(`Unknown playbook ${PLAYBOOK_ID}`);

  const projectId = await getOrCreateProject(CLIENT_NAME);
  let inserted = 0;
  let skipped = 0;

  for (const it of pb.items) {
    const isPDM = typeof it.phase === 'string' && /^PDM\b/i.test(it.phase);
    const post_date = dayOffsetDate(START_DATE, it.day);
    const title = `[${it.phase}] ${it.title} — Hook: ${it.hook} | CTA: ${it.cta}`;
    const status = isPDM ? 'Reference' : 'Draft';
    const assigned_role = isPDM ? 'PDM (Brand)' : 'Social Media Manager';
    const caption = it.caption || null;
    const approval = isPDM ? 'approved' : caption ? 'pending_review' : 'drafting';
    const visible = isPDM;

    const dupe = await pool.query(
      `select id from content_calendar
        where project_id = $1 and post_date = $2 and platform = $3
          and coalesce(title, '') = coalesce($4, '') limit 1`,
      [projectId, post_date, it.platform, title],
    );
    if (dupe.rows[0]) { skipped++; continue; }

    await pool.query(
      `insert into content_calendar
        (project_id, post_date, platform, content_type, title, status, assigned_role, caption, client_approval_status, client_visible)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [projectId, post_date, it.platform, it.content_type || null, title, status, assigned_role, caption, approval, visible],
    );
    inserted++;
    console.log(`  + ${post_date}  ${it.platform.padEnd(10)} ${isPDM ? 'PDM ' : 'MNA '} ${it.title}`);
  }

  console.log(`\nDone. project=${projectId}  inserted=${inserted}  skipped(existing)=${skipped}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
