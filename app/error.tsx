'use client';

/**
 * Route-level error boundary.
 *
 * Replaces Next.js's bare "Application error: a client-side exception has
 * occurred (see the browser console for more information)" screen — which
 * names neither the failing component nor the error — with the actual message,
 * the stack, and the build digest, plus a retry that re-renders the route
 * without a full reload.
 */

import React from 'react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div className="max-w-[900px] mx-auto py-10">
      <div className="glass-card p-7" style={{ borderLeft: '3px solid #f43f5e' }}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#be123c,#f43f5e)' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>
              error
            </span>
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-white">This page hit an error</h1>
            <p className="text-[12px] text-white/55">
              Everything else in the portal still works — use the sidebar to move on, or retry below.
            </p>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300 mb-1.5">
            Error
          </div>
          <pre className="text-[12px] text-white whitespace-pre-wrap break-words font-mono">
            {error.message || String(error)}
          </pre>
          {error.digest && (
            <div className="text-[10px] text-white/40 mt-2 font-mono">digest: {error.digest}</div>
          )}
        </div>

        {error.stack && (
          <details className="mb-4">
            <summary className="text-[11px] font-semibold text-white/60 hover:text-white cursor-pointer">
              Show stack trace
            </summary>
            <pre className="mt-2 text-[10px] text-white/50 whitespace-pre-wrap break-words font-mono max-h-72 overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="text-[13px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-[13px] font-semibold px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
