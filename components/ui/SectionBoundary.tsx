'use client';

/**
 * SectionBoundary — a React error boundary sized for one dashboard card.
 *
 * Without this, a single unguarded field access anywhere in the dashboard
 * tree (a null `post_date`, an API returning an error object instead of the
 * expected shape, a bad saved timezone) throws during render and Next.js
 * replaces the ENTIRE page with "Application error: a client-side exception
 * has occurred". That message names neither the component nor the error, so
 * there is nothing to act on.
 *
 * Wrapping each section means a broken card degrades to an inline notice
 * showing the actual error message, and the rest of the dashboard keeps
 * working. Error `message` survives the production build (only React's own
 * invariant text is minified), so the notice is genuinely diagnostic.
 */

import React from 'react';

type Props = {
  /** Shown in the fallback so you know which card failed. */
  name: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

export default class SectionBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the full stack in the console for anyone debugging in prod.
    console.error(`[SectionBoundary] ${this.props.name} failed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="glass-card p-5" style={{ borderLeft: '3px solid #f43f5e' }}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-rose-400" style={{ fontSize: 18 }}>
            error
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-white">
              {this.props.name} couldn&apos;t load
            </div>
            <div className="text-[11px] text-white/60 mt-1">
              The rest of the dashboard is fine — only this section failed.
            </div>
            <pre className="mt-2 text-[10px] text-rose-200/80 whitespace-pre-wrap break-words font-mono">
              {error.message || String(error)}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
            >
              Retry this section
            </button>
          </div>
        </div>
      </div>
    );
  }
}
