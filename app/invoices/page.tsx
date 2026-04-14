'use client';

import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { clients } from '@/lib/clients';

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
  paid_amount: number | null;
  payment_method: string | null;
  notes: string | null;
  client_visible: boolean;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af' },
  sent: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  paid: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
  overdue: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  cancelled: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
};

// MNA Payment info — displayed on invoices
const PAYMENT_INFO = {
  bankName: 'Bank of America',
  accountName: 'Mother Nature Agency LLC',
  accountNumber: '898165120338',
  achRouting: '063100277',
  wireRouting: '026009593',
  paypal: 'mn@mothernatureagency.com',
  zelle: 'mn@mothernatureagency.com',
};

export default function InvoicesPage() {
  const { activeClient } = useClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Create form state
  const [form, setForm] = useState({
    clientId: activeClient.id === 'mna' ? 'prime-iv' : activeClient.id,
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    taxRate: 0,
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, rate: 0, amount: 0 },
  ]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    const res = await fetch('/api/invoices');
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      if (field === 'quantity' || field === 'rate') {
        updated[idx].amount = Number(updated[idx].quantity) * Number(updated[idx].rate);
      }
      return updated;
    });
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (form.taxRate / 100);
  const total = subtotal + taxAmount;

  async function createInvoice() {
    const validItems = lineItems.filter(i => i.description.trim());
    if (!form.title || !form.clientId || validItems.length === 0) return;

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: form.clientId,
        title: form.title,
        description: form.description || null,
        items: validItems,
        subtotal,
        taxRate: form.taxRate,
        taxAmount,
        total,
        dueDate: form.dueDate,
        notes: form.notes || null,
      }),
    });

    if (res.ok) {
      setShowCreate(false);
      setForm({ clientId: 'prime-iv', title: '', description: '', dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), taxRate: 0, notes: '' });
      setLineItems([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
      fetchInvoices();
    }
  }

  async function updateStatus(id: string, status: string, extra?: Record<string, any>) {
    await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, ...extra }),
    });
    fetchInvoices();
    setSelectedInvoice(null);
  }

  async function patchInvoice(fields: Record<string, any>) {
    if (!selectedInvoice) return;
    const res = await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedInvoice.id, ...fields }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedInvoice(data.invoice);
      fetchInvoices();
    }
  }

  function updateModalLineItem(idx: number, field: keyof LineItem, value: string | number) {
    if (!selectedInvoice) return;
    const items = [...(selectedInvoice.items as LineItem[])];
    (items[idx] as any)[field] = value;
    if (field === 'quantity' || field === 'rate') {
      items[idx].amount = Number(items[idx].quantity) * Number(items[idx].rate);
    }
    const newSubtotal = items.reduce((s, i) => s + Number(i.amount), 0);
    const newTaxAmount = newSubtotal * (Number(selectedInvoice.tax_rate) / 100);
    const newTotal = newSubtotal + newTaxAmount;
    setSelectedInvoice({ ...selectedInvoice, items, subtotal: newSubtotal, tax_amount: newTaxAmount, total: newTotal });
  }

  function saveModalLineItems() {
    if (!selectedInvoice) return;
    const items = selectedInvoice.items as LineItem[];
    const newSubtotal = items.reduce((s, i) => s + Number(i.amount), 0);
    const newTaxAmount = newSubtotal * (Number(selectedInvoice.tax_rate) / 100);
    const newTotal = newSubtotal + newTaxAmount;
    patchInvoice({ items, subtotal: newSubtotal, tax_amount: newTaxAmount, total: newTotal });
  }

  function addModalLineItem() {
    if (!selectedInvoice) return;
    const items = [...(selectedInvoice.items as LineItem[]), { description: '', quantity: 1, rate: 0, amount: 0 }];
    setSelectedInvoice({ ...selectedInvoice, items });
  }

  function removeModalLineItem(idx: number) {
    if (!selectedInvoice) return;
    const items = (selectedInvoice.items as LineItem[]).filter((_, i) => i !== idx);
    const newSubtotal = items.reduce((s, i) => s + Number(i.amount), 0);
    const newTaxAmount = newSubtotal * (Number(selectedInvoice.tax_rate) / 100);
    const newTotal = newSubtotal + newTaxAmount;
    setSelectedInvoice({ ...selectedInvoice, items, subtotal: newSubtotal, tax_amount: newTaxAmount, total: newTotal });
    patchInvoice({ items, subtotal: newSubtotal, tax_amount: newTaxAmount, total: newTotal });
  }

  const shown = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totals = {
    outstanding: invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
    draft: invoices.filter(i => i.status === 'draft').length,
  };

  const inputStyle = 'w-full rounded-xl px-4 py-3 bg-white/5 text-white text-[13px] border border-white/10 focus:outline-none focus:border-cyan-500/50 placeholder:text-white/25';

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Invoices</h1>
          <p className="text-[12px] text-white/40 mt-0.5">Create, send, and track invoices</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Outstanding</div>
          <div className="text-[24px] font-extrabold text-white">${totals.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">Paid</div>
          <div className="text-[24px] font-extrabold text-white">${totals.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.15)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Drafts</div>
          <div className="text-[24px] font-extrabold text-white">{totals.draft}</div>
        </div>
      </div>

      {/* Create invoice form */}
      {showCreate && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-[15px] font-bold text-white mb-5">Create Invoice</h2>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Client</label>
              <select
                value={form.clientId}
                onChange={e => setForm({ ...form, clientId: e.target.value })}
                className={inputStyle}
              >
                {clients.filter(c => c.id !== 'mna').map(c => (
                  <option key={c.id} value={c.id} className="bg-neutral-900">{c.shortName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Invoice Title</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. April 2026 Marketing Services"
                className={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of services"
                className={inputStyle}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="mb-5">
            <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Line Items</div>
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: '1fr 80px 100px 100px 36px' }}>
                  <input
                    value={item.description}
                    onChange={e => updateLineItem(idx, 'description', e.target.value)}
                    placeholder="Service description"
                    className={inputStyle}
                  />
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))}
                    placeholder="Qty"
                    min={1}
                    className={inputStyle + ' text-center'}
                  />
                  <input
                    type="number"
                    value={item.rate || ''}
                    onChange={e => updateLineItem(idx, 'rate', Number(e.target.value))}
                    placeholder="Rate"
                    min={0}
                    step={0.01}
                    className={inputStyle + ' text-center'}
                  />
                  <div className="flex items-center justify-end text-[13px] font-bold text-white">
                    ${item.amount.toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeLineItem(idx)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors self-center"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addLineItem}
              className="mt-2 text-[12px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Add line item
            </button>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-5">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-white/50">Tax</span>
                  <input
                    type="number"
                    value={form.taxRate || ''}
                    onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })}
                    className="w-16 rounded-lg px-2 py-1 bg-white/5 text-white text-[12px] border border-white/10 text-center"
                    placeholder="0"
                    min={0}
                    step={0.5}
                  />
                  <span className="text-white/30 text-[11px]">%</span>
                </div>
                <span className="text-white font-semibold">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[15px] pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-white font-bold">Total</span>
                <span className="text-white font-extrabold">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-5">
            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Payment terms, additional info..."
              rows={2}
              className={inputStyle + ' resize-none'}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={createInvoice}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              Create Invoice
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              filter === f ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-white/30 text-center py-12">Loading...</div>
        ) : shown.length === 0 ? (
          <div className="text-white/30 text-center py-12">
            <span className="material-symbols-outlined mb-2" style={{ fontSize: 36 }}>receipt_long</span>
            <p>No invoices yet. Create your first one above.</p>
          </div>
        ) : (
          shown.map(inv => {
            const client = clients.find(c => c.id === inv.client_id);
            const ss = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
            const isOverdue = inv.status === 'sent' && new Date(inv.due_date) < new Date();
            return (
              <button
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className="w-full text-left flex items-center gap-4 px-5 py-4 rounded-xl transition-all hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-white">{inv.invoice_number}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: isOverdue ? STATUS_STYLES.overdue.bg : ss.bg, color: isOverdue ? STATUS_STYLES.overdue.text : ss.text }}>
                      {isOverdue ? 'overdue' : inv.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-white/70 truncate">{inv.title}</div>
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {client?.shortName || inv.client_id} · Due {inv.due_date}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[18px] font-extrabold text-white">${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #0f1f2e, #0d1b2a)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Invoice header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Invoice</div>
                  <div className="text-[20px] font-extrabold text-white">{selectedInvoice.invoice_number}</div>
                  <input
                    value={selectedInvoice.title}
                    onChange={(e) => setSelectedInvoice({ ...selectedInvoice, title: e.target.value })}
                    onBlur={() => patchInvoice({ title: selectedInvoice.title })}
                    className="text-[13px] text-white/70 mt-1 bg-transparent border-b border-transparent hover:border-white/15 focus:border-cyan-500/50 outline-none w-full py-0.5 transition-colors"
                    placeholder="Invoice title"
                  />
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              {/* Client + dates */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Bill To</div>
                  <div className="text-[14px] font-bold text-white">{clients.find(c => c.id === selectedInvoice.client_id)?.name || selectedInvoice.client_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Due Date</div>
                  <input
                    type="date"
                    value={selectedInvoice.due_date}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      if (!newDate) return;
                      await fetch('/api/invoices', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: selectedInvoice.id, due_date: newDate }),
                      });
                      setSelectedInvoice({ ...selectedInvoice, due_date: newDate });
                      fetchInvoices();
                    }}
                    className="text-[14px] font-bold text-white bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-cyan-500/50 cursor-pointer text-right"
                  />
                </div>
              </div>

              {/* Line items — editable */}
              <div className="mb-6">
                <div className="grid gap-0 text-[11px] font-bold text-white/30 uppercase tracking-wider mb-2" style={{ gridTemplateColumns: '1fr 70px 90px 90px 32px' }}>
                  <span>Description</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span></span>
                </div>
                {(selectedInvoice.items as LineItem[]).map((item, idx) => (
                  <div key={idx} className="grid gap-1 py-1.5 items-center text-[13px]" style={{ gridTemplateColumns: '1fr 70px 90px 90px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                      value={item.description}
                      onChange={(e) => updateModalLineItem(idx, 'description', e.target.value)}
                      onBlur={saveModalLineItems}
                      className="text-white bg-transparent border-b border-transparent hover:border-white/15 focus:border-cyan-500/50 outline-none py-0.5 text-[13px] transition-colors"
                      placeholder="Description"
                    />
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateModalLineItem(idx, 'quantity', Number(e.target.value))}
                      onBlur={saveModalLineItems}
                      className="text-white/50 bg-transparent border-b border-transparent hover:border-white/15 focus:border-cyan-500/50 outline-none py-0.5 text-[13px] text-center transition-colors w-full"
                      min={1}
                    />
                    <input
                      type="number"
                      value={item.rate || ''}
                      onChange={(e) => updateModalLineItem(idx, 'rate', Number(e.target.value))}
                      onBlur={saveModalLineItems}
                      className="text-white/50 bg-transparent border-b border-transparent hover:border-white/15 focus:border-cyan-500/50 outline-none py-0.5 text-[13px] text-right transition-colors w-full"
                      min={0}
                      step={0.01}
                    />
                    <span className="text-white font-semibold text-right">${Number(item.amount).toFixed(2)}</span>
                    <button
                      onClick={() => removeModalLineItem(idx)}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addModalLineItem}
                  className="mt-2 text-[12px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                  Add line item
                </button>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-[13px]"><span className="text-white/40">Subtotal</span><span className="text-white">${Number(selectedInvoice.subtotal).toFixed(2)}</span></div>
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40">Tax</span>
                      <input
                        type="number"
                        value={selectedInvoice.tax_rate || ''}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          const sub = Number(selectedInvoice.subtotal);
                          const taxAmt = sub * (rate / 100);
                          setSelectedInvoice({ ...selectedInvoice, tax_rate: rate, tax_amount: taxAmt, total: sub + taxAmt });
                        }}
                        onBlur={() => {
                          const rate = Number(selectedInvoice.tax_rate);
                          const sub = Number(selectedInvoice.subtotal);
                          const taxAmt = sub * (rate / 100);
                          patchInvoice({ tax_rate: rate, tax_amount: taxAmt, total: sub + taxAmt });
                        }}
                        className="w-14 rounded-md px-1.5 py-0.5 bg-white/5 text-white text-[12px] border border-white/10 text-center outline-none focus:border-cyan-500/50"
                        placeholder="0"
                        min={0}
                        step={0.5}
                      />
                      <span className="text-white/30 text-[11px]">%</span>
                    </div>
                    <span className="text-white">${Number(selectedInvoice.tax_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[16px] font-extrabold pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-white">Total</span>
                    <span className="text-white">${Number(selectedInvoice.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment info */}
              <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Payment Methods</div>
                <div className="text-[12px] text-white/40 mb-3">Send to <span className="text-white font-semibold">Mother Nature Agency LLC</span></div>
                <div className="grid grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <div className="text-white/30 mb-0.5">PayPal</div>
                    <div className="text-white font-semibold">{PAYMENT_INFO.paypal}</div>
                  </div>
                  <div>
                    <div className="text-white/30 mb-0.5">Zelle</div>
                    <div className="text-white font-semibold">{PAYMENT_INFO.zelle}</div>
                  </div>
                  <div className="col-span-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-white/50 font-semibold mb-1.5">{PAYMENT_INFO.bankName} — {PAYMENT_INFO.accountName}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-white/30">Account #</span> <span className="text-white font-semibold">{PAYMENT_INFO.accountNumber}</span></div>
                      <div><span className="text-white/30">ACH Routing #</span> <span className="text-white font-semibold">{PAYMENT_INFO.achRouting}</span></div>
                      <div><span className="text-white/30">Wire Routing #</span> <span className="text-white font-semibold">{PAYMENT_INFO.wireRouting}</span></div>
                      <div className="text-amber-400/80 text-[11px] font-semibold self-center">* Wire fee may apply</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-[11px] text-white/40">
                    Checks payable to: <span className="text-white/60 font-semibold">Mother Nature Agency LLC / Alexus Williams</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Notes</div>
                <textarea
                  value={selectedInvoice.notes || ''}
                  onChange={(e) => setSelectedInvoice({ ...selectedInvoice, notes: e.target.value })}
                  onBlur={() => patchInvoice({ notes: selectedInvoice.notes || null })}
                  placeholder="Payment terms, additional info..."
                  rows={2}
                  className="w-full text-[12px] text-white/60 bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-cyan-500/50 resize-none placeholder:text-white/20 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selectedInvoice.status === 'draft' && (
                  <>
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'sent', { issued_date: new Date().toISOString().slice(0, 10), client_visible: true })}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                    >
                      Send to Client
                    </button>
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'cancelled')}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white/50 bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'overdue') && (
                  <>
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'paid', { paid_date: new Date().toISOString().slice(0, 10), paid_amount: selectedInvoice.total })}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500"
                    >
                      Mark as Paid
                    </button>
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'draft', { client_visible: false, issued_date: null })}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white/50 bg-white/5 hover:text-white flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>undo</span>
                      Undo to Draft
                    </button>
                  </>
                )}
                {selectedInvoice.status === 'paid' && (
                  <button
                    onClick={() => updateStatus(selectedInvoice.id, 'sent', { paid_date: null, paid_amount: null })}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white/50 bg-white/5 hover:text-white flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>undo</span>
                    Undo Payment
                  </button>
                )}
                {selectedInvoice.status === 'cancelled' && (
                  <button
                    onClick={() => updateStatus(selectedInvoice.id, 'draft')}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white/50 bg-white/5 hover:text-white flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>undo</span>
                    Reopen as Draft
                  </button>
                )}
                {selectedInvoice.status === 'draft' && !selectedInvoice.client_visible && (
                  <button
                    onClick={() => updateStatus(selectedInvoice.id, selectedInvoice.status, { client_visible: true })}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white/50 bg-white/5 hover:text-white"
                  >
                    Make Visible to Client
                  </button>
                )}
                {/* Delete — always available */}
                <button
                  onClick={async () => {
                    if (!confirm(`Delete invoice ${selectedInvoice.invoice_number}? This cannot be undone.`)) return;
                    await fetch(`/api/invoices?id=${selectedInvoice.id}`, { method: 'DELETE' });
                    setSelectedInvoice(null);
                    fetchInvoices();
                  }}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-rose-400/70 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 flex items-center gap-1.5 ml-auto transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
