'use client';

/**
 * MNA Dashboard — Tabbed layout for the agency's own operations.
 *
 * Tabs:
 *   1. Overview    → existing AgencyOverview (all-clients grid)
 *   2. Our Socials → MNA content calendar + stats for agency accounts
 *   3. AI Intel    → AI intelligence panel with recommendations
 *   4. Outreach    → Prospecting templates + pipeline
 *   5. Onboarding  → New-client onboarding flow
 */

import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { clients } from '@/lib/clients';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import AgencyOverview from './AgencyOverview';
import MonthlyContentCalendar from './MonthlyContentCalendar';
import AIInsightsPanel from './AIInsightsPanel';
import UserBanner from './UserBanner';

// ─── TYPES ──────────────────────────────────────────────────────────

type OutreachTemplate = {
  id: string;
  name: string;
  industry: string;
  subject: string;
  body: string;
  type: 'email' | 'dm' | 'follow_up';
};

type Prospect = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  status: 'new' | 'contacted' | 'interested' | 'proposal_sent' | 'confirmed' | 'onboarding';
  notes: string;
  last_contacted: string | null;
  created_at: string;
};

type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  done: boolean;
};

// ─── TAB CONFIG ─────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'socials', label: 'Our Socials', icon: 'share' },
  { key: 'ai', label: 'AI Intelligence', icon: 'psychology' },
  { key: 'outreach', label: 'Outreach', icon: 'campaign' },
  { key: 'onboarding', label: 'Onboarding', icon: 'rocket_launch' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ─── OUTREACH TEMPLATES ─────────────────────────────────────────────

const DEFAULT_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Cold Intro — Local Business',
    industry: 'General',
    type: 'email',
    subject: 'Quick question about {{business_name}}\'s marketing',
    body: `Hi {{contact_name}},

I'm Alexus with Mother Nature Agency — we specialize in digital marketing for local businesses here in the Panhandle.

I came across {{business_name}} and loved what you're doing. I noticed a few opportunities where we could help amplify your reach and drive more leads through targeted social media and paid ads.

Would you be open to a quick 15-minute call this week? No pitch — just want to share a couple ideas specific to your business.

Best,
Alexus Williams
Mother Nature Agency
mn@mothernatureagency.com`,
  },
  {
    id: 'tpl-2',
    name: 'Cold Intro — Health & Wellness',
    industry: 'Health & Wellness',
    type: 'email',
    subject: 'Helping {{business_name}} attract more patients online',
    body: `Hi {{contact_name}},

I'm reaching out because we work with health and wellness businesses in the area — including IV therapy, med spas, and chiropractic offices.

One of our clients saw a 65% increase in booked appointments within 90 days of partnering with us. I'd love to explore whether we can do something similar for {{business_name}}.

Would you have 15 minutes this week for a quick chat?

Alexus Williams
Mother Nature Agency
mn@mothernatureagency.com`,
  },
  {
    id: 'tpl-3',
    name: 'Cold Intro — Real Estate / STR',
    industry: 'Real Estate',
    type: 'email',
    subject: 'Maximizing bookings for {{business_name}}',
    body: `Hi {{contact_name}},

I noticed your listing on VRBO/Airbnb and wanted to reach out. We help short-term rental owners and property managers maximize bookings through direct marketing — social media, SEO, and targeted ads that reduce your reliance on platform commissions.

We recently helped a Destin-area rental increase direct bookings by 40%. I'd love to share how.

Free to chat for 15 minutes this week?

Alexus Williams
Mother Nature Agency
mn@mothernatureagency.com`,
  },
  {
    id: 'tpl-4',
    name: 'Follow-Up — No Response',
    industry: 'General',
    type: 'follow_up',
    subject: 'Re: Quick question about {{business_name}}\'s marketing',
    body: `Hi {{contact_name}},

Just following up on my note from last week. I know things get busy!

I put together a quick snapshot of a few things that could help {{business_name}} stand out online. Happy to share it over a short call — no strings attached.

Would any day this week work?

Best,
Alexus Williams
Mother Nature Agency`,
  },
  {
    id: 'tpl-5',
    name: 'Instagram DM — Intro',
    industry: 'General',
    type: 'dm',
    subject: '',
    body: `Hey {{contact_name}}! 👋 Love what you're doing with {{business_name}}. We're a local marketing agency and I had a couple ideas that could help you reach more people. Mind if I send over a quick overview? No pressure at all!`,
  },
];

// ─── MNA SOCIAL STATS (hardcoded for now, will be API-driven) ───────

const MNA_SOCIAL_STATS = {
  instagram: { handle: '@mothernatureagency', followers: 1240, growth: 8.2, engagement: 4.7, posts30d: 18 },
  facebook: { handle: 'Mother Nature Agency', followers: 860, growth: 3.1, engagement: 2.8, posts30d: 12 },
  tiktok: { handle: '@mothernatureagency', followers: 480, growth: 22.5, engagement: 7.2, posts30d: 8 },
  linkedin: { handle: 'Mother Nature Agency', followers: 320, growth: 5.4, engagement: 3.1, posts30d: 6 },
};

const PLATFORM_ICONS: Record<string, { emoji: string; color: string }> = {
  instagram: { emoji: '📸', color: '#E1306C' },
  facebook: { emoji: '📘', color: '#1877F2' },
  tiktok: { emoji: '🎵', color: '#000000' },
  linkedin: { emoji: '💼', color: '#0A66C2' },
};

// ─── ONBOARDING STEPS ───────────────────────────────────────────────

const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'intake', label: 'Client Intake Form', description: 'Collect business info, goals, brand guidelines, and access credentials', done: false },
  { key: 'branding', label: 'Branding Setup', description: 'Define colors, fonts, logo usage, and visual identity for the portal', done: false },
  { key: 'accounts', label: 'Social Account Access', description: 'Get admin/editor access to all social media accounts', done: false },
  { key: 'ads', label: 'Ad Account Setup', description: 'Connect Meta Business Suite, Google Ads, and pixel tracking', done: false },
  { key: 'content', label: 'Content Strategy', description: 'Build first month content calendar and get client approval', done: false },
  { key: 'portal', label: 'Portal Access', description: 'Create client login, configure their portal dashboard, and send welcome email', done: false },
  { key: 'launch', label: 'Go Live', description: 'Publish first batch of content and activate ad campaigns', done: false },
];

// ─── MAIN COMPONENT ─────────────────────────────────────────────────

export default function MNADashboard() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Prospects stored in client_kv
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [newProspect, setNewProspect] = useState({ business_name: '', contact_name: '', email: '', phone: '', industry: 'General', notes: '' });

  // Onboarding: track per-prospect steps
  const [onboardingClient, setOnboardingClient] = useState<string | null>(null);
  const [onboardingSteps, setOnboardingSteps] = useState<Record<string, OnboardingStep[]>>({});

  // Template preview
  const [selectedTemplate, setSelectedTemplate] = useState<OutreachTemplate | null>(null);
  const [templatePreview, setTemplatePreview] = useState('');

  // Load prospects
  useEffect(() => {
    setLoadingProspects(true);
    fetch('/api/client-kv?clientId=mna&key=prospects')
      .then((r) => r.json())
      .then((d) => {
        if (d.value && Array.isArray(d.value)) setProspects(d.value);
      })
      .catch(() => {})
      .finally(() => setLoadingProspects(false));
  }, []);

  // Load onboarding progress
  useEffect(() => {
    fetch('/api/client-kv?clientId=mna&key=onboarding_progress')
      .then((r) => r.json())
      .then((d) => { if (d.value) setOnboardingSteps(d.value); })
      .catch(() => {});
  }, []);

  async function saveProspects(updated: Prospect[]) {
    setProspects(updated);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', key: 'prospects', value: updated }),
    });
  }

  async function saveOnboardingSteps(updated: Record<string, OnboardingStep[]>) {
    setOnboardingSteps(updated);
    await fetch('/api/client-kv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'mna', key: 'onboarding_progress', value: updated }),
    });
  }

  function addProspect() {
    const p: Prospect = {
      id: `p-${Date.now()}`,
      ...newProspect,
      status: 'new',
      last_contacted: null,
      created_at: new Date().toISOString(),
    };
    saveProspects([...prospects, p]);
    setNewProspect({ business_name: '', contact_name: '', email: '', phone: '', industry: 'General', notes: '' });
    setShowAddProspect(false);
  }

  function updateProspectStatus(id: string, status: Prospect['status']) {
    const updated = prospects.map((p) => (p.id === id ? { ...p, status } : p));
    saveProspects(updated);
    // If moving to onboarding, initialize steps
    if (status === 'onboarding') {
      const steps = { ...onboardingSteps, [id]: DEFAULT_ONBOARDING_STEPS.map((s) => ({ ...s })) };
      saveOnboardingSteps(steps);
    }
  }

  function toggleOnboardingStep(prospectId: string, stepKey: string) {
    const steps = onboardingSteps[prospectId] || DEFAULT_ONBOARDING_STEPS.map((s) => ({ ...s }));
    const updated = steps.map((s) => (s.key === stepKey ? { ...s, done: !s.done } : s));
    saveOnboardingSteps({ ...onboardingSteps, [prospectId]: updated });
  }

  function fillTemplate(tpl: OutreachTemplate, prospect: Prospect) {
    let filled = tpl.body
      .replace(/\{\{business_name\}\}/g, prospect.business_name || '___')
      .replace(/\{\{contact_name\}\}/g, prospect.contact_name || '___');
    setTemplatePreview(filled);
    setSelectedTemplate(tpl);
  }

  const STATUS_PIPELINE: { key: Prospect['status']; label: string; color: string }[] = [
    { key: 'new', label: 'New', color: '#6b7280' },
    { key: 'contacted', label: 'Contacted', color: '#3b82f6' },
    { key: 'interested', label: 'Interested', color: '#f59e0b' },
    { key: 'proposal_sent', label: 'Proposal Sent', color: '#8b5cf6' },
    { key: 'confirmed', label: 'Confirmed', color: '#10b981' },
    { key: 'onboarding', label: 'Onboarding', color: '#0ea5e9' },
  ];

  const confirmedProspects = prospects.filter((p) => p.status === 'confirmed' || p.status === 'onboarding');

  return (
    <div className="space-y-6 max-w-[1400px]">
      {activeTab !== 'overview' && <UserBanner />}

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
              activeTab === tab.key
                ? 'text-white shadow-lg'
                : 'text-white/50 hover:text-white/80'
            }`}
            style={activeTab === tab.key ? { background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` } : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Overview — existing AgencyOverview with all clients      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && <AgencyOverview />}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Our Socials — MNA content calendar + social stats        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'socials' && (
        <div className="space-y-6">
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight">MNA Socials</h1>
            </div>
            <p className="text-[12px] text-white/60 pl-3.5">Content calendar and stats for Mother Nature Agency accounts</p>
          </div>

          {/* Social Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(MNA_SOCIAL_STATS).map(([platform, stats]) => {
              const icon = PLATFORM_ICONS[platform];
              return (
                <div key={platform} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[18px]">{icon.emoji}</span>
                    <div>
                      <div className="text-[13px] font-bold text-white capitalize">{platform}</div>
                      <div className="text-[10px] text-white/50">{stats.handle}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Followers</div>
                      <div className="text-[20px] font-black text-white">{stats.followers.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Growth</div>
                      <div className="text-[20px] font-black text-emerald-400">+{stats.growth}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Engagement</div>
                      <div className="text-[16px] font-bold text-white">{stats.engagement}%</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Posts (30d)</div>
                      <div className="text-[16px] font-bold text-white">{stats.posts30d}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MNA Content Calendar */}
          <MonthlyContentCalendar
            clientName="Mother Nature Agency"
            gradientFrom={gradientFrom}
            gradientTo={gradientTo}
          />

          {/* Quick Stats Summary */}
          <div className="glass-card p-6">
            <div className="text-[15px] font-bold text-white mb-4">Content Performance Summary</div>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Total Posts (30d)', value: Object.values(MNA_SOCIAL_STATS).reduce((s, p) => s + p.posts30d, 0), color: gradientFrom },
                { label: 'Total Followers', value: Object.values(MNA_SOCIAL_STATS).reduce((s, p) => s + p.followers, 0), color: '#8b5cf6' },
                { label: 'Avg Engagement', value: `${(Object.values(MNA_SOCIAL_STATS).reduce((s, p) => s + p.engagement, 0) / 4).toFixed(1)}%`, color: '#10b981' },
                { label: 'Best Platform', value: 'TikTok', color: '#000' },
                { label: 'Fastest Growing', value: `TikTok (+${MNA_SOCIAL_STATS.tiktok.growth}%)`, color: '#f59e0b' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">{s.label}</div>
                  <div className="text-[18px] font-black text-white">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: AI Intelligence                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight">AI Intelligence</h1>
            </div>
            <p className="text-[12px] text-white/60 pl-3.5">Smart recommendations and insights across all clients</p>
          </div>

          <AIInsightsPanel />

          {/* Quick Actions */}
          <div className="glass-card p-6">
            <div className="text-[15px] font-bold text-white mb-4">Quick AI Actions</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: 'edit_note', label: 'Generate Captions', desc: 'AI-write captions for upcoming posts', href: '/content' },
                { icon: 'trending_up', label: 'Trend Analysis', desc: 'See what\'s trending in your industries', href: '/reports' },
                { icon: 'smart_toy', label: 'Chat with Agents', desc: 'Ask AI agents for strategy advice', href: '/agents/ai' },
                { icon: 'mail', label: 'Draft Emails', desc: 'Generate weekly client update emails', href: '/email-preview' },
                { icon: 'lightbulb', label: 'Content Ideas', desc: 'Get AI-suggested content for any client', href: '/planner' },
                { icon: 'analytics', label: 'Performance Report', desc: 'Auto-generate monthly performance reports', href: '/reports' },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gradientFrom}30` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: gradientFrom }}>{action.icon}</span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-white group-hover:underline">{action.label}</div>
                    <div className="text-[11px] text-white/50">{action.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Outreach — Templates + Prospect Pipeline                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'outreach' && (
        <div className="space-y-6">
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight">Client Outreach</h1>
            </div>
            <p className="text-[12px] text-white/60 pl-3.5">Prospect pipeline and outreach templates for new client acquisition</p>
          </div>

          {/* Pipeline Overview */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[15px] font-bold text-white">Prospect Pipeline</div>
              <button
                onClick={() => setShowAddProspect(true)}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl text-white"
                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
              >
                + Add Prospect
              </button>
            </div>

            {/* Pipeline stages */}
            <div className="grid grid-cols-6 gap-2 mb-6">
              {STATUS_PIPELINE.map((stage) => {
                const count = prospects.filter((p) => p.status === stage.key).length;
                return (
                  <div key={stage.key} className="text-center p-3 rounded-xl" style={{ background: `${stage.color}15`, border: `1px solid ${stage.color}30` }}>
                    <div className="text-[24px] font-black text-white">{count}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Add prospect form */}
            {showAddProspect && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-4 space-y-3">
                <div className="text-[13px] font-bold text-white mb-2">New Prospect</div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Business Name"
                    value={newProspect.business_name}
                    onChange={(e) => setNewProspect({ ...newProspect, business_name: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                  <input
                    placeholder="Contact Name"
                    value={newProspect.contact_name}
                    onChange={(e) => setNewProspect({ ...newProspect, contact_name: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                  <input
                    placeholder="Email"
                    value={newProspect.email}
                    onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                  <input
                    placeholder="Phone"
                    value={newProspect.phone}
                    onChange={(e) => setNewProspect({ ...newProspect, phone: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                  <select
                    value={newProspect.industry}
                    onChange={(e) => setNewProspect({ ...newProspect, industry: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Health & Wellness">Health & Wellness</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Restaurant / Food">Restaurant / Food</option>
                    <option value="Retail">Retail</option>
                    <option value="Professional Services">Professional Services</option>
                  </select>
                  <input
                    placeholder="Notes"
                    value={newProspect.notes}
                    onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                    className="text-[12px] px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/30"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addProspect}
                    disabled={!newProspect.business_name}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                  >
                    Add Prospect
                  </button>
                  <button
                    onClick={() => setShowAddProspect(false)}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-white/10 text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Prospect list */}
            {prospects.length === 0 && !loadingProspects && (
              <div className="text-center py-8 text-white/40">
                <div className="text-[14px] font-semibold">No prospects yet</div>
                <div className="text-[12px] mt-1">Add your first prospect to start the pipeline</div>
              </div>
            )}
            {loadingProspects && <div className="text-center py-8 text-white/40">Loading...</div>}

            <div className="space-y-2">
              {prospects.map((p) => {
                const stageInfo = STATUS_PIPELINE.find((s) => s.key === p.status)!;
                return (
                  <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white">{p.business_name}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${stageInfo.color}20`, color: stageInfo.color }}>
                          {stageInfo.label}
                        </span>
                        <span className="text-[10px] text-white/30">{p.industry}</span>
                      </div>
                      <div className="text-[11px] text-white/50 mt-0.5">
                        {p.contact_name} · {p.email || 'No email'} {p.phone && `· ${p.phone}`}
                      </div>
                      {p.notes && <div className="text-[10px] text-white/40 mt-1">{p.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={p.status}
                        onChange={(e) => updateProspectStatus(p.id, e.target.value as Prospect['status'])}
                        className="text-[11px] px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white outline-none"
                      >
                        {STATUS_PIPELINE.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outreach Templates */}
          <div className="glass-card p-6">
            <div className="text-[15px] font-bold text-white mb-4">Outreach Templates</div>
            <div className="grid grid-cols-2 gap-3">
              {DEFAULT_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => { setSelectedTemplate(tpl); setTemplatePreview(tpl.body); }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: gradientFrom }}>
                      {tpl.type === 'email' ? 'mail' : tpl.type === 'dm' ? 'chat' : 'reply'}
                    </span>
                    <span className="text-[13px] font-bold text-white">{tpl.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60 uppercase">{tpl.type}</span>
                    <span className="text-[10px] text-white/40">{tpl.industry}</span>
                  </div>
                  {tpl.subject && <div className="text-[11px] text-white/50 mt-2 truncate">Subject: {tpl.subject}</div>}
                </div>
              ))}
            </div>

            {/* Template preview / fill */}
            {selectedTemplate && (
              <div className="mt-4 p-5 rounded-xl border border-white/15 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-bold text-white">{selectedTemplate.name}</div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-[11px] text-white/40 hover:text-white/70"
                  >
                    Close
                  </button>
                </div>
                {selectedTemplate.subject && (
                  <div className="text-[12px] text-white/60 mb-2">Subject: <span className="text-white/80">{selectedTemplate.subject}</span></div>
                )}

                {/* Quick fill from prospect */}
                {prospects.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-white/40">Fill for:</span>
                    {prospects.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => fillTemplate(selectedTemplate, p)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20"
                      >
                        {p.business_name}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={templatePreview}
                  onChange={(e) => setTemplatePreview(e.target.value)}
                  rows={10}
                  className="w-full text-[12px] px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white/90 outline-none focus:border-white/30 leading-relaxed font-mono"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(templatePreview); }}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg text-white"
                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Onboarding — New client onboarding pipeline              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
              <h1 className="text-[22px] font-extrabold text-white tracking-tight">Client Onboarding</h1>
            </div>
            <p className="text-[12px] text-white/60 pl-3.5">
              Guided onboarding for confirmed prospects · {confirmedProspects.length} client{confirmedProspects.length !== 1 ? 's' : ''} in pipeline
            </p>
          </div>

          {confirmedProspects.length === 0 && (
            <div className="glass-card p-8 text-center">
              <span className="material-symbols-outlined text-white/20 mb-3" style={{ fontSize: 48 }}>rocket_launch</span>
              <div className="text-[14px] font-semibold text-white/60">No clients in onboarding</div>
              <div className="text-[12px] text-white/40 mt-1">
                Mark a prospect as &quot;Confirmed&quot; or &quot;Onboarding&quot; in the Outreach tab to start their onboarding here.
              </div>
              <button
                onClick={() => setActiveTab('outreach')}
                className="mt-4 text-[12px] font-semibold px-4 py-2 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
              >
                Go to Outreach
              </button>
            </div>
          )}

          {confirmedProspects.map((prospect) => {
            const steps = onboardingSteps[prospect.id] || DEFAULT_ONBOARDING_STEPS;
            const completedCount = steps.filter((s) => s.done).length;
            const progressPct = Math.round((completedCount / steps.length) * 100);

            return (
              <div key={prospect.id} className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-white">{prospect.business_name}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {prospect.status === 'onboarding' ? 'Onboarding' : 'Confirmed'}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      {prospect.contact_name} · {prospect.email} · {prospect.industry}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-black text-white">{progressPct}%</div>
                    <div className="text-[10px] text-white/40">{completedCount}/{steps.length} steps</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                  />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div
                      key={step.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                        step.done
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => toggleOnboardingStep(prospect.id, step.key)}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                          step.done ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'
                        }`}
                      >
                        {step.done && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                      </div>
                      <div>
                        <div className={`text-[13px] font-semibold ${step.done ? 'text-white/50 line-through' : 'text-white'}`}>
                          {step.label}
                        </div>
                        <div className="text-[11px] text-white/40">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {progressPct === 100 && (
                  <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                    <div className="text-[14px] font-bold text-emerald-400">Onboarding Complete!</div>
                    <div className="text-[11px] text-emerald-300/70 mt-1">This client is ready to go live. Add them to your client list to start managing their account.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
