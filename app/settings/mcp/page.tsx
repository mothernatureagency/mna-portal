'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { clients as staticClients } from '@/lib/clients';

/**
 * MCP access tokens — owner only.
 *
 * Replaces minting a token by pasting fetch() into the browser console, which
 * is fine once for a developer and unusable for everyone else. The API at
 * /api/mcp-tokens is the same either way and enforces owner-only itself; this
 * page is just a front end for it.
 *
 * The raw token exists in this page's state for exactly as long as the modal
 * is open. It is never stored, never re-fetched, and cannot be shown again —
 * only its SHA-256 lives in the database.
 */

const ROLES = [
  { id: 'owner', label: 'Owner', hint: 'Everything, including deciding approvals' },
  { id: 'staff', label: 'Staff', hint: 'Everything except deciding approvals' },
  { id: 'manager', label: 'Manager', hint: 'Same as staff' },
  { id: 'agent', label: 'Agent', hint: 'Read-only: tasks, marketing, approvals' },
  { id: 'readonly', label: 'Read only', hint: 'Tasks and marketing, read only' },
];

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  subject_email: string;
  role: string;
  scopes: string[] | null;
  client_ids: string[] | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function McpTokensPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  // Static roster plus anything staff added; /api/clients returns only the
  // custom ones, so the built-ins have to come from lib/clients.ts.
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>(
    staticClients.map((c) => ({ id: c.id, name: c.name })),
  );
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [subjectEmail, setSubjectEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  /** The one and only time the raw token is visible. */
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp-tokens', { cache: 'no-store' });
      if (res.status === 403 || res.status === 401) { setDenied(true); return; }
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {
      setError('Could not load tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email && !subjectEmail) setSubjectEmail(user.email.toLowerCase());
    });
    fetch('/api/clients', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const extra = (d?.items || []).filter((c: any) => !staticClients.some((s) => s.id === c.id));
        if (extra.length) {
          setClients((prev) => [...prev, ...extra.map((c: any) => ({ id: c.id, name: c.name }))]);
        }
      })
      .catch(() => {});
  }, [load, subjectEmail]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setCreating(true);
    try {
      const res = await fetch('/api/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subjectEmail: subjectEmail.trim(),
          role,
          ...(clientIds.length ? { clientIds } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not create the token.'); return; }
      setFresh({ token: data.token, name: data.name });
      setName(''); setClientIds([]);
      load();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(t: TokenRow) {
    if (!confirm(`Revoke "${t.name}"? Anything using it stops working immediately.`)) return;
    await fetch(`/api/mcp-tokens?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="p-8 text-white/50">Loading…</div>;

  if (denied) {
    return (
      <div className="p-8">
        <Card className="p-8 max-w-xl">
          <h1 className="text-xl font-semibold text-white">Owner only</h1>
          <p className="mt-2 text-white/70">
            MCP tokens grant standing access to the portal&rsquo;s data, so only the owner can
            create or revoke them.
          </p>
        </Card>
      </div>
    );
  }

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">MCP access tokens</h1>
        <p className="mt-1 text-white/70">
          A token lets Claude reach the portal&rsquo;s task board, schedule and client list from
          outside the browser. Each one acts as a single person and can be revoked on its own.
        </p>
      </header>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Create a token</h2>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white/80">What it&rsquo;s for</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="Alexus laptop"
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white/80">Acts as</span>
              <input
                value={subjectEmail} onChange={(e) => setSubjectEmail(e.target.value)} required
                type="email" placeholder="name@mothernatureagency.com"
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30"
              />
              <span className="mt-1 block text-xs text-white/50">
                Whose schedule and notes this token reads, and who its writes are attributed to.
              </span>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-white/80">Access level</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => setRole(r.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    role === r.id ? 'border-sky-400/60 bg-sky-400/15' : 'border-white/10 hover:border-white/15'
                  }`}
                >
                  <span className="block text-sm font-medium text-white">{r.label}</span>
                  <span className="block text-xs text-white/50">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {clients.length > 0 && (
            <div>
              <span className="text-sm font-medium text-white/80">Limit to clients</span>
              <span className="ml-2 text-xs text-white/50">Optional. Leave empty for the full portfolio.</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {clients.map((c) => {
                  const on = clientIds.includes(c.id);
                  return (
                    <button
                      key={c.id} type="button"
                      onClick={() => setClientIds(on ? clientIds.filter((x) => x !== c.id) : [...clientIds, c.id])}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        on ? 'border-[#0c6da4] bg-[#0c6da4] text-white' : 'border-white/15 text-white/80 hover:border-white/30'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {clientIds.length > 0 && (
                <p className="mt-2 text-xs text-white/50">
                  This token will not see tasks with no client attached — those are agency business.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit" disabled={creating}
            className="rounded-lg bg-[#0c6da4] px-5 py-2.5 font-medium text-white hover:bg-[#0a5c8c] disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create token'}
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Active tokens {active.length > 0 && <span className="text-white/40 font-normal">({active.length})</span>}
        </h2>
        {active.length === 0 ? (
          <p className="text-white/50">No active tokens yet.</p>
        ) : (
          <div className="space-y-3">
            {active.map((t) => (
              <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 p-4">
                <div className="min-w-0">
                  <div className="font-medium text-white">{t.name}</div>
                  <div className="text-sm text-white/70">
                    {t.subject_email} · {t.role}
                    {t.client_ids?.length ? ` · limited to ${t.client_ids.join(', ')}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Created {fmt(t.created_at)} · Last used {t.last_used_at ? fmt(t.last_used_at) : 'never'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(t.scopes || []).map((s) => (
                      <span key={s} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">{s}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => revoke(t)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-50">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {revoked.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Revoked</h2>
          <p className="mb-4 text-sm text-white/50">Kept so &ldquo;who had access, and when&rdquo; survives.</p>
          <div className="space-y-2">
            {revoked.map((t) => (
              <div key={t.id} className="flex flex-wrap justify-between gap-2 text-sm text-white/50">
                <span>{t.name} · {t.subject_email}</span>
                <span>revoked {fmt(t.revoked_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fresh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-2xl p-7">
            <h2 className="text-xl font-semibold text-white">Copy this now</h2>
            <p className="mt-2 text-white/70">
              This is the only time <strong>{fresh.name}</strong> can be shown. Only its
              fingerprint is stored, so it cannot be recovered — a lost token is replaced, not found.
            </p>
            <div className="mt-4 rounded-lg bg-slate-950/70 p-4">
              <code className="block break-all font-mono text-sm text-emerald-300">{fresh.token}</code>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(fresh.token).then(
                    () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
                    () => setCopied(false),
                  );
                }}
                className="rounded-lg bg-[#0c6da4] px-5 py-2.5 font-medium text-white hover:bg-[#0a5c8c]"
              >
                {copied ? 'Copied' : 'Copy token'}
              </button>
              <button
                onClick={() => { setFresh(null); setCopied(false); }}
                className="rounded-lg border border-white/15 px-5 py-2.5 font-medium text-white/80 hover:bg-white/5"
              >
                Done
              </button>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-sm font-medium text-white/80">Connect Claude Code</p>
              <code className="mt-2 block overflow-x-auto rounded bg-white/5 p-3 font-mono text-xs text-white/80">
                claude mcp add --transport http mna https://portal.mothernatureagency.com/api/mcp --header &quot;Authorization: Bearer {fresh.token.slice(0, 16)}…&quot;
              </code>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
