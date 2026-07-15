'use client';
import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let settled = false;
    const markReady = () => { settled = true; setReady(true); };

    (async () => {
      // Normally /auth/callback already exchanged the code and set the session.
      // But handle the token directly too, in case the email links straight
      // here or arrives as a token_hash/recovery link instead of a ?code=.
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type') || 'recovery';
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
        }
      } catch { /* fall through to session check */ }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) markReady();
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') markReady();
    });

    // If no valid session shows up, tell the user the link is bad/expired
    // instead of leaving them on an endless "verifying…".
    const t = setTimeout(() => { if (!settled) setLinkError(true); }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, [supabase.auth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess('Password updated! Redirecting...');
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 rounded-3xl px-12 py-14 flex flex-col gap-6 w-full max-w-md shadow-2xl"
      >
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <img
            src="/logos/mna-icon-transparent.png"
            alt="Mother Nature Agency"
            className="h-20 w-auto"
          />
          <h1 className="text-white text-3xl font-bold tracking-tight">
            Set New Password
          </h1>
          <p className="text-neutral-500 text-base">Enter your new password below</p>
        </div>

        {!ready && !success && !linkError && (
          <p className="text-amber-400 text-sm text-center bg-amber-400/10 rounded-xl py-3 px-3">
            Verifying your reset link…
          </p>
        )}
        {!ready && !success && linkError && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl py-3 px-3">
            This reset link is invalid or expired. Go back to{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="underline text-red-300 hover:text-white"
            >
              sign in
            </button>{' '}
            and request a new one.
          </p>
        )}

        {/* New Password */}
        <div className="flex flex-col gap-2">
          <label className="text-neutral-300 text-base font-medium" htmlFor="password">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={!ready}
              className="w-full rounded-2xl px-5 py-4 pr-14 bg-neutral-800/40 text-white text-base border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-500 disabled:opacity-40"
              style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {showPw ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-2">
          <label className="text-neutral-300 text-base font-medium" htmlFor="confirm">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={!ready}
              className="w-full rounded-2xl px-5 py-4 pr-14 bg-neutral-800/40 text-white text-base border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-500 disabled:opacity-40"
              style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {showPw ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl py-2 px-3">
            {error}
          </p>
        )}

        {/* Success */}
        {success && (
          <p className="text-emerald-400 text-sm text-center bg-emerald-400/10 rounded-xl py-2 px-3">
            {success}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !ready}
          className="mt-2 rounded-2xl py-4 text-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Back to sign in
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
