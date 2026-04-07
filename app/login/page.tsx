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
        className="bg-neutral-900 rounded-3xl px-12 py-14 flex flex-col gap-6 w-full max-w-md shadow-2xl"
      >
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            M
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight">
            Mother Nature Agency
          </h1>
          <p className="text-neutral-500 text-base">Sign in to your portal</p>
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

        {/* Password */}
        <div className="flex flex-col gap-2">
          <label className="text-neutral-300 text-base font-medium" htmlFor="password">
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
            className="rounded-2xl px-5 py-4 bg-neutral-800/40 text-white text-base border border-neutral-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-neutral-500"
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
          className="mt-2 rounded-2xl py-4 text-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
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
