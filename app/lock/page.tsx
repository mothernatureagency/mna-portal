'use client';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LockInner() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const next = searchParams.get('next') ?? '/';
      router.push(next);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Invalid credentials.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 rounded-2xl p-10 flex flex-col gap-4 w-full max-w-sm shadow-2xl"
      >
        <h1 className="text-white text-2xl font-semibold text-center">
          Mother Nature Agency
        </h1>
        <p className="text-neutral-400 text-sm text-center">
          Sign in to your portal.
        </p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          autoComplete="username"
          className="rounded-lg px-4 py-3 bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete="current-password"
          className="rounded-lg px-4 py-3 bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}

export default function LockPage() {
  return (
    <Suspense>
      <LockInner />
    </Suspense>
  );
}
