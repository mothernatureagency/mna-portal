'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';

type Account = { id: string; email: string; role: string; client_ids: string; created_at: string; last_sign_in_at: string | null };

const ROLES = [
  { key: 'client', label: 'Client', hint: 'Client portal only — sees just the stores you pick.' },
  { key: 'owner', label: 'Manager (scoped)', hint: 'All agency tools, but only the stores you pick.' },
  { key: 'staff', label: 'Staff (everything)', hint: 'Full access — sees every client and tool.' },
];

export default function AccountsPage() {
  const { allClients } = useClient();
  const clients = useMemo(() => allClients.filter((c) => c.id !== 'mna'), [allClients]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('client');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; role: string; tempPassword: string | null; custom: boolean; clientIds: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { loadAccounts(); }, []);

  async function removeAccount(id: string, email: string) {
    if (!confirm(`Remove the login account for ${email}? They will no longer be able to sign in. This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not remove account'); return; }
      loadAccounts();
    } catch { alert('Could not remove account'); }
  }

  const needsStores = role === 'client' || role === 'owner';

  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create() {
    setError(''); setResult(null);
    if (!email.trim()) { setError('Enter an email.'); return; }
    if (needsStores && picked.size === 0) { setError('Pick at least one store.'); return; }
    if (password && password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, clientIds: needsStores ? Array.from(picked) : [], password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create account');
      setResult({ email: data.email, role: data.role, tempPassword: data.tempPassword, custom: !!data.custom, clientIds: data.clientIds || [] });
      setEmail(''); setPicked(new Set()); setPassword('');
      loadAccounts();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const nameFor = (id: string) => clients.find((c) => c.id === id)?.shortName || id;
  const inputCls = 'text-[13px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30';

  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      <div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>manage_accounts</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">Accounts</h1>
        </div>
        <p className="text-white/60 mt-1 text-sm">Create portal logins — pick a role and (for clients/managers) which stores they can see.</p>
      </div>

      {/* Create form */}
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={`${inputCls} w-full mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} w-full mt-1`}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="text-[11px] text-white/45">{ROLES.find((r) => r.key === role)?.hint}</div>

        {needsStores && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1.5">Stores this account can see</div>
            <div className="flex flex-wrap gap-1.5">
              {clients.map((c) => {
                const on = picked.has(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5"
                    style={on ? { background: c.branding.gradientFrom, color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {on && <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>}
                    {c.shortName}
                  </button>
                );
              })}
              {clients.length === 0 && <span className="text-[12px] text-white/35">No clients yet — add locations on the Clients page first.</span>}
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/45">Password</label>
          <div className="relative mt-1">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to auto-generate a temporary password"
              autoComplete="new-password"
              className={`${inputCls} w-full pr-10`}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPw ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <div className="text-[10px] text-white/40 mt-1">Set a password so they can sign in right away, or leave blank and share the generated one.</div>
        </div>

        {error && <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

        <div>
          <button onClick={create} disabled={busy}
            className="text-[13px] font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-40 inline-flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>person_add</span>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </div>

        {result && (
          <div className="rounded-xl p-4 mt-1" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(52,211,153,0.35)' }}>
            <div className="text-[13px] font-bold text-emerald-200 mb-1">Account created for {result.email}</div>
            <div className="text-[12px] text-white/70 mb-2">
              Role: <b className="text-white">{ROLES.find((r) => r.key === result.role)?.label}</b>
              {result.clientIds.length > 0 && <> · Stores: {result.clientIds.map(nameFor).join(', ')}</>}
            </div>
            {result.custom ? (
              <div className="text-[12px] text-white/70">They can sign in right away with the password you set — no reset needed.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-white/50">Temporary password:</span>
                  <code className="text-[13px] font-mono text-white bg-black/40 px-2 py-1 rounded">{result.tempPassword}</code>
                  <button onClick={() => { if (result.tempPassword) { navigator.clipboard?.writeText(result.tempPassword); setCopied(true); setTimeout(() => setCopied(false), 1400); } }}
                    className="text-[11px] font-bold text-white/70 hover:text-white inline-flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>{copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-[11px] text-white/45 mt-2">
                  Share this with them to sign in at the portal login, then have them change it via “Forgot password.”
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Existing accounts */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-3">Existing accounts ({accounts.length})</div>
        {loading ? (
          <div className="text-[12px] text-white/40">Loading…</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{a.email}</div>
                  {a.client_ids && <div className="text-[10px] text-white/40 truncate">{String(a.client_ids).split(',').map((id) => nameFor(id.trim())).join(', ')}</div>}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{
                  background: a.role === 'client' ? 'rgba(56,189,248,0.2)' : a.role === 'owner' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)',
                  color: a.role === 'client' ? '#7dd3fc' : a.role === 'owner' ? '#c4b5fd' : '#6ee7b7',
                }}>
                  {ROLES.find((r) => r.key === a.role)?.label || a.role}
                </span>
                <button
                  onClick={() => removeAccount(a.id, a.email)}
                  title="Remove account"
                  className="text-white/30 hover:text-rose-300 shrink-0"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
