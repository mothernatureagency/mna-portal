'use client';

/**
 * LeadSourceSplitEditor
 *
 * MNA staff-facing inline editor for the "we don't have a lead source API yet"
 * gap. Pulls saved splits from /api/client-kv (key = "lead_source_split") and
 * lets staff type in their best-guess percentages + a notes field.
 *
 * Persists in the client_kv table, so changes show up on every device without
 * a git commit. Clients see the rendered splits but cannot edit (PUT is
 * staff-only, enforced in the API route).
 */

import { useEffect, useState } from 'react';

export type LeadSourceSplit = {
  fb: number;
  google: number;
  walkin: number;
  referral: number;
  notes?: string;
  updatedAt?: string;
};

const CATEGORIES: { key: keyof Pick<LeadSourceSplit, 'fb' | 'google' | 'walkin' | 'referral'>; label: string; sub: string }[] = [
  { key: 'fb',       label: 'Facebook / Instagram', sub: 'Paid · MNA + PDM' },
  { key: 'google',   label: 'Google',               sub: 'Organic only (no paid)' },
  { key: 'walkin',   label: 'Walk-in',              sub: 'In-person traffic' },
  { key: 'referral', label: 'Referral',             sub: 'Word of mouth + member' },
];

export default function LeadSourceSplitEditor({
  clientId,
  gradientFrom,
  gradientTo,
}: {
  clientId: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  const [split, setSplit] = useState<LeadSourceSplit | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LeadSourceSplit>({ fb: 0, google: 0, walkin: 0, referral: 0, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/client-kv?clientId=${encodeURIComponent(clientId)}&key=lead_source_split`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.value) {
          setSplit({ ...d.value, updatedAt: d.updatedAt });
          setDraft({ ...d.value });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  const draftTotal = draft.fb + draft.google + draft.walkin + draft.referral;
  const canSave = draftTotal === 100;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/client-kv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          key: 'lead_source_split',
          value: {
            fb: draft.fb,
            google: draft.google,
            walkin: draft.walkin,
            referral: draft.referral,
            notes: draft.notes || '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSplit({ ...draft, updatedAt: data.updatedAt });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[15px] font-bold text-white">Lead source split</div>
          <div className="text-[11px] text-white/70 mt-0.5">
            {split
              ? `Manual estimate · updated ${new Date(split.updatedAt || '').toLocaleDateString()}`
              : 'No manual estimate set yet'}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            {split ? 'Edit' : 'Set split'}
          </button>
        )}
      </div>

      {loading && <div className="text-white/50 text-sm py-4">Loading…</div>}

      {/* View mode */}
      {!loading && !editing && (
        <>
          {split ? (
            <div className="space-y-3">
              {CATEGORIES.map((c) => {
                const pct = split[c.key];
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-[13px] font-bold text-white">{c.label}</span>
                        <span className="text-[10px] text-white/70 ml-2">· {c.sub}</span>
                      </div>
                      <div className="text-[14px] font-bold text-white tabular-nums">{pct}%</div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                      />
                    </div>
                  </div>
                );
              })}
              {split.notes && (
                <div className="pt-3 border-t border-white/10 text-[11px] text-white/70 italic leading-relaxed">
                  {split.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[13px] font-bold text-white">{c.label}</div>
                  <div className="text-[10px] text-white/70 mt-0.5">{c.sub}</div>
                  <div className="text-[11px] font-mono text-white/50 mt-2">—</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit mode */}
      {!loading && editing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[12px] font-bold text-white">{c.label}</div>
                <div className="text-[9px] text-white/70 mb-2">{c.sub}</div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft[c.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                    className="w-16 rounded-md border border-white/20 bg-white/10 text-white px-2 py-1 text-sm font-mono text-right"
                  />
                  <span className="text-[12px] text-white/70">%</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/70">Notes</label>
            <textarea
              value={draft.notes || ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
              placeholder="Context for this estimate, e.g. 'Based on first week of April DMs and walk-in log'"
              className="w-full mt-1 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/40 p-2 text-[12px]"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className={`text-[11px] font-semibold ${canSave ? 'text-emerald-600' : 'text-rose-600'}`}>
              Total: {draftTotal}% {canSave ? '✓' : '(must equal 100)'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setError(null); if (split) setDraft({ ...split }); }}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!canSave || saving}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          {error && <div className="text-[11px] text-rose-600 font-semibold">{error}</div>}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-white/50 leading-relaxed">
        Saved splits display on the client portal dashboard too. Will auto-populate from Revive / HighLevel once the lead source API is wired.
      </div>
    </div>
  );
}
