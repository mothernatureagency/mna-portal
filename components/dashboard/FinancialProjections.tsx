'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const revenue = [38, 52, 61, 75, 98, 142];
const targets = [50, 60, 70, 80, 100, 150];

export default function FinancialProjections() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;
  const maxVal = 180;
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Revenue Forecast</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Actual vs target · Last 6 months</p>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-black text-gray-900">$142K</div>
            <div className="text-[11px] font-bold" style={{ color: '#16a34a' }}>+31% vs last month</div>
          </div>
        </div>
        <div className="flex items-end gap-3" style={{ height: 140 }}>
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end" style={{ height: 112 }}>
                <div className="flex-1 rounded-t-md" style={{ height: Math.round((revenue[i] / maxVal) * 112), background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})`, opacity: i === 5 ? 1 : 0.65 }} />
                <div className="flex-1 rounded-t-md bg-gray-200" style={{ height: Math.round((targets[i] / maxVal) * 112) }} />
              </div>
              <span className="text-[9px] font-bold text-gray-400">{m}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: gradientFrom }} />
            <span className="text-[10px] text-gray-500">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-gray-200" />
            <span className="text-[10px] text-gray-500">Target</span>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Q2 Projection</div>
          <div className="text-[28px] font-black text-gray-900">$198K</div>
          <div className="text-[11px] text-gray-400 mb-3">Based on current growth rate</div>
          <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
            <div className="h-full rounded-full" style={{ width: '72%', background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
          </div>
          <div className="text-[10px] text-gray-400 mt-1">72% of $275K annual goal</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">ROAS</div>
          <div className="text-[28px] font-black" style={{ color: gradientFrom }}>3.8x</div>
          <div className="text-[11px] text-gray-400">Return on ad spend · Mar 2026</div>
        </Card>
        <Card className="p-5">
          <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Lifetime Value</div>
          <div className="text-[28px] font-black text-gray-900">$3,240</div>
          <div className="text-[11px] text-gray-400">Avg client LTV · +12% YoY</div>
        </Card>
      </div>
    </div>
  );
}
