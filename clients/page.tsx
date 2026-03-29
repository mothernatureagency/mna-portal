'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';
import { Building2, Globe, Plus, MapPin } from 'lucide-react';

export default function ClientsPage() {
  const { allClients, activeClient, setActiveClientId } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="space-y-7 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1.5 h-6 rounded-full"
              style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }}
            />
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Clients</h1>
          </div>
          <p className="text-[12px] text-gray-400 pl-3.5">Manage accounts, branding, and KPI targets</p>
        </div>
        <button
          className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-xl text-white transition-all hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            boxShadow: `0 2px 8px ${gradientFrom}45`,
          }}
        >
          <Plus size={14} /> Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {allClients.map(client => {
          const isActive = activeClient.id === client.id;
          const clientWithMeta = client as typeof client & { location?: string };
          return (
            <div
              key={client.id}
              className="bg-white rounded-[20px] overflow-hidden transition-all duration-200 hover:-translate-y-[1px]"
              style={{
                border: isActive
                  ? `1.5px solid ${client.branding.primaryColor}35`
                  : '1px solid rgba(0,0,0,0.05)',
                boxShadow: isActive
                  ? `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px ${client.branding.primaryColor}15`
                  : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px rgba(12,109,164,0.05)',
              }}
            >
              {/* Top gradient band */}
              <div
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
              />

              <div className="p-6">
                {/* Client header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shadow-md flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
                  >
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[16px] font-bold text-gray-900 tracking-tight truncate">{client.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Building2 size={10} /> {client.industry}
                      </span>
                      {clientWithMeta.location && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {clientWithMeta.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})` }}
                    >
                      Active
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-gray-500 leading-relaxed mb-5">{client.notes}</p>

                {/* KPI targets */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {[
                    { label: 'Lead Target', value: client.kpiTargets.leads.toString() },
                    { label: 'CPL Target', value: `$${client.kpiTargets.costPerLead}` },
                    { label: 'Conv. Rate', value: `${client.kpiTargets.conversionRate}%` },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="text-center p-2.5 rounded-2xl"
                      style={{ background: `${client.branding.primaryColor}08`, border: `1px solid ${client.branding.primaryColor}12` }}
                    >
                      <div
                        className="text-[16px] font-extrabold"
                        style={{ color: client.branding.primaryColor }}
                      >
                        {value}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Integrations */}
                <div className="mb-5">
                  <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-300 mb-2">Integrations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {client.integrations.map(int => (
                      <span
                        key={int}
                        className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.04)', color: '#6b7280' }}
                      >
                        <Globe size={9} /> {int}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 pt-4"
                  style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
                >
                  <button
                    onClick={() => setActiveClientId(client.id)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:scale-[1.01]"
                    style={{
                      background: `linear-gradient(135deg, ${client.branding.gradientFrom}, ${client.branding.gradientTo})`,
                      boxShadow: `0 2px 8px ${client.branding.primaryColor}35`,
                      opacity: isActive ? 0.7 : 1,
                    }}
                  >
                    {isActive ? '✓ Viewing Now' : 'Switch to Client'}
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Client placeholder */}
        <div
          className="rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group min-h-[220px] hover:-translate-y-[1px]"
          style={{
            border: '1.5px dashed rgba(0,0,0,0.1)',
            background: 'rgba(248,250,252,0.5)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center group-hover:border-gray-300 transition-colors"
          >
            <Plus size={20} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="text-center">
            <div className="text-[14px] font-semibold text-gray-400 group-hover:text-gray-600 transition-colors">
              Add New Client
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              Configure branding, KPIs, and integrations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
