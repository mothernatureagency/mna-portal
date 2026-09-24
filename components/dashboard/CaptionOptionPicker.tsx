'use client';

import { useState } from 'react';
import { parseCaptionOptions } from '@/lib/caption-options';

/**
 * One-tap chooser for draft captions that still contain the AI's
 * "OPTION A / OPTION B" copy. Renders each option as a card with a
 * "Use this one" button; picking calls onPick with just that option's text,
 * which the caller saves as the final caption. Posts with unpicked options
 * are blocked from publishing, so this is the fastest way to unblock them.
 *
 * Renders null when the caption doesn't actually contain two options —
 * callers can use it as the sole gate: picker first, plain text fallback.
 */
export default function CaptionOptionPicker({
  caption,
  onPick,
  compact = false,
}: {
  caption: string;
  onPick: (finalCaption: string) => Promise<void> | void;
  /** Tighter paddings/text for list cards vs detail panels. */
  compact?: boolean;
}) {
  const options = parseCaptionOptions(caption);
  const [saving, setSaving] = useState<string | null>(null);
  if (!options) return null;

  async function pick(label: string, text: string) {
    setSaving(label);
    try {
      await onPick(text);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-amber-300`}
        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: compact ? 13 : 15 }}>alt_route</span>
        Two caption drafts — tap the one you like and it becomes the final caption. It won&apos;t post until one is picked.
      </div>
      {options.map((opt) => (
        <div
          key={opt.label}
          className={`rounded-xl ${compact ? 'p-2.5' : 'p-3'}`}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white/60">
              Option {opt.label}
            </span>
            <button
              onClick={() => pick(opt.label, opt.text)}
              disabled={saving !== null}
              className={`inline-flex items-center gap-1 ${compact ? 'text-[10px] px-2 py-1' : 'text-[11px] px-2.5 py-1.5'} font-bold rounded-lg text-white transition-opacity disabled:opacity-50`}
              style={{ background: 'rgba(16,185,129,0.35)', border: '1px solid rgba(16,185,129,0.5)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: compact ? 12 : 14 }}>
                {saving === opt.label ? 'progress_activity' : 'check'}
              </span>
              {saving === opt.label ? 'Saving…' : `Use Option ${opt.label}`}
            </button>
          </div>
          <div className={`${compact ? 'text-[11px]' : 'text-[12px]'} text-white/75 whitespace-pre-wrap leading-relaxed`}>
            {opt.text}
          </div>
        </div>
      ))}
    </div>
  );
}
