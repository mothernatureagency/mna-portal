'use client';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [showPw, setShowPw] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Check your email for a password reset link.');
      }
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Refresh the page so middleware can detect the new session
    const next = searchParams.get('next') ?? '/';
    router.push(next);
    router.refresh();
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
            Mother Nature Agency
          </h1>
          <p className="text-neutral-500 text-base">
            {mode === 'login' ? 'Sign in to your portal' : 'Reset your password'}
          </p>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-2">
          <label className="text-neutral-300 text-base font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="rounded-2xl px-5 py-4 bg-neutral-800/40 text-white text-base border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-500"
            style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
          />
        </div>

        {/* Password (login only) */}
        {mode === 'login' && (
          <div className="flex flex-col gap-2">
            <label className="text-neutral-300 text-base font-medium" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-2xl px-5 py-4 pr-14 bg-neutral-800/40 text-white text-base border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-500"
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
        )}

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
          disabled={loading}
          className="mt-2 rounded-2xl py-4 text-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {loading
            ? mode === 'login' ? 'Signing in...' : 'Sending...'
            : mode === 'login' ? 'Sign In' : 'Send Reset Link'}
        </button>

        {/* Toggle forgot / back to login */}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); setSuccess(''); }}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
