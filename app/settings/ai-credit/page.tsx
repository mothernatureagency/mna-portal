'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { clients as staticClients } from '@/lib/clients';

/**
 * Anthropic credit — owner only.
 *
 * Anthropic bills the organisation and its API has no balance endpoint, so
 * the portal keeps its own ledger: record a top-up when credit is bought,
 * every model call is priced from the tokens it used, and the difference is
 * what's left. /api/ai-credit enforces owner-only; this page is its front end.
 */

type Summary = {
  toppedUpUsd: number;
  hasLedger: boolean;
  spentUsd: number;
  balanceUsd: number;
  spentLast30Usd: number;
  spentLast7Usd: number;
  daysRemaining: number | null;
  lowBalanceUsd: number;
  hardStop: boolean;
  low: boolean;
};

type Row = { cost_usd: number; calls: number };
type Payload = {
  summary: Summary;
  days: number;
  bySource: (Row & { source: string; tokens: string })[];
  byModel: (Row & { model: string })[];
  byClient: (Row & { client_id: string })[];
  byDay: (Row & { day: string })[];
  ledger: { id: string; at: string; amount_usd: number; note: string | null; created_by: string | null }[];
  recent: {
    id: string; at: string; source: string; model: string; client_id: string | null;
    actor: string | null; input_tokens: number; output_tokens: number; cost_usd: number;
  }[];
  failedCalls: number;
};

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/** Sub-cent amounts round to $0.00, which reads as "free" rather than "small". */
const usdFine = (n: number) =>
  n > 0 && n < 0.01
    ? '< $0.01'
    : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d: string) =>
  new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const clientName = (id: string) => staticClients.find((c) => c.id === id)?.name || id;

/** Model ids are long and all start the same way; the tier is the useful part. */
const modelLabel = (m: string) =>
  m.includes('opus') ? 'Opus' : m.includes('sonnet') ? 'Sonnet' : m.includes('haiku') ? 'Haiku' : m;

const QUICK_AMOUNTS = [50, 100, 250, 500];

export default function AiCreditPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState('');

  const [threshold, setThreshold] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async (d: number) => {
    try {
      const res = await fetch(`/api/ai-credit?days=${d}`, { cache: 'no-store' });
      if (res.status === 403 || res.status === 401) { setDenied(true); return; }
      if (!res.ok) { setError('Could not load the credit balance.'); return; }
      const payload: Payload = await res.json();
      setData(payload);
      setThreshold(String(payload.summary.lowBalanceUsd));
    } catch {
      setError('Could not load the credit balance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    const amountUsd = Number(amount);
    if (!Number.isFinite(amountUsd) || amountUsd === 0) { setError('Enter an amount.'); return; }
    setAdding(true); setError(''); setAdded('');
    try {
      const res = await fetch('/api/ai-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd, note }),
      });
      const payload = await res.json();
      if (!res.ok) { setError(payload?.error || 'Could not record the top-up.'); return; }
      setAmount(''); setNote('');
      setAdded(`Added ${usd(amountUsd)}.`);
      await load(days);
    } catch {
      setError('Could not record the top-up.');
    } finally {
      setAdding(false);
    }
  }

  async function saveSettings(next: { lowBalanceUsd?: number; hardStop?: boolean }) {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/ai-credit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) await load(days);
    } catch {
      setError('Could not save the setting.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeEntry(id: string, amountUsd: number) {
    if (!confirm(`Remove the ${usd(amountUsd)} entry? The balance goes back down by that much.`)) return;
    await fetch(`/api/ai-credit?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load(days);
  }

  if (loading) return <div className="p-8 text-white/50">Loading…</div>;

  if (denied) {
    return (
      <div className="p-8">
        <Card className="p-8 max-w-xl">
          <h1 className="text-xl font-semibold text-white">Owner only</h1>
          <p className="mt-2 text-white/70">
            This page shows what the agency has paid Anthropic and lets someone change that
            number, so only the owner can open it.
          </p>
        </Card>
      </div>
    );
  }

  const s = data?.summary;
  const peakDay = Math.max(1e-9, ...(data?.byDay || []).map((d) => d.cost_usd));
  const neverToppedUp = !!s && !s.hasLedger;

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Anthropic credit</h1>
        <p className="mt-1 text-white/70">
          What the portal has to spend on AI, and what it has spent. Every agent, campaign
          draft and content plan bills against this.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {s && s.low && !neverToppedUp && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Credit is running low.</strong> {usd(s.balanceUsd)} left, under the{' '}
          {usd(s.lowBalanceUsd)} warning line
          {s.daysRemaining !== null && <> — about {s.daysRemaining} days at the last week&rsquo;s rate</>}.
          Top up in Anthropic&rsquo;s console, then record it below.
        </div>
      )}

      {/* Balance */}
      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="text-sm font-medium text-white/50">Balance</span>
            <div className={`text-4xl font-bold ${s && s.balanceUsd <= 0 && !neverToppedUp ? 'text-red-300' : 'text-white'}`}>
              {s ? usd(s.balanceUsd) : '—'}
            </div>
            {s && (
              <div className="mt-1 text-sm text-white/50">
                {usd(s.toppedUpUsd)} added · {usd(s.spentUsd)} spent
                {s.daysRemaining !== null && s.balanceUsd > 0 && <> · ~{s.daysRemaining} days left</>}
              </div>
            )}
          </div>
          <div className="flex gap-8">
            <div>
              <span className="block text-sm font-medium text-white/50">Last 7 days</span>
              <span className="text-xl font-semibold text-white">{s ? usdFine(s.spentLast7Usd) : '—'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-white/50">Last 30 days</span>
              <span className="text-xl font-semibold text-white">{s ? usdFine(s.spentLast30Usd) : '—'}</span>
            </div>
          </div>
        </div>

        {neverToppedUp && (
          <p className="mt-4 rounded-lg bg-white/5 px-4 py-3 text-sm text-white/70">
            No credit recorded yet, so the balance is just the spend so far, as a negative number.
            Record what you last paid Anthropic and it starts tracking properly.
          </p>
        )}
      </Card>

      {/* Add credit */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Record a top-up</h2>
        <p className="mt-1 text-sm text-white/50">
          Buy the credit in Anthropic&rsquo;s console, then enter the amount here so the portal
          knows about it. A negative amount corrects a mistake.
        </p>
        <form onSubmit={addCredit} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <label className="block">
              <span className="text-sm font-medium text-white/80">Amount (USD)</span>
              <input
                value={amount} onChange={(e) => setAmount(e.target.value)}
                type="number" step="0.01" placeholder="100.00" required
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white/80">Note</span>
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Optional — invoice number, card used, who bought it"
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a} type="button" onClick={() => setAmount(String(a))}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/80 hover:border-white/15"
              >
                {usd(a)}
              </button>
            ))}
            <button
              type="submit" disabled={adding}
              className="ml-auto rounded-lg bg-[#0c6da4] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a5c8c] disabled:opacity-50"
            >
              {adding ? 'Recording…' : 'Record top-up'}
            </button>
          </div>
          {added && <p className="text-sm text-emerald-300">{added}</p>}
        </form>
      </Card>

      {/* Warning line and hard stop */}
      {s && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">When credit runs out</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white/80">Warn below</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={threshold} onChange={(e) => setThreshold(e.target.value)}
                  type="number" step="1" min="0"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30"
                />
                <button
                  type="button" disabled={savingSettings}
                  onClick={() => saveSettings({ lowBalanceUsd: Number(threshold) })}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 hover:border-white/15 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-white/10 p-3">
              <input
                type="checkbox" checked={s.hardStop} disabled={savingSettings}
                onChange={(e) => saveSettings({ hardStop: e.target.checked })}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-white">Stop at zero</span>
                <span className="block text-xs text-white/50">
                  Refuse AI requests once the balance hits zero, instead of letting them run
                  on into an overspend. Off by default, because it switches off every agent
                  at once.
                </span>
              </span>
            </label>
          </div>
        </Card>
      )}

      {/* Spend */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Where it went</h2>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d} type="button" onClick={() => setDays(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  days === d ? 'border-sky-400/60 bg-sky-400/15 text-white' : 'border-white/10 text-white/70 hover:border-white/15'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {data && data.byDay.length > 0 && (
          <div className="mt-5 flex h-24 items-end gap-[3px]">
            {data.byDay.map((d) => (
              <div
                key={d.day} title={`${fmtDate(d.day)} — ${usdFine(d.cost_usd)} over ${d.calls} calls`}
                className="flex-1 rounded-t bg-[#0c6da4]/70 hover:bg-[#0c6da4]"
                style={{ height: `${Math.max(2, (d.cost_usd / peakDay) * 100)}%` }}
              />
            ))}
          </div>
        )}

        {data && data.bySource.length === 0 && (
          <p className="mt-4 text-sm text-white/50">
            Nothing spent in this window. Spend appears here the next time an agent runs.
          </p>
        )}

        {data && data.bySource.length > 0 && (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-white/80">By feature</h3>
              <ul className="mt-2 space-y-1">
                {data.bySource.slice(0, 12).map((r) => (
                  <li key={r.source} className="flex justify-between gap-4 text-sm">
                    <span className="truncate text-white/70">{r.source}</span>
                    <span className="shrink-0 tabular-nums text-white">
                      {usdFine(r.cost_usd)} <span className="text-white/40">· {r.calls}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white/80">By model</h3>
                <ul className="mt-2 space-y-1">
                  {data.byModel.map((r) => (
                    <li key={r.model} className="flex justify-between gap-4 text-sm">
                      <span className="truncate text-white/70">{modelLabel(r.model)}</span>
                      <span className="shrink-0 tabular-nums text-white">
                        {usdFine(r.cost_usd)} <span className="text-white/40">· {r.calls}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {data.byClient.some((r) => r.client_id) && (
                <div>
                  <h3 className="text-sm font-semibold text-white/80">By client</h3>
                  <ul className="mt-2 space-y-1">
                    {data.byClient.map((r) => (
                      <li key={r.client_id || 'none'} className="flex justify-between gap-4 text-sm">
                        <span className="truncate text-white/70">
                          {r.client_id ? clientName(r.client_id) : 'Not client-specific'}
                        </span>
                        <span className="shrink-0 tabular-nums text-white">{usdFine(r.cost_usd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {data && data.failedCalls > 0 && (
          <p className="mt-6 text-xs text-white/40">
            {data.failedCalls} call{data.failedCalls === 1 ? '' : 's'} failed in this window. Failed
            calls are logged but cost nothing.
          </p>
        )}
      </Card>

      {/* Recent calls */}
      {data && data.recent.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Recent calls</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Feature</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Tokens</th>
                  <th className="py-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-white/50">{fmtTime(r.at)}</td>
                    <td className="py-2 pr-4 text-white/80">
                      {r.source}
                      {r.client_id && <span className="text-white/40"> · {clientName(r.client_id)}</span>}
                    </td>
                    <td className="py-2 pr-4 text-white/50">{modelLabel(r.model)}</td>
                    <td className="py-2 pr-4 tabular-nums text-white/50">
                      {(r.input_tokens + r.output_tokens).toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums text-white">{usdFine(r.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top-up history */}
      {data && data.ledger.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Top-ups</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {data.ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <span className={`text-sm font-medium ${l.amount_usd < 0 ? 'text-red-300' : 'text-white'}`}>
                    {usd(l.amount_usd)}
                  </span>
                  <span className="ml-2 text-sm text-white/50">{fmtDate(l.at)}</span>
                  {l.note && <span className="ml-2 truncate text-sm text-white/40">{l.note}</span>}
                </div>
                <button
                  type="button" onClick={() => removeEntry(l.id, l.amount_usd)}
                  className="shrink-0 text-xs text-white/40 hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-white/40">
        Costs are the portal&rsquo;s own estimate, priced from the tokens each call reported
        against Anthropic&rsquo;s published rates. Anthropic&rsquo;s invoice is the number that
        counts; if the two drift, correct the rates with ANTHROPIC_PRICE_OVERRIDES.
      </p>
    </div>
  );
}
