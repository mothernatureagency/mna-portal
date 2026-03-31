'use client';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

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
        className="bg-neutral-900 rounded-2xl p-10 flex flex-col gap-4 w-full max-w-sm shadow-2xl"
      >
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-extrabold"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            M
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            Mother Nature Agency
          </h1>
          <p className="text-neutral-500 text-sm">Sign in to your portal</p>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className="text-neutral-400 text-xs font-medium" htmlFor="email">
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
            className="rounded-xl px-4 py-3 bg-neutral-800 text-white text-sm border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-600"
            style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <label className="text-neutral-400 text-xs font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="rounded-xl px-4 py-3 bg-neutral-800 text-white text-sm border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-600"
            style={{ '--tw-ring-color': '#0c6da4' } as React.CSSProperties}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl py-2 px-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
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
