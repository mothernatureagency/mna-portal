'use client';

/**
 * Last-resort boundary for errors thrown in the root layout itself
 * (ClientProvider / ConditionalLayout), which app/error.tsx cannot catch.
 * It replaces the whole document, so it ships its own <html>/<body> and
 * inline styles — globals.css is not guaranteed to be applied here.
 */

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0b1622',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '3px solid #f43f5e',
            borderRadius: 20,
            padding: 28,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
            The portal failed to start
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px' }}>
            The error below happened in the app shell, before any page rendered.
          </p>
          <pre
            style={{
              fontSize: 12,
              background: 'rgba(0,0,0,0.35)',
              padding: 14,
              borderRadius: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: '0 0 16px',
            }}
          >
            {error.message || String(error)}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
          <button
            onClick={reset}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              padding: '9px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
