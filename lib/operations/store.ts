import { query } from '@/lib/db';
import { clients } from '@/lib/clients';
import { assertClientScope, cleanText, requireMonth, ROLE_IDS } from './policy';
import type { McpIdentity } from '@/lib/mcp/auth';

let ready: Promise<void> | null = null;
export async function ensureOperations() {
  if (!ready) ready = (async () => {
    await query(`create table if not exists operations_plans (
      client_id text not null, month text not null, plan jsonb not null,
      updated_by text not null, updated_at timestamptz not null default now(), primary key(client_id, month))`);
    await query(`create table if not exists operations_runs (
      id uuid primary key default gen_random_uuid(), client_id text not null, month text not null,
      fingerprint text not null, status text not null default 'running', actor text not null,
      brief text, output jsonb, error text, usage jsonb, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(), unique(client_id, month, fingerprint))`);
    await query(`create table if not exists operations_handoffs (
      id uuid primary key default gen_random_uuid(), client_id text not null, month text not null,
      sender text not null, recipient text not null, message text not null, actor text not null,
      run_id uuid references operations_runs(id), created_at timestamptz not null default now())`);
    await query(`create unique index if not exists operations_request_dedupe on client_requests(client_id, title) where title like '[Operations] %' and status <> 'done'`);
  })().catch(error => { ready = null; throw error; });
  await ready;
}
export async function requireClient(clientId: unknown, identity: McpIdentity) {
  const id = cleanText(clientId, 120, 'Client ID');
  assertClientScope(id, identity.clientIds);
  const known = clients.find(c => c.id === id);
  if (known) return { id, name: known.name, links: known.links || {} };
  const { rows } = await query('select id, name from custom_clients where id=$1', [id]);
  if (!rows[0]) throw new Error('Choose an existing portal client.');
  return { id, name: String(rows[0].name), links: {} as NonNullable<typeof known>['links'] };
}
export type Plan = { source: string; text: string; bookingUrl: string; address: string; fpEmail: string; sendDate: string };
export async function getPlan(clientId: string, month: string): Promise<Plan | null> {
  await ensureOperations();
  const { rows } = await query('select plan from operations_plans where client_id=$1 and month=$2', [clientId, month]);
  return rows[0]?.plan || null;
}
export async function addHandoff(clientId: string, month: string, sender: string, recipient: string, message: string, actor: string, runId?: string) {
  if (!ROLE_IDS.includes(sender as any) || !ROLE_IDS.includes(recipient as any)) throw new Error('Choose a known agent role.');
  const text = cleanText(message, 8000, 'Handoff');
  await ensureOperations();
  return (await query(`insert into operations_handoffs(client_id,month,sender,recipient,message,actor,run_id)
    values($1,$2,$3,$4,$5,$6,$7) returning *`, [clientId, requireMonth(month), sender, recipient, text, actor, runId || null])).rows[0];
}
export async function requestInfo(clientId: string, items: string[], fpEmail: string) {
  await ensureOperations();
  for (const item of Array.from(new Set(items)).slice(0, 20)) {
    const title = `[Operations] ${item.slice(0, 200)}`;
    await query(`insert into client_requests(client_id,title,description,assigned_to)
      values($1,$2,$3,$4) on conflict (client_id,title) where title like '[Operations] %' and status <> 'done' do nothing`,
      [clientId, title, 'Required for the monthly campaign. Confirm the facts and update the Agent Operations plan. No customer message has been sent.', fpEmail || 'team']);
  }
}
export async function snapshot(clientId: string, month: string) {
  await ensureOperations();
  // Only counts and configuration status: no customer message text or credentials.
  const campaigns = (await query(`select id,name,campaign_type,status,scheduled_date from campaigns
    where client_id=$1 and to_char(scheduled_date,'YYYY-MM')=$2 order by scheduled_date`, [clientId, month])).rows;
  const locations = (await query(`select name, token_encrypted is not null as connected,
    auto_respond_enabled,ai_paused,booking_url from ghl_locations where client_id=$1`, [clientId])).rows;
  const crm = (await query(`select m.status,count(*)::int as count from ai_messages m join ghl_locations l on l.ghl_location_id=m.ghl_location_id
    where l.client_id=$1 and m.status in ('awaiting_approval','escalated','failed') group by m.status`, [clientId])).rows;
  const metrics = (await query(`select metric,value,updated_at from kpi_entries where client_id=$1 and year_month=$2 order by metric`, [clientId, month])).rows;
  const requests = (await query(`select id,title,assigned_to from client_requests where client_id=$1 and status <> 'done' and title like '[Operations] %' order by created_at desc`, [clientId])).rows;
  const handoffs = (await query(`select * from operations_handoffs where client_id=$1 and month=$2 order by created_at desc limit 60`, [clientId, month])).rows;
  const runs = (await query(`select * from operations_runs where client_id=$1 and month=$2 order by created_at desc limit 10`, [clientId, month])).rows;
  const alerts = [];
  if (!locations.some(l => l.connected)) alerts.push('Revive connection needs a location token.');
  if (!metrics.length) alerts.push('No saved ad performance metrics for this month.');
  const today = new Date().toISOString().slice(0,10);
  const late = campaigns.filter(c => c.scheduled_date < today && !['sent','failed'].includes(c.status));
  if (late.length) alerts.push(`${late.length} campaigns are past their planned date.`);
  const waiting = crm.reduce((n, r) => n + r.count, 0);
  if (waiting) alerts.push(`${waiting} CRM replies need attention.`);
  if (runs.some(r => r.status === 'running' && Date.now() - new Date(r.created_at).getTime() > 180000)) alerts.push('An agent run stopped responding. Check the run before retrying.');
  const monitor = (await query("select value from client_kv where client_id=$1 and key='operations_monitor'",[clientId])).rows[0]?.value || null;
  return { campaigns, locations, crm, metrics, requests, handoffs, runs, alerts, monitor, checkedAt: new Date().toISOString() };
}
