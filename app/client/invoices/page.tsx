'use client';

import React, { useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

type LineItem = { description: string; quantity: number; rate: number; amount: number };
type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  title: string;
  description: string | null;
  items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: string;
  due_date: string;
  issued_date: string | null;
  paid_date: string | null;
  notes: string | null;
  client_visible: boolean;
  pay_token: string | null;
  payment_status: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sent: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Awaiting Payment' },
  paid: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Paid' },
  overdue: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Overdue' },
};

export default function ClientInvoicesPage() {
  const { client } = useClientPortal();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);

  useEffect(() => {
    fetch(`/api/invoices?clientId=${client.id}`)
      .then(r => r.json())
      .then(data => {
        // Only show client-visible invoices that aren't drafts
        setInvoices((data.invoices || []).filter((i: Invoice) => i.client_visible && i.status !== 'draft'));
      })
      .finally(() => setLoading(false));
  }, [client.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-extrabold text-white tracking-tight">Invoices</h1>
        <p className="text-[12px] text-white/40 mt-0.5">View and track your invoices from Mother Nature Agency</p>
      </div>

      {loading ? (
        <div className="text-white/30 text-center py-12">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16 }}>
          <span className="material-symbols-outlined text-white/15 mb-3" style={{ fontSize: 40 }}>receipt_long</span>
          <p className="text-white/30 text-[13px]">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => {
            const isOverdue = inv.status === 'sent' && new Date(inv.due_date) < new Date();
            const ss = STATUS_STYLES[isOverdue ? 'overdue' : inv.status] || STATUS_STYLES.sent;
            return (
              <button
                key={inv.id}
                onClick={() => setSelected(inv)}
                className="w-full text-left flex items-center gap-4 px-5 py-4 rounded-xl transition-all hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-white">{inv.invoice_number}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.text }}>{ss.label}</span>
                  </div>
                  <div className="text-[13px] text-white/70">{inv.title}</div>
                  <div className="text-[11px] text-white/30 mt-0.5">Due {inv.due_date}</div>
                </div>
                <div className="text-[18px] font-extrabold text-white">${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Invoice detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #0f1f2e, #0d1b2a)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Invoice</div>
                  <div className="text-[20px] font-extrabold text-white">{selected.invoice_number}</div>
                  <div className="text-[13px] text-white/50 mt-1">{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold text-white/30 uppercase">From</div>
                  <div className="text-[13px] font-bold text-white">Mother Nature Agency</div>
                  <div className="text-[11px] text-white/40">mn@mothernatureagency.com</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-white/30 uppercase">Due Date</div>
                  <div className="text-[13px] font-bold text-white">{selected.due_date}</div>
                </div>
              </div>

              {/* Line items */}
              <div className="mb-6">
                <div className="grid text-[11px] font-bold text-white/30 uppercase tracking-wider mb-2" style={{ gridTemplateColumns: '1fr 70px 90px 90px' }}>
                  <span>Description</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
                </div>
                {(selected.items as LineItem[]).map((item, idx) => (
                  <div key={idx} className="grid py-2.5 text-[13px]" style={{ gridTemplateColumns: '1fr 70px 90px 90px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-white">{item.description}</span>
                    <span className="text-white/50 text-center">{item.quantity}</span>
                    <span className="text-white/50 text-right">${Number(item.rate).toFixed(2)}</span>
                    <span className="text-white font-semibold text-right">${Number(item.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mb-6">
                <div className="w-56 space-y-1.5">
                  <div className="flex justify-between text-[13px]"><span className="text-white/40">Subtotal</span><span className="text-white">${Number(selected.subtotal).toFixed(2)}</span></div>
                  {Number(selected.tax_rate) > 0 && (
                    <div className="flex justify-between text-[13px]"><span className="text-white/40">Tax ({selected.tax_rate}%)</span><span className="text-white">${Number(selected.tax_amount).toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between text-[16px] font-extrabold pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-white">Total</span>
                    <span className="text-white">${Number(selected.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Pay online */}
              {selected.status !== 'paid' && selected.payment_status === 'processing' && (
                <div className="rounded-xl px-4 py-3 mb-4 text-[12px] text-cyan-300" style={{ background: 'rgba(74,184,206,0.08)', border: '1px solid rgba(74,184,206,0.2)' }}>
                  Your bank payment is processing. It usually clears in 2–3 business days.
                </div>
              )}
              {selected.status !== 'paid' && selected.payment_status !== 'processing' && selected.pay_token && (
                <a
                  href={`/pay/${selected.id}?t=${encodeURIComponent(selected.pay_token)}`}
                  className="block text-center rounded-xl py-3 mb-4 text-[14px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                >
                  Pay Invoice — bank transfer or card
                </a>
              )}

              {/* Other payment methods */}
              {selected.status !== 'paid' && (
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(74,184,206,0.06)', border: '1px solid rgba(74,184,206,0.15)' }}>
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-3">{selected.pay_token ? 'Other Ways to Pay' : 'Payment Methods'}</div>
                  <div className="grid grid-cols-2 gap-4 text-[12px]">
                    <div>
                      <div className="text-white/30 mb-0.5">Zelle</div>
                      <div className="text-white font-semibold">mn@mothernatureagency.com</div>
                    </div>
                    <div>
                      <div className="text-white/30 mb-0.5">Check payable to</div>
                      <div className="text-white font-semibold">Mother Nature Agency LLC</div>
                    </div>
                  </div>
                </div>
              )}

              {selected.notes && (
                <div className="text-[12px] text-white/40"><span className="font-bold text-white/50">Notes: </span>{selected.notes}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
