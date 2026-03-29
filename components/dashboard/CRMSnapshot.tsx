'use client';
import React from 'react';
import { UserPlus, Clock, Flame, AlertCircle } from 'lucide-react';
import { crmData } from '@/lib/demoData';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

export default function CRMSnapshot() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const items = [
    {
      label: 'New Leads',
      value: crmData.newLeads,
      icon: UserPlus,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.15)',
      desc: 'Awaiting first contact',
    },
    {
      label: 'Follow Ups',
      value: crmData.followUps,
      icon: Clock,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.15)',
      desc: 'Scheduled this week',
    },
    {
      label: 'Hot Prospects',
      value: crmData.hotProspects,
      icon: Flame,
      color: gradientFrom,
      bg: `${gradientFrom}10`,
      border: `${gradientFrom}20`,
      desc: 'High intent signals',
    },
    {
      label: 'Missed',
      value: crmData.missedOpportunities,
      icon: AlertCircle,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.15)',
      desc: 'Needs recovery plan',
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">CRM Snapshot</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Pipeline status overview</p>
        </div>
        <button
          className="text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-colors hover:opacity-80"
          style={{ color: gradientFrom, background: `${gradientFrom}10` }}
        >
          View CRM →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map(({ label, value, icon: Icon, color, bg, border, desc }) => (
          <div
            key={label}
            className="rounded-2xl p-4 transition-all duration-200 hover:-translate-y-[1px] cursor-pointer"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: `${color}15` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <span className="text-[11px] font-semibold text-gray-500">{label}</span>
            </div>
            <div
              className="text-[30px] font-extrabold tracking-tight leading-none mb-1"
              style={{ color }}
            >
              {value}
            </div>
            <div className="text-[11px] text-gray-400">{desc}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
