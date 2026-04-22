'use client';

/**
 * Creator Portal — for influencer accounts (e.g. @alexusaura).
 *
 * Tabbed dashboard with:
 *   - Overview     (KPIs + active deals + upcoming live)
 *   - Trends       (audio + topic feed; user can save favorites)
 *   - Calendar     (toggle: Content vs Personal)
 *   - Deals        (brand pipeline: lead → paid)
 *   - Shop         (TikTok Shop product tracking)
 *   - Live         (TikTok Live session planning + post-mortems)
 *   - Connections  (linked social accounts)
 *   - Tasks        (personal task list)
 *   - Helpers      (5 AI agents)
 *
 * Storage: per-creator client_kv keyed by email + key. Schedule events
 * use the existing schedule_events table.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  CREATORS,
  CREATOR_THEMES,
  CREATOR_AGENTS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  getCreatorByEmail,
  uid,
  type Creator,
  type Connection,
  type SocialPlatform,
  type BrandDeal,
  type DealStage,
  type ShopProduct,
  type LiveSession,
} from '@/lib/creators';
import { isMNAStaff } from '@/lib/staff';
import JarvisFab from '@/components/ai/JarvisFab';
import TikTokAnalytics from '@/components/dashboard/TikTokAnalytics';
import TikTokContentPlan from '@/components/dashboard/TikTokContentPlan';

type Tab = 'overview' | 'trends' | 'calendar' | 'deals' | 'shop' | 'live' | 'connections' | 'tasks';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',    label: 'Overview',    icon: 'dashboard' },
  { id: 'trends',      label: 'Trends',      icon: 'whatshot' },
  { id: 'calendar',    label: 'Calendar',    icon: 'calendar_month' },
  { id: 'deals',       label: 'Brand Deals', icon: 'handshake' },
  { id: 'shop',        label: 'TikTok Shop', icon: 'shopping_bag' },
  { id: 'live',        label: 'TikTok Live', icon: 'videocam' },
  { id: 'connections', label: 'Connections', icon: 'link' },
  { id: 'tasks',       label: 'My Tasks',    icon: 'task_alt' },
];

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function CreatorPortal() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  // Stored data (from client_kv)
  const [connections, setConnections] = useState<Connection[]>([]);
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Calendar view-toggle: content vs personal
  const [calMode, setCalMode] = useState<'content' | 'personal'>('content');

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const c = getCreatorByEmail(userEmail);
      // Staff (mn@) preview mode → use the first creator
      if (!c && isMNAStaff(userEmail)) {
        setPreviewMode(true);
        setCreator(CREATORS[0] || null);
      } else {
        setCreator(c);
      }
      const fetchEmail = c?.email || (isMNAStaff(userEmail) ? CREATORS[0]?.email : '') || '';
      if (!fetchEmail) return;

      await Promise.all([
        loadKV(fetchEmail, 'connections').then((v) => setConnections(Array.isArray(v) ? v : [])),
        loadKV(fetchEmail, 'deals').then((v) => setDeals(Array.isArray(v) ? v : [])),
        loadKV(fetchEmail, 'shop').then((v) => setProducts(Array.isArray(v) ? v : [])),
        loadKV(fetchEmail, 'lives').then((v) => setLives(Array.isArray(v) ? v : [])),
        fetch(`/api/client-requests?assignedTo=${encodeURIComponent(fetchEmail)}`)
          .then((r) => r.json()).then((d) => setTasks(d.requests || d.items || [])).catch(() => {}),
        fetch(`/api/schedule?email=${encodeURIComponent(fetchEmail)}&from=${todayStr()}&to=${plusDaysStr(30)}`)
          .then((r) => r.json()).then((d) => setEvents(d.events || [])).catch(() => {}),
      ]);
    })();
  }, []);

  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">
        Loading your studio…
      </div>
    );
  }

  const theme = CREATOR_THEMES[creator.brandColor];

  return (
    <div className="min-h-screen text-white relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <JarvisFab />
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {previewMode && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
               style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 text-[12px] text-white/70">
              Staff Preview · {creator.handle} creator portal. MNA staff has full access since this is your account.
            </div>
            <a href="/" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">← Back</a>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">Creator Studio</div>
            <h1 className="text-[34px] font-extrabold mt-1 leading-none">{creator.handle}</h1>
            <div className="text-white/65 text-sm mt-1">
              {creator.displayName} · {creator.niche.join(' · ')}
            </div>
          </div>
          {!previewMode && (
            <button
              onClick={async () => { await createSupabaseClient().auth.signOut(); window.location.href = '/login'; }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Sign out
            </button>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-2 px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition ${
                tab === t.id ? 'text-white' : 'text-white/65 hover:text-white/95 hover:bg-white/10'
              }`}
              style={tab === t.id ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` } : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.chipBorder}` }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB BODIES ── */}
        {tab === 'overview' && (
          <OverviewTab theme={theme} creator={creator} connections={connections} deals={deals} products={products} lives={lives} tasks={tasks} />
        )}
        {tab === 'trends' && <TrendsTab theme={theme} creator={creator} />}
        {tab === 'calendar' && (
          <CalendarTab
            theme={theme} events={events}
            calMode={calMode} setCalMode={setCalMode}
            creatorEmail={creator.email}
            previewMode={previewMode}
            onAdded={(ev: any) => setEvents((prev) => [...prev, ev])}
          />
        )}
        {tab === 'deals' && (
          <DealsTab theme={theme} deals={deals} setDeals={setDeals} creatorEmail={creator.email} previewMode={previewMode} />
        )}
        {tab === 'shop' && (
          <ShopTab theme={theme} products={products} setProducts={setProducts} creatorEmail={creator.email} previewMode={previewMode} />
        )}
        {tab === 'live' && (
          <LiveTab theme={theme} lives={lives} setLives={setLives} creatorEmail={creator.email} previewMode={previewMode} />
        )}
        {tab === 'connections' && (
          <ConnectionsTab theme={theme} connections={connections} setConnections={setConnections} creatorEmail={creator.email} previewMode={previewMode} />
        )}
        {tab === 'tasks' && (
          <TasksTab theme={theme} tasks={tasks} setTasks={setTasks} creatorEmail={creator.email} />
        )}

        {/* ── AI HELPERS ── */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 mb-2">AI Helpers</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {CREATOR_AGENTS.map((a) => (
              <Link
                key={a.id}
                href={`/creator/agent/${a.id}`}
                className="rounded-2xl p-4 transition hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.chipBorder}`, borderLeft: `3px solid ${theme.gradientFrom}` }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2"
                     style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>{a.icon}</span>
                </div>
                <div className="text-[14px] font-bold">{a.name}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: theme.accent }}>{a.role}</div>
                <div className="text-[12px] text-white/65 mt-1.5 leading-snug">{a.tagline}</div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function plusDaysStr(n: number) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

async function loadKV(email: string, key: string): Promise<any> {
  try {
    const r = await fetch(`/api/client-kv?clientId=${encodeURIComponent(email)}&key=${key}`);
    const d = await r.json();
    return d.value;
  } catch { return null; }
}

async function saveKV(email: string, key: string, value: any) {
  await fetch('/api/client-kv', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: email, key, value }),
  }).catch(() => {});
}

type Theme = (typeof CREATOR_THEMES)[keyof typeof CREATOR_THEMES];

// ═══ TABS ═══════════════════════════════════════════════════════════

function OverviewTab({ theme, creator, connections, deals, products, lives, tasks }: any) {
  const totalFollowers = connections.reduce((n: number, c: Connection) => n + (c.followers || 0), 0);
  const activeDeals = deals.filter((d: BrandDeal) => ['pitched', 'negotiating', 'contracted', 'live'].includes(d.stage));
  const dealRevenue = deals.filter((d: BrandDeal) => d.stage === 'paid').reduce((n: number, d: BrandDeal) => n + d.amount, 0);
  const shopRevenue = products.reduce((n: number, p: ShopProduct) => n + (p.earnings || 0), 0);
  const upcomingLive = lives.find((l: LiveSession) => l.status === 'scheduled');
  const openTasks = tasks.filter((t: any) => t.status !== 'completed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Followers" value={totalFollowers ? totalFollowers.toLocaleString() : '—'} note={`${connections.length} platforms linked`} color={theme.gradientFrom} />
      <KPI label="Active Deals" value={String(activeDeals.length)} note={`${fmtUSD(activeDeals.reduce((n: number, d: BrandDeal) => n + d.amount, 0))} pipeline`} color="#a855f7" />
      <KPI label="Brand Revenue" value={fmtUSD(dealRevenue)} note="Paid deals" color="#10b981" />
      <KPI label="Shop Earnings" value={fmtUSD(shopRevenue)} note={`${products.filter((p: ShopProduct) => p.active).length} active products`} color="#f59e0b" />
      <div className="col-span-2 md:col-span-2 glass-card p-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-1">Next Live</div>
        {upcomingLive ? (
          <>
            <div className="text-[16px] font-bold">{upcomingLive.title}</div>
            <div className="text-[12px] text-white/65 mt-1">{new Date(upcomingLive.scheduledAt).toLocaleString()}</div>
            <div className="text-[11px] text-white/55 mt-1">{upcomingLive.topic}</div>
          </>
        ) : (
          <div className="text-[12px] text-white/55">No Live scheduled. Hop into the Live tab to plan one.</div>
        )}
      </div>
      <div className="col-span-2 md:col-span-2 glass-card p-4">
        <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-1">Open Tasks</div>
        <div className="text-[28px] font-extrabold leading-none">{openTasks}</div>
        <div className="text-[12px] text-white/55 mt-1">{tasks.length} total</div>
      </div>
    </div>
  );
}

function TrendsTab({ theme, creator }: { theme: Theme; creator: any }) {
  return (
    <div className="space-y-4">
      <TikTokAnalytics
        ownerKey={creator.email}
        kvClientId={creator.email}
        label={creator.handle}
        niche={creator.niche?.join?.(' / ') || 'lifestyle + creator'}
        gradientFrom={theme.gradientFrom}
        gradientTo={theme.gradientTo}
      />
      <TikTokContentPlan
        ownerKey={creator.email}
        kvClientId={creator.email}
        label={creator.handle}
        niche={creator.niche?.join?.(' / ') || 'lifestyle + creator'}
        gradientFrom={theme.gradientFrom}
        gradientTo={theme.gradientTo}
      />
      <div className="glass-card p-5">
        <div className="text-[14px] font-bold mb-2">Suggested Workflows</div>
        <ul className="space-y-2 text-[12px] text-white/75">
          <li>· <span className="font-bold">Daily:</span> open Trend Spotter, save 1-2 audios you'd actually use</li>
          <li>· <span className="font-bold">Weekly:</span> batch 5-7 videos using saved trending audios</li>
          <li>· <span className="font-bold">Monthly:</span> review which trends you skipped vs jumped on, look for blind spots</li>
        </ul>
      </div>
    </div>
  );
}

function CalendarTab({ theme, events, calMode, setCalMode, creatorEmail, previewMode, onAdded }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: todayStr(), start_time: '09:00', end_time: '10:00' });

  const filtered = events.filter((e: any) => calMode === 'content' ? (e.event_type === 'task' || e.event_type === 'deadline' || e.event_type === 'review' || /post|content|reel|tiktok|video/i.test(e.title || '')) : !(e.event_type === 'task' || e.event_type === 'deadline' || e.event_type === 'review'));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (previewMode) {
      onAdded({ id: uid(), title: form.title, event_date: form.date, start_time: form.start_time, end_time: form.end_time, event_type: calMode === 'content' ? 'task' : 'personal' });
      setForm({ ...form, title: '' });
      setShowForm(false);
      return;
    }
    const r = await fetch('/api/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creatorEmail,
        title: form.title.trim(),
        event_date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        event_type: calMode === 'content' ? 'task' : 'personal',
        priority: 'normal',
      }),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (d.event) onAdded(d.event);
    }
    setForm({ ...form, title: '' });
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: theme.chipBorder }}>
            {(['content', 'personal'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setCalMode(m)}
                className={`px-4 py-1.5 text-[12px] font-bold transition ${calMode === m ? 'text-white' : 'text-white/65 hover:text-white'}`}
                style={calMode === m ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
              >
                {m === 'content' ? 'Content Calendar' : 'Personal Calendar'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
          >
            {showForm ? 'Cancel' : '+ Add Event'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={add} className="rounded-xl p-3 mb-3 space-y-2"
                style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
            <input
              autoFocus type="text" placeholder={calMode === 'content' ? 'Content title (e.g. Reel about new listing)' : 'Event title (e.g. Dinner with Sara)'}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                     className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                     style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                     className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                     style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                     className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                     style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            </div>
            <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                    style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
              Save
            </button>
          </form>
        )}

        {filtered.length === 0 ? (
          <div className="text-[12px] text-white/55 text-center py-8">
            Nothing on the {calMode} calendar yet. Tap + Add Event.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, 12).map((e: any) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-[11px] text-white/65 w-24 shrink-0 font-semibold">{new Date(`${e.event_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                <div className="text-[11px] text-white/65 w-24 shrink-0">{e.start_time || 'all day'}</div>
                <div className="text-sm font-semibold flex-1 truncate">{e.title}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DealsTab({ theme, deals, setDeals, creatorEmail, previewMode }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<{ brand: string; contactName: string; contactEmail: string; amount: number; deliverables: string; dueDate: string; stage: DealStage; notes: string }>({
    brand: '', contactName: '', contactEmail: '', amount: 0, deliverables: '', dueDate: '', stage: 'lead', notes: '',
  });

  async function persist(next: BrandDeal[]) {
    setDeals(next);
    if (previewMode) return;
    await saveKV(creatorEmail, 'deals', next);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.brand.trim()) return;
    const item: BrandDeal = { id: uid(), createdAt: new Date().toISOString(), ...draft };
    persist([item, ...deals]);
    setDraft({ brand: '', contactName: '', contactEmail: '', amount: 0, deliverables: '', dueDate: '', stage: 'lead', notes: '' });
    setShowForm(false);
  }

  function cycle(d: BrandDeal) {
    const order: DealStage[] = ['lead', 'pitched', 'negotiating', 'contracted', 'live', 'paid'];
    const next = order[(order.indexOf(d.stage) + 1) % order.length];
    persist(deals.map((x: BrandDeal) => x.id === d.id ? { ...x, stage: next } : x));
  }

  function remove(id: string) { persist(deals.filter((x: BrandDeal) => x.id !== id)); }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[14px] font-bold">Brand Deal Pipeline</div>
          <div className="text-[11px] text-white/55">{deals.length} total · {fmtUSD(deals.reduce((n: number, d: BrandDeal) => n + d.amount, 0))} pipeline value</div>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
          {showForm ? 'Cancel' : '+ Add Deal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Brand name" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} autoFocus />
            <input type="text" placeholder="Contact name" value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="email" placeholder="Contact email" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            <div className="flex items-center px-2 rounded-lg border" style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}>
              <span className="text-white/55 text-[12px] mr-1">$</span>
              <input type="number" min="0" step="50" placeholder="Amount" value={draft.amount || ''} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
                     className="flex-1 py-2 bg-transparent text-white text-[12px] outline-none" />
            </div>
            <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          </div>
          <input type="text" placeholder="Deliverables (e.g. 1 Reel + 3 Stories)" value={draft.deliverables} onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            Add Deal
          </button>
        </form>
      )}

      {deals.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-8">No deals tracked yet.</div>
      ) : (
        <div className="space-y-2">
          {deals.map((d: BrandDeal) => (
            <div key={d.id} className="rounded-xl p-3 flex items-center gap-3"
                 style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${DEAL_STAGE_COLORS[d.stage]}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold">{d.brand}</div>
                  {d.contactName && <div className="text-[11px] text-white/55">· {d.contactName}</div>}
                </div>
                <div className="text-[11px] text-white/65 truncate">{d.deliverables || 'No deliverables noted'}</div>
                {d.dueDate && <div className="text-[10px] text-white/45 mt-0.5">Due {d.dueDate}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[16px] font-extrabold">{fmtUSD(d.amount)}</div>
                <button onClick={() => cycle(d)} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: `${DEAL_STAGE_COLORS[d.stage]}22`, color: DEAL_STAGE_COLORS[d.stage] }}>
                  {DEAL_STAGE_LABELS[d.stage]}
                </button>
              </div>
              <button onClick={() => remove(d.id)} className="text-white/30 hover:text-rose-400">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShopTab({ theme, products, setProducts, creatorEmail, previewMode }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<{ name: string; link: string; commissionPct: number; pricePoint: number; unitsSold: number; earnings: number; active: boolean }>({
    name: '', link: '', commissionPct: 10, pricePoint: 0, unitsSold: 0, earnings: 0, active: true,
  });

  async function persist(next: ShopProduct[]) {
    setProducts(next);
    if (previewMode) return;
    await saveKV(creatorEmail, 'shop', next);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    persist([{ id: uid(), createdAt: new Date().toISOString(), ...draft }, ...products]);
    setDraft({ name: '', link: '', commissionPct: 10, pricePoint: 0, unitsSold: 0, earnings: 0, active: true });
    setShowForm(false);
  }

  function update(id: string, patch: Partial<ShopProduct>) {
    persist(products.map((p: ShopProduct) => p.id === id ? { ...p, ...patch } : p));
  }

  const totalEarnings = products.reduce((n: number, p: ShopProduct) => n + (p.earnings || 0), 0);
  const totalUnits = products.reduce((n: number, p: ShopProduct) => n + (p.unitsSold || 0), 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[14px] font-bold">TikTok Shop</div>
          <div className="text-[11px] text-white/55">{products.length} products · {totalUnits} units sold · {fmtUSD(totalEarnings)} earned</div>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
          <input type="text" placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Affiliate link" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            <div className="flex items-center gap-2">
              <input type="number" min="0" placeholder="Price" value={draft.pricePoint || ''} onChange={(e) => setDraft({ ...draft, pricePoint: Number(e.target.value) || 0 })}
                     className="flex-1 px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                     style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
              <input type="number" min="0" max="100" placeholder="%" value={draft.commissionPct || ''} onChange={(e) => setDraft({ ...draft, commissionPct: Number(e.target.value) || 0 })}
                     className="w-20 px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                     style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            </div>
          </div>
          <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            Add Product
          </button>
        </form>
      )}

      {products.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-8">No products tracked yet.</div>
      ) : (
        <div className="space-y-2">
          {products.map((p: ShopProduct) => (
            <div key={p.id} className="rounded-xl p-3 flex items-center gap-3"
                 style={{ background: 'rgba(255,255,255,0.05)', opacity: p.active ? 1 : 0.55 }}>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold">{p.name}</div>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-[10px] truncate block" style={{ color: theme.accent }}>{p.link}</a>}
                <div className="text-[10px] text-white/55">{fmtUSD(p.pricePoint)} · {p.commissionPct}% commission</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/55">Units</label>
                <input type="number" min="0" value={p.unitsSold} onChange={(e) => update(p.id, { unitsSold: Number(e.target.value) || 0 })}
                       className="w-16 px-2 py-1 rounded-md border text-white text-[12px] focus:outline-none"
                       style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/55">Earned $</label>
                <input type="number" min="0" value={p.earnings} onChange={(e) => update(p.id, { earnings: Number(e.target.value) || 0 })}
                       className="w-20 px-2 py-1 rounded-md border text-white text-[12px] focus:outline-none"
                       style={{ background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.2)' }} />
              </div>
              <button onClick={() => update(p.id, { active: !p.active })}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{ background: p.active ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)', color: p.active ? '#34d399' : '#94a3b8' }}>
                {p.active ? 'Active' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveTab({ theme, lives, setLives, creatorEmail, previewMode }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', scheduledAt: '', durationMin: 30, topic: '', goals: '' });

  async function persist(next: LiveSession[]) {
    setLives(next);
    if (previewMode) return;
    await saveKV(creatorEmail, 'lives', next);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const item: LiveSession = {
      id: uid(),
      title: draft.title.trim(),
      scheduledAt: draft.scheduledAt || new Date().toISOString(),
      durationMin: draft.durationMin,
      topic: draft.topic,
      goals: draft.goals,
      status: 'scheduled',
    };
    persist([item, ...lives]);
    setDraft({ title: '', scheduledAt: '', durationMin: 30, topic: '', goals: '' });
    setShowForm(false);
  }

  function setStatus(id: string, status: LiveSession['status']) {
    persist(lives.map((l: LiveSession) => l.id === id ? { ...l, status } : l));
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[14px] font-bold">TikTok Live</div>
          <div className="text-[11px] text-white/55">{lives.filter((l: LiveSession) => l.status === 'scheduled').length} scheduled · {lives.filter((l: LiveSession) => l.status === 'done').length} completed</div>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
          {showForm ? 'Cancel' : '+ Plan a Live'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
          <input type="text" placeholder="Live title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <input type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none col-span-2"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            <input type="number" min="5" placeholder="Min" value={draft.durationMin || ''} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) || 30 })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          </div>
          <input type="text" placeholder="Topic / hook" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          <textarea placeholder="Goals (gifts target, follower goal, products to feature)" value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })}
                    rows={3} className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none resize-none"
                    style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            Schedule Live
          </button>
        </form>
      )}

      {lives.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-8">No Lives planned yet.</div>
      ) : (
        <div className="space-y-2">
          {lives.map((l: LiveSession) => (
            <div key={l.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold">{l.title}</div>
                  <div className="text-[11px] text-white/65">{new Date(l.scheduledAt).toLocaleString()} · {l.durationMin} min</div>
                  {l.topic && <div className="text-[12px] text-white/75 mt-1">{l.topic}</div>}
                  {l.goals && <div className="text-[11px] text-white/55 mt-1 italic">Goals: {l.goals}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value as LiveSession['status'])}
                          className="text-[10px] font-bold px-2 py-1 rounded-md border text-white outline-none"
                          style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.2)' }}>
                    <option value="scheduled" className="bg-slate-900">Scheduled</option>
                    <option value="live" className="bg-slate-900">Live Now</option>
                    <option value="done" className="bg-slate-900">Done</option>
                    <option value="cancelled" className="bg-slate-900">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionsTab({ theme, connections, setConnections, creatorEmail, previewMode }: any) {
  const [draft, setDraft] = useState<{ platform: SocialPlatform; handle: string; followers: number }>({ platform: 'tiktok', handle: '', followers: 0 });

  async function persist(next: Connection[]) {
    setConnections(next);
    if (previewMode) return;
    await saveKV(creatorEmail, 'connections', next);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.handle.trim()) return;
    const item: Connection = {
      platform: draft.platform,
      handle: draft.handle.trim(),
      followers: draft.followers,
      status: 'connected',
      connectedAt: new Date().toISOString(),
    };
    // replace if same platform exists
    const next = [...connections.filter((c: Connection) => c.platform !== draft.platform), item];
    persist(next);
    setDraft({ platform: 'tiktok', handle: '', followers: 0 });
  }

  function remove(p: SocialPlatform) { persist(connections.filter((c: Connection) => c.platform !== p)); }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="text-[14px] font-bold mb-3">Linked Accounts</div>
        <p className="text-[11px] text-white/60 mb-4">
          Manual entry for now — full OAuth needs platform-side API keys per channel. Track followers + handles here so the dashboard reflects your actual reach.
        </p>
        <form onSubmit={add} className="rounded-xl p-3 space-y-2 mb-4"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
          <div className="grid grid-cols-3 gap-2">
            <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as SocialPlatform })}
                    className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                    style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}>
              {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                <option key={p} value={p} className="bg-slate-900">{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            <input type="text" placeholder="@handle" value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
            <input type="number" min="0" placeholder="Followers" value={draft.followers || ''} onChange={(e) => setDraft({ ...draft, followers: Number(e.target.value) || 0 })}
                   className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                   style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          </div>
          <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            Save Connection
          </button>
        </form>

        {connections.length === 0 ? (
          <div className="text-[12px] text-white/55 text-center py-6">No accounts linked yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {connections.map((c: Connection) => (
              <div key={c.platform} className="rounded-xl p-3 flex items-center gap-3"
                   style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${PLATFORM_COLORS[c.platform]}` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold">{PLATFORM_LABELS[c.platform]}</div>
                  <div className="text-[11px] text-white/65 truncate">{c.handle}</div>
                  <div className="text-[10px] text-white/55">{(c.followers || 0).toLocaleString()} followers</div>
                </div>
                <button onClick={() => remove(c.platform)} className="text-white/30 hover:text-rose-400">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TasksTab({ theme, tasks, setTasks, creatorEmail }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '' });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const r = await fetch('/api/client-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', title: draft.title.trim(), description: draft.description, assignedTo: creatorEmail }),
    }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      const created = d.request || d.item;
      if (created) setTasks((prev: any) => [created, ...prev]);
    }
    setDraft({ title: '', description: '' });
    setShowForm(false);
  }

  async function toggle(t: any) {
    const next = t.status === 'completed' ? 'open' : 'completed';
    await fetch('/api/client-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status: next }),
    }).catch(() => {});
    setTasks((prev: any) => prev.map((x: any) => x.id === t.id ? { ...x, status: next } : x));
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[14px] font-bold">My Tasks</div>
          <div className="text-[11px] text-white/55">{tasks.filter((t: any) => t.status !== 'completed').length} to do</div>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}>
          <input type="text" placeholder="Task title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} autoFocus />
          <input type="text" placeholder="Notes (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                 className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                 style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }} />
          <button type="submit" className="text-[12px] font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            Save Task
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="text-[12px] text-white/55 text-center py-6">No tasks yet.</div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t: any) => {
            const done = t.status === 'completed';
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.05)', opacity: done ? 0.55 : 1 }}>
                <button onClick={() => toggle(t)} className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: done ? `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` : 'rgba(255,255,255,0.08)', border: `1px solid ${done ? theme.gradientTo : 'rgba(255,255,255,0.25)'}` }}>
                  {done && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-semibold ${done ? 'line-through text-white/55' : 'text-white'}`}>{t.title}</div>
                  {t.description && <div className="text-[11px] text-white/55 mt-0.5">{t.description}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KPI({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <div className="glass-card p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</div>
      <div className="text-[24px] font-black text-white leading-none mt-1.5">{value}</div>
      <div className="text-[10px] text-white/45 mt-1">{note}</div>
    </div>
  );
}
