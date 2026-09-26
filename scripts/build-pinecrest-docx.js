/**
 * Build the Prime IV Pinecrest agent build pack as a Word document.
 *
 *   npm i docx        # once; deliberately not added to package.json,
 *                     # since this is a client deliverable, not app code
 *   node scripts/build-pinecrest-docx.js
 *
 * docs/prime-iv-pinecrest-sms-agent.md is the single source of truth. The
 * prompt, the hard-facts table, every Q&A pair and the conflicts table are
 * parsed out of it, so the .docx cannot drift from the markdown — which it
 * did, twice, while the two were maintained separately.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'prime-iv-pinecrest-sms-agent.md');
const OUT = path.join(ROOT, 'docs', 'Prime_IV_Pinecrest_SMS_AI_Agent_Prompt_and_Knowledge_Base.docx');

let docx;
try { docx = require('docx'); }
catch { console.error("Missing dependency. Run:  npm i docx"); process.exit(1); }

const {Document,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,
       WidthType,ShadingType,BorderStyle,LevelFormat,AlignmentType}=docx;
const fs=require('fs');
const MD=fs.readFileSync(SRC,'utf8');

/** Rows of the markdown table that follows a heading. */
function tableAfter(h){
  const rows=[]; let started=false;
  for(const line of MD.slice(MD.indexOf(h)).split('\n')){
    if(line.startsWith('|')){
      const cells=line.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      if(/^[-: ]+$/.test(cells.join(''))) continue;
      rows.push(cells); started=true;
    } else if(started) break;
  }
  return rows;
}

/** Q&A pairs from section 2, with the menu block cut out. */
function qaPairs(){
  let r=MD.slice(MD.indexOf('### Q&A pairs'), MD.indexOf('### Explicitly excluded'));
  const ms=r.indexOf('### The menu'), me=r.indexOf('**Handoff note on the two surgical drips.**');
  if(ms>-1&&me>-1) r=r.slice(0,ms)+r.slice(r.indexOf('\n\n',me));
  const out=[];
  for(const m of r.matchAll(/\*\*Q: (.+?)\*\*\n((?:(?!\*\*Q:|###)[\s\S])*)/g)){
    const a=m[2].trim().replace(/^A:\s*/,'').split('\n').map(l=>l.trim()).filter(Boolean).join(' ')
      .replace(/-Prime IV Pinecrest/g,'\n-Prime IV Pinecrest').replace(/ \(/g,'\n(');
    out.push([m[1].trim(), a]);
  }
  return out;
}

/** The two "- [ ]" bullet groups under section 4. */
function checklists(){
  const sec=MD.slice(MD.indexOf('## 4. Phase 0 test checklist'), MD.indexOf('## 5.'));
  const split=sec.indexOf('Also confirm across the replay');
  const items=t=>[...t.matchAll(/^- \[ \] (.+)$/gm)].map(m=>m[1].trim());
  return {stops:items(sec.slice(0,split)), replay:items(sec.slice(split))};
}

const KB={facts:tableAfter('### Hard facts').slice(1), qa:qaPairs(),
          conflicts:tableAfter('### Conflicts the website turned up'),
          checks:checklists()};
const PROMPT_TEXT=MD.match(/## 1\. System prompt[\s\S]*?```\n([\s\S]*?)```/)[1].trimEnd();

const BODY='Calibri', MONO='Consolas';
const NAVY='1C3D6E', GREY='595959', SHADE='F2F5F8';

const p=(t,o={})=>new Paragraph({spacing:{after:o.after??140,line:280},
  children:[new TextRun({text:t,font:BODY,size:21,bold:o.bold,italics:o.italics,color:o.color})]});
const h1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:360,after:150},
  children:[new TextRun({text:t,font:BODY,size:30,bold:true,color:NAVY})]});
const h2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:260,after:110},
  children:[new TextRun({text:t,font:BODY,size:23,bold:true,color:NAVY})]});
const bul=t=>new Paragraph({numbering:{reference:'b',level:0},spacing:{after:70,line:280},
  children:[new TextRun({text:t,font:BODY,size:21})]});
const nl=(t,i)=>new Paragraph({spacing:{after:70,line:280},indent:{left:420,hanging:420},
  children:[new TextRun({text:i+'.',font:BODY,size:21,bold:true}),
            new TextRun({text:'\t'+t,font:BODY,size:21})]});
const code=t=>new Paragraph({spacing:{after:0,line:230},indent:{left:170,right:170},
  shading:{type:ShadingType.CLEAR,color:'auto',fill:SHADE},
  children:[new TextRun({text:t.length?t:' ',font:MONO,size:17})]});
const rule=()=>new Paragraph({spacing:{before:100,after:180},
  border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'D9D9D9'}},
  children:[new TextRun({text:'',size:2})]});

function table(headers,rows,widths){
  const total=widths.reduce((a,b)=>a+b,0);
  const row=(cells,hdr)=>new TableRow({tableHeader:!!hdr,children:cells.map((t,i)=>new TableCell({
    width:{size:widths[i],type:WidthType.DXA},
    shading:{type:ShadingType.CLEAR,color:'auto',fill:hdr?NAVY:'FFFFFF'},
    margins:{top:90,bottom:90,left:120,right:120},
    children:[new Paragraph({spacing:{after:0,line:250},
      children:[new TextRun({text:t,font:BODY,size:19,bold:!!hdr,color:hdr?'FFFFFF':'000000'})]})]})) });
  return new Table({columnWidths:widths,width:{size:total,type:WidthType.DXA},
    rows:[row(headers,true),...rows.map(r=>row(r,false))]});
}
const gap=()=>new Paragraph({spacing:{after:160},children:[new TextRun({text:'',size:2})]});

const PROMPT=PROMPT_TEXT.replace(/\r/g,'').split('\n');
const k=[];

k.push(new Paragraph({spacing:{after:60},children:[new TextRun({
  text:'Prime IV Pinecrest SMS AI — Agent Prompt & Knowledge Base',font:BODY,size:36,bold:true,color:NAVY})]}));
k.push(new Paragraph({spacing:{after:30},children:[new TextRun({
  text:'Sep 25, 2026  ·  Mother Nature Agency',font:BODY,size:19,color:GREY})]}));
k.push(new Paragraph({spacing:{after:200},children:[new TextRun({
  text:'Companion to the GHL Build Spec, Sep 19, 2026',font:BODY,size:19,italics:true,color:GREY})]}));
k.push(rule());

k.push(p('This is the paste-ready half of the build spec: the Conversation AI system prompt, the knowledge-base entries, and the workflow conditions that have to sit around the AI step rather than inside it.'));
k.push(p('Do not connect this to live traffic yet. All five prerequisites in the spec come first — HIPAA module purchased and BAA signed, integration audit done, calendars corrected to 10–5 seven days, the pricing rule applied, and the retention and access policy set. This document assumes Phase 0, suggest-only.',{bold:true}));
k.push(p('Field names may differ. Nobody has opened the Conversation AI settings screen on this account yet, so the headings below follow HighLevel’s usual layout. Each block is self-contained, so if a field is named differently on this plan, the block still pastes somewhere sensible.'));

k.push(h1('Decisions applied in this version'));
k.push(table(['Decision','Effect on the build'],[
 ['The bot may quote the $99 intro offer, and no other price until pricing is uploaded','A single-price rule in the prompt, gated on the contact’s tag. Every other price question routes to a person.'],
 ['No staff member is ever named','The prompt forbids naming anyone, and forbids confirming or denying who is working. Signature is “-Prime IV Pinecrest” only.'],
 ['“Is someone on call?” gets an internal comment to the location email','New workflow rule 3e. The client gets an acknowledgment, staff get an @-mention, the thread stays open.'],
 ['Booker is not used; booking is at primeivpinecrest.com','All Booker references removed. primeivpinecrest.com is the only link the bot gives.'],
 ['“Intro Offer” is the live voucher calendar','Tag routing targets it. “Intro Offer v1” is the orphan and should be retired, not left in place.'],
 ['Website facts loaded','Phone, cancellation policy, age limits, HSA/FSA, what the intro offer includes, the Essentials membership price and mobile IV all came off the homepage. Nine new Q&A pairs. Six conflicts with what we had are listed in their own section.'],
 ['Notification routing set','pinecrest@primeivhydration.com for everything, plus jkulkusky@primeivhydration.com for legal, media and regulatory. Notifications carry a link, never message content — and the agency address is deliberately not on the list.'],
 ['Hours are 10-5, not 10-6','Corrected everywhere: the prompt, the hard facts, the hours answer, the Phase 0 checklist and the calendar fix the browser session performs. A 5:00 close also changes what rule 3b means.'],
 ['Full menu pricing loaded','The agent may now quote drips, injections and NAD+ at the exact menu prices. Memberships and packages still route. Every menu description was rewritten — the printed copy breaks the language rule throughout.'],
 ['The FAQ document does not exist','The spec referenced one five times; it is not in Drive and was never written. The menu replaced it, and a spa-team review pass replaces the “tested phrasing” the spec assumed.'],
 ['Corrected since the first Word version','The intro-offer price is one KB entry that defers, overridden by the prompt — two entries keyed on the same question would collide. Rule 3d now names who sends the handoff line, so it cannot go out twice.'],
],[3400,5900]));

k.push(h1('1. System prompt'));
k.push(p('Paste into the agent’s prompt or instructions field.'));
PROMPT.forEach(l=>k.push(code(l)));
k.push(gap());

k.push(h1('2. Knowledge base'));
k.push(p('Paste as training question-and-answer pairs. This section is deliberately incomplete — see section 5.'));
k.push(h2('Hard facts'));
k.push(table(['Field','Value'],KB.facts,[3400,5900]));

k.push(h2('Question-and-answer pairs — ready to load'));
const QA=KB.qa;

QA.forEach(([q,a])=>{
  k.push(new Paragraph({spacing:{before:150,after:50},children:[new TextRun({text:'Q:  '+q,font:BODY,size:20,bold:true,color:NAVY})]}));
  a.split('\n').forEach((ln,i)=>k.push(new Paragraph({spacing:{after:i===a.split('\n').length-1?60:0,line:260},indent:{left:280},
    children:[new TextRun({text:(i===0?'A:  ':'     ')+ln,font:BODY,size:20,
      italics:ln.startsWith('('),color:ln.startsWith('(')?GREY:'000000'})]})));
});

k.push(h2('The menu — prices the agent may quote'));
k.push(p('Descriptions below are REWRITTEN, not the menu’s own wording. The printed menu is marketing copy and breaks the language rule on nearly every line (“boost”, “combats altitude sickness”, “helps fight diseases”, “prevent illnesses”, “reduces symptoms of depression”). Loading it verbatim would have the bot texting disease claims from a medical spa — the exact failure this build exists to avoid. Prices are facts and are reproduced exactly.'));
k.push(p('IV drips — $175',{bold:true}));
k.push(table(['Drip','What to say'],[['The After Burn','designed to support skin hydration and comfort after time in the sun'],['The After Party','designed to support hydration and comfort after a long night'],['The B’s Knees','a B-vitamin blend that may help support everyday energy'],['The Calm','designed to support relaxation, stress relief and recovery'],['The Hormone Harmony','designed to support hormonal balance'],['The Jetsetter','designed to support energy and relaxation while travelling'],['The Local','designed to support feel-good energy, mental focus and endurance'],['The Revitalizer','may help support natural energy and vitality'],['The Skinny Drip','designed to support metabolism and energy'],['The Summit','designed to support comfort and hydration at altitude'],['The Tummy Tamer','designed to support digestive comfort'],['The Weekend Warrior','designed to support performance, energy and lean muscle']],[3000,6300]));
k.push(gap());
k.push(p('IV drips — $210',{bold:true}));
k.push(table(['Drip','What to say'],[['The Burnout','designed to support hydration, nutrient replenishment and skin recovery'],['The Champion','a pre/post workout drip designed to support tissue repair and recovery'],['The Glow','designed to support skin, hair and nails'],['The Gut Guardian','gut-friendly nutrients designed to support digestion and comfort'],['The Immunity Armor','designed to support your body’s natural defenses'],['The Myer Cocktail','the classic all-in-one, designed to support overall wellness'],['Post-Bariatric Replenish','designed to support nutrient replenishment after weight loss surgery (see handoff note)'],['Pre/Post Surgical Renewal','designed to support recovery around a procedure (see handoff note)'],['The Resurrection','designed to support hydration and comfort after a long night'],['The Tourist','designed to support immunity and hydration while travelling']],[3000,6300]));
k.push(gap());
k.push(p('IV drips — $119',{bold:true}));
k.push(table(['Drip','What to say'],[['Anti-Inflammation - Magnesium','designed to support relaxation, circulation and sleep'],['Energy Boost - B12','designed to support energy, mood, nerve health, and skin, hair and nails'],['Heart Health - B6','designed to support immune and mood regulation'],['Muscle Rescue - Amino Acid Blend','designed to support muscle recovery, energy and circulation']],[3000,6300]));
k.push(gap());
k.push(p('Injections — all subject to availability; never promise one is in stock.',{bold:true}));
k.push(table(['Injection','Price','What to say'],[['Amino Acid Blend','$35','designed to support immune function, athletic performance and circulation'],['B-6','$30','may help support energy and metabolism'],['B-Complex (B-100)','$35','a balanced B blend designed to support sustained energy and nerve function'],['Biotin','$30','designed to support hair, skin and nails'],['CoQ10','$35','an antioxidant designed to support energy production and muscle endurance'],['Glutathione','$35','an antioxidant designed to support cell turnover and skin brightness'],['L-Arginine','$35','designed to support lean muscle and workout outcomes'],['L-Carnitine','$35','an amino acid that may help support brain, heart and muscle function'],['L-Lysine','$30','an essential amino acid designed to support energy and healthy tissue'],['Lipolean','$35','a vitamin, mineral and amino acid blend designed to support energy and metabolism'],['Magnesium Sulfate','$30','designed to support muscle comfort, relaxation and sleep'],['Methylcobalamin B-12','$30','designed to support energy, mood and nerve health'],['Taurine','$30','designed to support energy and mental focus'],['Vitamin C','$30','designed to support collagen production and immune health'],['Vitamin D','$35','“the sunshine vitamin”, designed to support overall wellness']],[2400,900,6000]));
k.push(gap());
k.push(p('NAD+ injections',{bold:true}));
k.push(table(['Dose','Single','4-pack'],[['100mg','$99','$345'],['250mg','$175','$610']],[3100,3100,3100]));
k.push(gap());
k.push(p('NAD+ is designed to support cellular health, energy and mental clarity.'));
k.push(p('Handoff note on the two surgical drips. Post-Bariatric Replenish and Pre/Post Surgical Renewal cannot be discussed without the client disclosing a procedure — which is handoff trigger 3d.2. A client asking about either has almost certainly just told you about their surgery. Quote the price if they only asked the price; the moment they mention their own procedure, recovery or timeline, the thread hands off. Never counsel anyone on whether a drip is right for their surgery.'));
k.push(h2('Explicitly excluded from the knowledge base'));
k.push(p('The agent routes rather than answers on anything the team has not settled. Do not load:'));
['Membership, package and bundle pricing, discounts, promo codes and “starting at” language — menu prices are fine',
 'The printed menu’s own descriptions. Load the rewritten wording only.',
 'Voucher expiration terms',
 'Membership rollover, pause and cancellation rules',
 'What “Mobile Services Consult” includes',
 'Anything sourced from existing campaign copy. The account’s current ads use “boost your energy” and “boost metabolism”, which violate the language rule. Build from the FAQ document only.'
].forEach(t=>k.push(bul(t)));

k.push(h1('3. Workflow scaffolding'));
k.push(p('Several rules cannot be enforced by a prompt — models negotiate with soft instructions. These belong in the workflow, evaluated before or after the AI step. Build every one of them.'));

k.push(h2('3a. Tag routing — runs before the AI step'));
k.push(p('Branch on the contact’s tags and hand the agent only the offer and calendar that apply. Do not give the agent every variant and ask it to choose.'));
k.push(table(['Tag state','Offer passed to agent','May say “$99”?','Calendar'],[
 ['first time + free-B12 entitlement tag','Free B-12 variant','No — hand off','Intro Offer'],
 ['first time, no entitlement tag','Standard $99 variant','Yes','Intro Offer'],
 ['sold / client-status active','None','No','Member calendar'],
 ['nad / interested-nad','None','No','NAD+ consultation'],
 ['Injection-only history','None','No','Injection therapy'],
 ['No tag match / unknown','None','No — hand off','None; collect preference'],
],[2500,2400,2000,2400]));
k.push(gap());
k.push(p('The price column is why this branch matters more now than it did before. The agent is allowed to say “$99” — but saying it to a contact entitled to the free B-12 variant is promising the wrong thing to the one person who should have heard better news. The workflow passes the permission; the agent never infers it. When no tag matches, the answer is silence and a handoff, not a guess.'));
k.push(p('“Intro Offer” is confirmed as the live voucher calendar. “Intro Offer v1” is the orphan — retire it, or routing drifts back to it the next time someone edits calendars by name.'));

k.push(h2('3b. Hard stop — bookings at 4:00 PM or later'));
k.push(p('The agent may offer a 4:00 PM or later slot but must never confirm one. After the AI step: if the requested time is 16:00 or later, write an internal comment on the conversation, notify staff, and send only “Let me get that confirmed for you — someone will text you right back.”'));
k.push(p('This rule reads differently now that closing is 5:00, not 6:00. A drip runs about an hour, so 4:00 PM is the last start that finishes at close, and anything later cannot finish before the doors shut. The rule is effectively “the last slot of the day always needs a human” — a sane place to put one. Worth deciding whether the agent should offer anything after 4:00 PM at all; right now it may offer and simply cannot confirm.'));

k.push(h2('3c. Hard stop — five new bookings per day'));
k.push(p('Requires counting, so it cannot be a prompt rule. Before the AI step, count today’s bookings on the intro calendar. At five or more, set a flag the agent sees, and have it collect a preferred time and hand off instead of offering slots.'));

k.push(h2('3d. Handoff triggers — disable AI, notify staff'));
k.push(p('Match on inbound message content. Any hit disables the agent on that conversation, sends the one-line acknowledgment, and notifies staff. These are hard stops, not “consider escalating.”'));
k.push(p('Who sends the acknowledgment. The workflow owns it — deterministic matching beats a model deciding. But the prompt also tells the agent to send that line, on purpose: the agent catches the semantic cases keyword matching misses (“I’ve been feeling off since Tuesday” trips no keyword). So both paths can fire, and the build needs a guard — once the acknowledgment has gone out on a conversation, suppress the second one. Without it, a client reporting a reaction gets the same line twice, which reads like a broken bot at the worst possible moment.'));
['Any physical symptom, reaction, side effect, bruising, soreness, swelling, pain, or mention of an injection site',
 'Any medical condition, medication, pregnancy, breastfeeding, recent procedure or ER visit',
 'Any dosing question, weight number, or request to change a dose',
 'Any inbound photo — in this inbox, photos have meant reaction images',
 'Billing, refunds, credits, declined cards, or any request to charge a card',
 'Membership cancel, pause, suspend or downgrade',
 'Complaints, or anything referring to a past visit going wrong',
 'Legal, media or regulatory contact'].forEach((t,i)=>k.push(nl(t,i+1)));

k.push(h2('3e. “Is someone on call?” — internal comment to the location email'));
k.push(p('Distinct from a handoff: the client gets a normal acknowledgment, and staff get pinged where they will see it. On any message asking whether a named person is working, who is on call, or for a specific staff member’s schedule:'));
['The agent replies with the standard “let me get a team member connected with you” line. It never confirms or denies who is in.',
 'The workflow writes an internal comment on the conversation, @-mentioning pinecrest@primeivhydration.com so it notifies.',
 'The thread stays open — this is a nudge, not a shutdown, unless another trigger in 3d also fires.'].forEach((t,i)=>k.push(nl(t,i+1)));
k.push(p('For the @-mention to fire, pinecrest@primeivhydration.com has to exist as a user on the Pinecrest sub-account. Worth confirming in the browser session before this is wired.'));

k.push(h2('3f. Silent flag — no reply at all'));
k.push(p('Vendor pitches, recruiters, lead-gen agencies, phishing. Flag for staff, send nothing. A bot replying to these wastes credits and occasionally starts a conversation nobody wants.'));

k.push(h2('3g. Three-message rule'));
k.push(p('If a client sends three messages without the thread resolving, hand to a human. Repeated bot replies to a confused client is the worst failure mode here.'));

k.push(h2('3h. Where notifications go — and what they may contain'));
k.push(p('Every rule above ends in “notify staff”. These are the addresses, and a limit on what the notification may carry.'));
k.push(table(['Trigger','Notify'],[['Handoffs 3d.1—3d.7 (symptoms, meds, dosing, photos, billing, membership, complaints)','pinecrest@primeivhydration.com'],['Handoff 3d.8 — legal, media, regulatory','pinecrest@primeivhydration.com and jkulkusky@primeivhydration.com'],['3e — on-call and staff-schedule asks','pinecrest@primeivhydration.com'],['3f — vendor, recruiter, phishing','pinecrest@primeivhydration.com'],['3g — three-message rule','pinecrest@primeivhydration.com']],[5200,4100]));
k.push(gap());
k.push(p('The notification must not carry message content. Your own data boundary puts inbound and outbound SMS, and AI conversation transcripts, in “GHL only”. An email that quotes what a client said moves protected health information out of GHL and into a Google mailbox that may or may not be covered. Notifications say there is a thread waiting and here is the link — never what it says. Prefer GHL’s in-app notification over email wherever the setting allows it.',{bold:true}));
k.push(p('mn@mothernatureagency.com is deliberately absent from that table. It is an agency domain, outside the BAA boundary, and conversation notifications should not land there even though the same person co-owns the location. Pinecrest-side visibility belongs on a Prime IV account. This is the spec’s own rule applied to ourselves: if a workflow touches the conversation, it stays inside.'));
k.push(h1('4. Phase 0 test checklist'));
k.push(p('Replay real threads and compare the agent’s draft to what staff actually sent. The 179 reviewed conversations are the test set. Before Phase 1, confirm the agent stops on all three of these:'));KB.checks.stops.forEach(t=>k.push(bul(t)));
k.push(p('Also confirm across the replay:'));KB.checks.replay.forEach(t=>k.push(bul(t)));
k.push(p('Track missed escalations as defects, not as a metric to optimize. An unnecessary handoff costs a minute of staff time; a missed one is the reason this build has a HIPAA prerequisite list.'));

k.push(h1('Conflicts the website turned up — decide these'));
k.push(p('The homepage disagrees with things already written down. Each needs a decision, and two of them are customer-facing errors today.'));
k.push(table(KB.conflicts[0],KB.conflicts.slice(1),[1700,2500,2400,2700]));
k.push(gap());
k.push(p('The site breaks the language rule too: "Boost metabolism and optimize energy" on the Skinny Mermaid special, "Energy & Vitality Boost", "supercharge your immune system", "Immunity Boost". Same issue as the campaign copy and the printed menu — worth a pass over the site separately from this build. The site’s own footer carries the FDA line: "not intended to diagnose, treat, cure, or prevent any disease." That disclaimer is precisely why the bot’s language rule exists.'));
k.push(h1('5. What is still needed'));
k.push(table(['Needed','From','Blocks'],[
 ['A review pass on the rewritten menu descriptions','Spa team','Phase 0 sign-off'],
 ['Voucher expiration terms','You','Voucher routing'],
 ['Membership terms in plain language','Spa team','Membership routing'],
 ['What “Mobile Services Consult” includes','Spa team','Service questions'],
],[4400,1900,3000]));
k.push(gap());
k.push(p('Everything above is drafted so the FAQ pairs drop in without rewriting the prompt. Send the FAQ document and the knowledge base finishes in one pass.'));

const doc=new Document({
  numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,
    style:{paragraph:{indent:{left:420,hanging:220}}}}]}]},
  sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:k}]});

Packer.toBuffer(doc).then(b=>{fs.writeFileSync(OUT,b);console.log('wrote',OUT,'('+b.length+' bytes,',KB.qa.length,'Q&A pairs)');});
