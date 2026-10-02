'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { Square?: any }
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const s = existing || document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Could not load the payment form.')));
    if (!existing) { s.src = src; document.head.appendChild(s); }
  });
}

type Props = {
  invoiceId: string;
  token: string;
  total: number;
  cardFee: number;
  cardFeePercent: number;
  defaultName: string;
  applicationId: string;
  locationId: string;
  sdkUrl: string;
};

export default function SquarePayForm(p: Props) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'bank' | 'card' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'paid' | 'processing' | null>(null);
  const [name, setName] = useState(p.defaultName);
  const cardRef = useRef<any>(null);
  const achRef = useRef<any>(null);
  const submitRef = useRef<(sourceId: string, method: 'bank' | 'card') => Promise<void>>();

  async function submit(sourceId: string, method: 'bank' | 'card') {
    setBusy(method);
    setError('');
    try {
      const res = await fetch('/api/pay/square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.invoiceId, t: p.token, sourceId, method, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The payment could not be completed.');
      setDone(data.status === 'paid' ? 'paid' : 'processing');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  submitRef.current = submit;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScript(p.sdkUrl);
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(p.applicationId, p.locationId);

        const card = await payments.card();
        await card.attach('#card-container');
        cardRef.current = card;

        // The bank login can redirect away on mobile and come back here; the
        // same transactionId lets the SDK resume and fire ontokenization.
        const ach = await payments.ach({ redirectURI: window.location.href, transactionId: p.invoiceId });
        ach.addEventListener('ontokenization', (event: any) => {
          const { tokenResult, error } = event.detail || {};
          if (error) { setError(String(error.message || error)); setBusy(null); return; }
          if (tokenResult?.status === 'OK') submitRef.current?.(tokenResult.token, 'bank');
          else setBusy(null);
        });
        achRef.current = ach;
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Could not load the payment form.');
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.();
      achRef.current?.destroy?.();
    };
  }, [p.applicationId, p.locationId, p.sdkUrl, p.invoiceId]);

  async function payByBank() {
    if (!achRef.current) return;
    if (!name.trim()) { setError('Enter the account holder name for the bank account.'); return; }
    setError('');
    setBusy('bank');
    try {
      await achRef.current.tokenize({
        accountHolderName: name.trim(),
        intent: 'CHARGE',
        amount: p.total.toFixed(2),
        currency: 'USD',
      });
      // Result arrives through the ontokenization listener.
    } catch (e: any) {
      setError(e.message || 'Bank connection was cancelled.');
      setBusy(null);
    }
  }

  async function payByCard() {
    if (!cardRef.current) return;
    setError('');
    setBusy('card');
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        setError(result.errors?.[0]?.message || 'Please check your card details.');
        setBusy(null);
        return;
      }
      await submit(result.token, 'card');
    } catch (e: any) {
      setError(e.message || 'Please check your card details.');
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#2e7d32', marginBottom: 8 }}>
          {done === 'paid' ? 'Paid — thank you!' : 'Payment submitted — thank you!'}
        </div>
        <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
          {done === 'paid'
            ? 'A receipt is on its way to your email.'
            : 'Bank transfers take 2–3 business days to clear. We\'ll email you a receipt when it does.'}
        </div>
      </div>
    );
  }

  const section: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 };
  const btn = (primary: boolean): React.CSSProperties => ({
    width: '100%', border: primary ? 'none' : '2px solid #0c6da4', borderRadius: 10, padding: '13px 16px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    background: primary ? '#0c6da4' : 'white', color: primary ? 'white' : '#0c6da4',
    opacity: !ready || busy ? 0.6 : 1,
  });

  return (
    <div>
      {error && (
        <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Bank transfer</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{money(p.total)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>No fee · sign in to your bank securely</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Account holder name"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 10 }}
        />
        <button onClick={payByBank} disabled={!ready || !!busy} style={btn(true)}>
          {busy === 'bank' ? 'Connecting…' : 'Pay by bank'}
        </button>
      </div>

      <div style={section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>Card</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{money(p.total + p.cardFee)}</span>
        </div>
        {p.cardFeePercent > 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
            Includes {p.cardFeePercent}% card processing fee ({money(p.cardFee)})
          </div>
        )}
        <div id="card-container" style={{ minHeight: 90 }} />
        <button onClick={payByCard} disabled={!ready || !!busy} style={btn(false)}>
          {busy === 'card' ? 'Processing…' : `Pay ${money(p.total + p.cardFee)} by card`}
        </button>
      </div>

      {!ready && !error && <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>Loading secure payment form…</div>}
    </div>
  );
}
