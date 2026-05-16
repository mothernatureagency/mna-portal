'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
};

type EnrollResult = {
  factorId: string;
  qr: string;
  secret: string;
};

export default function SecurityPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email || '');
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) setError(err.message);
    else setFactors([...(data?.totp || [])]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function startEnroll() {
    setBusy(true); setError(''); setSuccess('');
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator app · ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    if (!data) return;
    setEnrolling({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setCode('');
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setBusy(false);
    load();
  }

  async function verifyEnroll() {
    if (!enrolling || code.length !== 6) return;
    setBusy(true); setError('');
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: enrolling.factorId,
    });
    if (chalErr || !chal) { setError(chalErr?.message || 'Challenge failed'); setBusy(false); return; }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (verErr) { setError(verErr.message); return; }
    setEnrolling(null);
    setCode('');
    setSuccess('Two-factor authentication is now active on this account.');
    load();
  }

  async function removeFactor(id: string) {
    if (!confirm('Remove this authenticator? You’ll go back to password-only sign-in.')) return;
    setBusy(true); setError(''); setSuccess('');
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSuccess('Authenticator removed.');
    load();
  }

  const hasVerified = factors.some((f) => f.status === 'verified');

  return (
    <main className="min-h-screen bg-neutral-950 text-white px-4 py-10 flex justify-center">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Account security</h1>
          <p className="text-neutral-400 text-sm mt-1">{email}</p>
        </header>

        <section className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Two-factor authentication</h2>
            {hasVerified && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                Active
              </span>
            )}
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Add a second step at sign-in using an authenticator app (Google Authenticator,
            Authy, 1Password, etc.). Once enrolled, you’ll be asked for a 6-digit code after
            entering your password.
          </p>

          {loading && (
            <div className="mt-4 text-neutral-500 text-sm">Loading…</div>
          )}

          {!loading && !enrolling && factors.length === 0 && (
            <button
              onClick={startEnroll}
              disabled={busy}
              className="mt-4 rounded-xl py-3 px-5 font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              {busy ? 'Working…' : 'Set up authenticator app'}
            </button>
          )}

          {!loading && !enrolling && factors.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {factors.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl bg-neutral-800/60 border border-neutral-700 p-3">
                  <div>
                    <div className="text-sm font-semibold">{f.friendly_name || 'Authenticator app'}</div>
                    <div className="text-[11px] text-neutral-400">
                      {f.status === 'verified' ? 'Verified · ready to use' : 'Pending verification'}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFactor(f.id)}
                    disabled={busy}
                    className="text-[12px] font-semibold text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!factors.some((f) => f.status === 'unverified') && (
                <button
                  onClick={startEnroll}
                  disabled={busy}
                  className="text-[12px] font-semibold text-neutral-300 hover:text-white inline-flex items-center gap-1"
                >
                  + Add another authenticator
                </button>
              )}
            </div>
          )}

          {enrolling && (
            <div className="mt-5 flex flex-col gap-4">
              <div className="text-sm text-neutral-300">
                <strong>1.</strong> Scan this QR code in your authenticator app:
              </div>
              <div className="bg-white rounded-xl p-3 self-start" dangerouslySetInnerHTML={{ __html: enrolling.qr }} />
              <details className="text-xs text-neutral-400">
                <summary className="cursor-pointer hover:text-white">Can’t scan? Use this key instead</summary>
                <code className="block mt-2 p-2 bg-neutral-800 rounded text-neutral-200 break-all">{enrolling.secret}</code>
              </details>
              <div className="text-sm text-neutral-300">
                <strong>2.</strong> Enter the 6-digit code from the app:
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.4em] font-mono rounded-xl px-4 py-3 bg-neutral-800 border border-neutral-700 text-white outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
              />
              <div className="flex gap-2">
                <button
                  onClick={verifyEnroll}
                  disabled={busy || code.length !== 6}
                  className="flex-1 rounded-xl py-3 font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                >
                  {busy ? 'Verifying…' : 'Verify & activate'}
                </button>
                <button
                  onClick={cancelEnroll}
                  disabled={busy}
                  className="rounded-xl py-3 px-4 font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-rose-300 text-sm bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              {success}
            </div>
          )}
        </section>

        <a href="/" className="text-sm text-neutral-400 hover:text-white text-center">
          ← Back to app
        </a>
      </div>
    </main>
  );
}
