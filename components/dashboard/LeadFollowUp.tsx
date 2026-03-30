'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const tasks = [
  { name: 'Sarah M. — Spring Lead Gen', detail: 'Consultation booked, no follow-up sent. High-intent signal.', urgency: 'overdue', label: '72h overdue', color: '#ef4444', bg: '#fef2f2', border: '#ef4444' },
  { name: 'Prime IV Niceville — Retargeting', detail: 'Opened pricing page 3x. Send case study + promo now.', urgency: 'overdue', label: '48h overdue', color: '#ef4444', bg: '#fef2f2', border: '#ef4444' },
  { name: '6 Email Re-engage Leads', detail: 'Re-engage sequence day 3 — 32% open rate on last send.', urgency: 'today', label: 'Due today', color: '#d97706', bg: '#fffbeb', border: '#f59e0b' },
  { name: 'LinkedIn Hot Prospects (4)', detail: 'Organic +34% MoM — personalized DM outreach window open.', urgency: 'today', label: 'Due today', color: '#d97706', bg: '#fffbeb', border: '#f59e0b' },
  { name: 'New Leads Intake (47)', detail: 'Initial welcome sequence queued. Review & personalize top 10.', urgency: 'week', label: 'This week', color: '#16a34a', bg: '#f0fdf4', border: '#22c55e' },
  ];

const appointments = [
  { time: '10:00 AM', name: 'Discovery Call — J. Torres', sub: 'Spring Lead Gen • Zoom', dot: '#22c55e', bg: '#eff6ff', color: '#3b82f6' },
  { time: '2:00 PM', name: 'Strategy Review — Prime IV', sub: 'Retargeting Q1 • In-person', dot: '#f59e0b', bg: '#f5f3ff', color: '#7c3aed' },
  { time: '4:30 PM', name: 'Onboarding Call — New Client', sub: 'Email Re-engage • Zoom', dot: '#22c55e', bg: '#fdf2f8', color: '#be185d' },
  ];

const pipeline = [
  { label: 'New Leads', val: 47, color: '#3b82f6', bg: '#eff6ff' },
  { label: 'Follow Ups', val: 23, color: '#f59e0b', bg: '#fffbeb' },
  { label: 'Hot Prospects', val: 12, color: '#ef4444', bg: '#fef2f2' },
  { label: 'Missed', val: 8, color: '#9ca3af', bg: '#f9fafb' },
  ];

export default function LeadFollowUp() {
    const { activeClient } = useClient();
    const { gradientFrom, gradientTo } = activeClient.branding;

  return (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          {/* Action Required Task List */}
                <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                                  <div>
                                              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">🔔 Action Required</h3>h3>
                                              <p className="text-[11px] text-gray-400 mt-0.5">AI-generated follow-up priorities</p>p>
                                  </div>div>
                                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                                              8 Urgent
                                  </div>div>
                        </div>div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {tasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: t.bg, borderRadius: 12, borderLeft: `3px solid ${t.border}` }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, marginTop: 4, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{t.name}</span>span>
                                                                      <span style={{ fontSize: 10, color: t.color, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8 }}>{t.label}</span>span>
                                                    </div>div>
                                                    <span style={{ fontSize: 11, color: '#6b7280' }}>{t.detail}</span>span>
                                    </div>div>
                      </div>div>
                    ))}
                        </div>div>
                        <button
                                    className="w-full mt-4 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all hover:opacity-90"
                                    style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                                  >
                                  View All Tasks in CRM →
                        </button>button>
                </Card>Card>
        
          {/* Pipeline + Today's Appointments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Pipeline at a glance */}
                      <Card className="p-5">
                                <h3 className="text-[14px] font-bold text-gray-900 mb-3">Pipeline at a Glance</h3>h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  {pipeline.map((p) => (
                        <div key={p.label} style={{ background: p.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: p.color }}>{p.val}</div>div>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginTop: 2 }}>{p.label}</div>div>
                        </div>div>
                      ))}
                                </div>div>
                      </Card>Card>
              
                {/* Today's Appointments */}
                      <Card className="p-5" style={{ flex: 1 }}>
                                <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-[14px] font-bold text-gray-900">📆 Today&apos;s Appointments</h3>h3>
                                            <span className="text-[11px] text-gray-400">Mon, Mar 30</span>span>
                                </div>div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {appointments.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: a.bg, borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: a.color, whiteSpace: 'nowrap' }}>{a.time}</div>div>
                                        <div style={{ flex: 1 }}>
                                                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{a.name}</div>div>
                                                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.sub}</div>div>
                                        </div>div>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
                        </div>div>
                      ))}
                                </div>div>
                      </Card>Card>
              </div>div>
        </div>div>
      );
}</Card>
