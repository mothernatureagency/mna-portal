import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { getPlaybook } from '../lib/agents/playbooks';

const PLAYBOOK_ID = 'prime-iv-pdm-aug-2026';
const START_DATE = '2026-08-01';
const CLIENT_NAMES = [
  'Prime IV — Niceville',
  'Prime IV — Pinecrest',
  'Prime IV — High Street',
  'Prime IV — Holland, MI',
];

for (const line of readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m) continue;
  let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(process.env[m[1]]===undefined)process.env[m[1]]=v;
}
const cs=process.env.POSTGRES_URL!.replace(/[?&]sslmode=[^&]*/g,(m)=>m.startsWith('?')?'?':'').replace(/\?$/,'');
const pool=new Pool({connectionString:cs,ssl:{rejectUnauthorized:false},max:1});

function dayOffsetDate(startDate: string, day: number): string {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + (day - 1));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function getOrCreateProject(name: string): Promise<string> {
  const e=await pool.query('select id from projects where client_name=$1 limit 1',[name]);
  if(e.rows[0]) return e.rows[0].id;
  const c=await pool.query('insert into projects (name, client_name) values ($1,$2) returning id',[`${name} Content`,name]);
  return c.rows[0].id;
}
async function main(){
  const pb=getPlaybook(PLAYBOOK_ID); if(!pb) throw new Error('no playbook');
  for(const clientName of CLIENT_NAMES){
    const projectId=await getOrCreateProject(clientName);
    let ins=0, skip=0;
    for(const it of pb.items){
      const isPDM = typeof it.phase==='string' && /^PDM\b/i.test(it.phase);
      const post_date=dayOffsetDate(START_DATE,it.day);
      const title=`[${it.phase}] ${it.title} — Hook: ${it.hook} | CTA: ${it.cta}`;
      const dupe=await pool.query(
        `select id from content_calendar where project_id=$1 and post_date=$2 and platform=$3 and coalesce(title,'')=coalesce($4,'') limit 1`,
        [projectId,post_date,it.platform,title]);
      if(dupe.rows[0]){skip++;continue;}
      await pool.query(
        `insert into content_calendar (project_id,post_date,platform,content_type,title,status,assigned_role,caption,client_approval_status,client_visible)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [projectId,post_date,it.platform,it.content_type||null,title,
         isPDM?'Reference':'Draft', isPDM?'PDM (Brand)':'Social Media Manager', it.caption||null,
         isPDM?'scheduled':(it.caption?'pending_review':'drafting'), isPDM]);
      ins++;
    }
    console.log(`${clientName}: inserted ${ins}, skipped ${skip}`);
  }
  await pool.end();
}
main().catch(e=>{console.error(e.message);process.exit(1);});
