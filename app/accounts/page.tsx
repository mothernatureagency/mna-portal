'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { STAFF } from '@/lib/staff';

type Account = { id: string; email: string; name?: string; role: string; client_ids: string; created_at: string; last_sign_in_at: string | null };
type Member = { email: string; name: string; role?: string; color?: string; custom: boolean; login?: boolean };

const OWNER_EMAIL = 'mn@mothernatureagency.com';

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

  // Team roster (assignable staff — separate from login accounts)
  const [customStaff, setCustomStaff] = useState<Member[]>([]);
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rRole, setRRole] = useState('');
  const [rErr, setRErr] = useState('');

  const roster = useMemo<Member[]>(() => {
    const base: Member[] = STAFF.map((s) => ({ email: s.email, name: s.name, role: s.role, custom: false }));
    const seen = new Set(base.map((m) => m.email.toLowerCase()));
    for (const c of customStaff) if (!seen.has(c.email.toLowerCase())) { base.push(c); seen.add(c.email.toLowerCase()); }
    // Staff/manager login accounts are assignable too — surface them even if
    // they were never added to the roster explicitly.
    for (const a of accounts) {
      const em = (a.email || '').toLowerCase();
      if (!em || a.role === 'client' || seen.has(em)) continue;
      base.push({ email: a.email, name: a.name || a.email.split('@')[0], role: a.role, custom: false, login: true });
      seen.add(em);
    }
    return base;
  }, [customStaff, accounts]);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch {} finally { setLoading(false); }
  }
  async function loadRoster() {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setCustomStaff((data.staff || []).map((s: any) => ({ email: s.email, name: s.name, role: s.role, color: s.color, custom: true })));
    } catch {}
  }
  useEffect(() => { loadAccounts(); loadRoster(); }, []);

  async function addTeammate() {
    const name = rName.trim(); const em = rEmail.trim();
    if (!name || !em) { setRErr('Name and email are required.'); return; }
    setRErr('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: em, role: rRole.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not add teammate');
      setRName(''); setREmail(''); setRRole('');
      loadRoster();
    } catch (e: any) { setRErr(e.message); }
  }
  async function removeTeammate(em: string, name: string) {
    if (!confirm(`Remove ${name} from the team roster? Their client assignments are cleared too.`)) return;
    setCustomStaff((prev) => prev.filter((m) => m.email.toLowerCase() !== em.toLowerCase()));
    try { await fetch(`/api/staff?email=${encodeURIComponent(em)}`, { method: 'DELETE' }); } catch {}
  }

  // Pre-fill the create-account form from a roster teammate (default to a
  // full staff login) and scroll up so you can finish + create.
  function createLoginFor(m: Member) {
    setEmail(m.email);
    setRole('staff');
    setPicked(new Set());
    setResult(null);
    setError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const hasLogin = (em: string) => accounts.some((a) => a.email?.toLowerCase() === em.toLowerCase());

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

      {/* Team Roster */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 20 }}>groups</span>
          <h3 className="text-[15px] font-bold text-white">Team Roster</h3>
        </div>
        <p className="text-[11px] text-white/45 mb-3">Your teammates — these are who you can assign to clients (Team Assignments on the dashboard). Separate from login accounts above.</p>

        {/* Add teammate */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
          <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Name" className="text-[12px] px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
          <input value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="email@mothernatureagency.com" className="text-[12px] px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30 sm:col-span-2" />
          <div className="flex gap-2">
            <input value={rRole} onChange={(e) => setRRole(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTeammate(); }} placeholder="Role" className="flex-1 min-w-0 text-[12px] px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30" />
            <button onClick={addTeammate} className="text-[12px] font-bold px-3 py-2 rounded-lg text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}>Add</button>
          </div>
        </div>
        {rErr && <div className="text-[11px] text-rose-300 mb-2">{rErr}</div>}

        <div className="flex flex-col gap-1.5">
          {roster.map((m) => (
            <div key={m.email} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white shrink-0" style={{ background: (m.color || '#7c3aed') }}>
                {m.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white truncate">{m.name}{m.email.toLowerCase() === OWNER_EMAIL && <span className="text-white/40 font-normal"> · you</span>}</div>
                <div className="text-[10px] text-white/40 truncate">{m.email}{m.role ? ` · ${m.role}` : ''}</div>
              </div>
              {m.custom ? (
                <button onClick={() => removeTeammate(m.email, m.name)} title="Remove teammate" className="text-white/30 hover:text-rose-300 shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                </button>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">{m.login ? 'Has login' : 'Built-in'}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
