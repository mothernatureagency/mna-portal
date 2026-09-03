'use client';

/**
 * Brand Kits — the type, colour and rules the Graphic Lab designs to.
 *
 * A kit belongs to one client or to a group of them. The franchise shape is
 * the reason: every Prime IV location shares the same wordmark, navy and gold,
 * and headline face, and differs only in a phone number or a photo of that
 * clinic. So a location's own kit stores just what it overrides, and the two
 * merge field by field — inherited values show as "from the group kit" until
 * you type over them.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import type { BrandKit, BrandKitFields, BrandFont, BrandColor, BrandLogo } from '@/lib/brand-kit';

type Scope = 'group' | 'client';
type Target = { scope: Scope; ownerKey: string; label: string };

type Resolved = {
  fields: BrandKitFields;
  groupKey: string | null;
  sources: Partial<Record<keyof BrandKitFields, 'group' | 'client'>>;
};

const EMPTY: BrandKitFields = {};

// Stored when a client is deliberately in no group, so it can be told apart
// from never having chosen (which falls back to what the id implies).
const NO_GROUP = '__no_group__';

function blankFont(): BrandFont {
  return { source: 'google', family: '', weights: '400;700', fallback: 'system-ui, sans-serif' };
}

export default function BrandKitsPage() {
  const { activeClient, allClients } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const [kits, setKits] = useState<BrandKit[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState<BrandKitFields>(EMPTY);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  // The group this client kit inherits from. '' means "work it out from the id".
  const [groupChoice, setGroupChoice] = useState<string>('');
  const [newGroup, setNewGroup] = useState('');

  // Groups worth offering: whatever kits already exist, plus the ones the
  // client ids imply. Prime IV is the live example; more can be typed in.
  const groups = useMemo(() => {
    const found = new Set<string>();
    allClients.forEach((c) => {
      if (c.id === 'prime-iv' || c.id.startsWith('prime-iv-')) found.add('prime-iv');
    });
    kits.filter((k) => k.scope === 'group').forEach((k) => found.add(k.owner_key));
    return Array.from(found).sort();
  }, [allClients, kits]);

  const loadKits = useCallback(() => {
    fetch('/api/brand-kits')
      .then((r) => r.json())
      .then((d) => setKits(d.kits || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadKits(); }, [loadKits]);

  // Default to the active client's own kit so the page opens on something useful.
  useEffect(() => {
    if (target) return;
    setTarget({ scope: 'client', ownerKey: activeClient.id, label: activeClient.shortName });
  }, [activeClient.id, activeClient.shortName, target]);

  // Load whichever kit is selected, plus what it inherits.
  useEffect(() => {
    if (!target) return;
    setMsg('');
    setError('');
    if (target.scope === 'group') {
      const existing = kits.find((k) => k.scope === 'group' && k.owner_key === target.ownerKey);
      setDraft(existing?.fields || EMPTY);
      setResolved(null);
      return;
    }
    fetch(`/api/brand-kits?clientId=${encodeURIComponent(target.ownerKey)}`)
      .then((r) => r.json())
      .then((d) => {
        setDraft(d.clientKit?.fields || EMPTY);
        setResolved(d.resolved || null);
        setGroupChoice(d.clientKit?.group_key === NO_GROUP ? NO_GROUP : (d.clientKit?.group_key || ''));
      })
      .catch(() => setError('Could not load that kit'));
  }, [target, kits]);

  async function save() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/brand-kits', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: target.scope,
          ownerKey: target.ownerKey,
          name: target.label,
          fields: draft,
          ...(target.scope === 'client' ? { groupKey: groupChoice || null } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Save failed'); return; }
      setMsg('Saved');
      setTimeout(() => setMsg(''), 2000);
      loadKits();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally { setBusy(false); }
  }

  async function clearKit() {
    if (!target) return;
    if (!confirm(`Delete the ${target.label} kit? Anything it overrides falls back to the group kit.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/brand-kits?scope=${target.scope}&ownerKey=${encodeURIComponent(target.ownerKey)}`, { method: 'DELETE' });
      setDraft(EMPTY);
      loadKits();
      setMsg('Deleted');
      setTimeout(() => setMsg(''), 2000);
    } finally { setBusy(false); }
  }

  const inputStyle = { background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' };
  const isGroup = target?.scope === 'group';

  /** What this field falls back to when the client leaves it blank. */
  function inherited<K extends keyof BrandKitFields>(key: K): NonNullable<BrandKitFields[K]> | null {
    if (isGroup || !resolved) return null;
    if (resolved.sources[key] !== 'group') return null;
    return (resolved.fields[key] ?? null) as NonNullable<BrandKitFields[K]> | null;
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-white/80" style={{ fontSize: 24 }}>style</span>
          <h1 className="text-[24px] font-extrabold text-white">Brand Kits</h1>
        </div>
        <p className="text-[12px] text-white/55 mt-1">
          Type, colour and rules the Graphic Lab designs to · a kit can cover one client or a whole group
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[12px] text-rose-200 flex items-start gap-2"
             style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-rose-200/60 hover:text-rose-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        {/* Picker */}
        <div className="glass-card p-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1.5">Groups</div>
            {groups.length === 0 && <div className="text-[11px] text-white/35">No groups yet.</div>}
            <div className="space-y-1">
              {groups.map((g) => {
                const has = kits.some((k) => k.scope === 'group' && k.owner_key === g);
                const on = target?.scope === 'group' && target.ownerKey === g;
                return (
                  <button
                    key={g}
                    onClick={() => setTarget({ scope: 'group', ownerKey: g, label: g })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 ${on ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>workspaces</span>
                    <span className="flex-1 truncate">{g}</span>
                    {has && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has a kit" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 mt-2">
              <input
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const key = newGroup.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                  if (!key) return;
                  setTarget({ scope: 'group', ownerKey: key, label: key });
                  setNewGroup('');
                }}
                placeholder="+ New group, then Enter"
                className="flex-1 px-2 py-1.5 rounded-lg border text-white text-[11px] placeholder:text-white/30 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' }}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1.5">Clients</div>
            <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
              {allClients.map((c) => {
                const has = kits.some((k) => k.scope === 'client' && k.owner_key === c.id);
                const on = target?.scope === 'client' && target.ownerKey === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setTarget({ scope: 'client', ownerKey: c.id, label: c.shortName })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 ${on ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                  >
                    <span className="flex-1 truncate">{c.shortName}</span>
                    {has && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has its own overrides" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="glass-card p-5 space-y-4">
          {loading || !target ? (
            <div className="text-[12px] text-white/55 py-10 text-center">Loading kits…</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="material-symbols-outlined text-white/70" style={{ fontSize: 18 }}>
                  {isGroup ? 'workspaces' : 'storefront'}
                </span>
                <h2 className="text-[16px] font-extrabold text-white">{target.label}</h2>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                  {isGroup ? 'group kit' : 'client kit'}
                </span>
                <div className="flex-1" />
                {msg && <span className="text-[11px] text-emerald-300">{msg}</span>}
              </div>

              {!isGroup && (
                <div className="rounded-lg px-3 py-2.5 space-y-2"
                     style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: gradientTo }}>account_tree</span>
                    <span className="text-[11px] font-bold text-white/70">Inherits from</span>
                    <select
                      value={groupChoice}
                      onChange={(e) => setGroupChoice(e.target.value)}
                      className="px-2 py-1 rounded-lg border text-white text-[11px] focus:outline-none"
                      style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                    >
                      <option value="" className="bg-slate-900">
                        Work it out from the client id{resolved?.groupKey ? ` (${resolved.groupKey})` : ' (no group)'}
                      </option>
                      {groups.map((g) => (
                        <option key={g} value={g} className="bg-slate-900">{g} group kit</option>
                      ))}
                      <option value={NO_GROUP} className="bg-slate-900">Nothing — this client stands alone</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    {resolved?.groupKey
                      ? <>Leave a field blank to keep the <b className="text-white/70">{resolved.groupKey}</b> version; fill it in to override just that one. Saving applies the choice above.</>
                      : <>Not in a group, so every field here is this client&apos;s own.</>}
                  </p>
                </div>
              )}

              <FontField
                label="Headline font"
                value={draft.headlineFont}
                inherited={inherited('headlineFont')}
                onChange={(f) => setDraft({ ...draft, headlineFont: f })}
                onError={setError}
              />
              <FontField
                label="Body font"
                value={draft.bodyFont}
                inherited={inherited('bodyFont')}
                onChange={(f) => setDraft({ ...draft, bodyFont: f })}
                onError={setError}
              />

              <PaletteField
                value={draft.palette}
                inherited={inherited('palette')}
                onChange={(p) => setDraft({ ...draft, palette: p })}
              />

              <LogoField
                value={draft.logos}
                inherited={inherited('logos')}
                onChange={(l) => setDraft({ ...draft, logos: l })}
                onError={setError}
              />

              <TextField
                label="Brand rules"
                hint="One per line. These become hard constraints on every graphic — “never put type over the logo”, “prices always in gold”."
                rows={5}
                value={draft.rules}
                inherited={inherited('rules') as string | null}
                onChange={(v) => setDraft({ ...draft, rules: v })}
                style={inputStyle}
              />
              <TextField
                label="Voice"
                hint="How copy on the artwork should sound."
                rows={2}
                value={draft.voice}
                inherited={inherited('voice') as string | null}
                onChange={(v) => setDraft({ ...draft, voice: v })}
                style={inputStyle}
              />
              <TextField
                label="Imagery direction"
                hint="Photography and illustration style."
                rows={2}
                value={draft.imagery}
                inherited={inherited('imagery') as string | null}
                onChange={(v) => setDraft({ ...draft, imagery: v })}
                style={inputStyle}
              />

              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={save}
                  disabled={busy}
                  className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                >
                  {busy ? 'Saving…' : 'Save kit'}
                </button>
                <button
                  onClick={clearKit}
                  disabled={busy}
                  className="text-[11px] text-white/45 hover:text-rose-300 px-2 disabled:opacity-50"
                >
                  Delete this kit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Field components ──────────────────────────────────────────────────────

function InheritNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>account_tree</span>
      {children}
    </div>
  );
}

function TextField({ label, hint, rows, value, inherited, onChange, style }: {
  label: string; hint?: string; rows: number;
  value?: string; inherited: string | null;
  onChange: (v: string) => void; style: React.CSSProperties;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">{label}</div>
      <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={inherited ? `Inherited: ${inherited.slice(0, 80)}${inherited.length > 80 ? '…' : ''}` : hint}
        className="w-full px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/30 focus:outline-none"
        style={style}
      />
      {inherited && <InheritNote>Using the group&apos;s version until you type here</InheritNote>}
      {!inherited && hint && <div className="text-[10px] text-white/35 mt-1">{hint}</div>}
    </div>
  );
}

function FontField({ label, value, inherited, onChange, onError }: {
  label: string; value?: BrandFont; inherited: BrandFont | null;
  onChange: (f: BrandFont | undefined) => void; onError: (e: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const f = value;
  const inputStyle = { background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' };

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/brand-kits/font', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok || !d.url) { onError(d.error || 'Font upload failed'); return; }
      onChange({ source: 'upload', family: d.family || 'Custom', url: d.url, weights: '400', fallback: 'system-ui, sans-serif' });
    } catch (e: any) {
      onError(e?.message || 'Font upload failed');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-white/45">{label}</span>
        {f && (
          <button onClick={() => onChange(undefined)} className="text-[10px] text-white/35 hover:text-white/70">
            clear
          </button>
        )}
      </div>

      {!f ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onChange(blankFont())}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white"
          >
            Set a Google Font
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-50"
          >
            {busy ? 'Uploading…' : 'Upload a font file'}
          </button>
          {inherited && <InheritNote>Using {inherited.family} from the group kit</InheritNote>}
        </div>
      ) : (
        <div className="space-y-2 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex gap-2">
            <select
              value={f.source}
              onChange={(e) => onChange({ ...f, source: e.target.value as BrandFont['source'] })}
              className="px-2 py-1.5 rounded-lg border text-white text-[11px] focus:outline-none"
              style={inputStyle}
            >
              <option value="google" className="bg-slate-900">Google Font</option>
              <option value="upload" className="bg-slate-900">Uploaded file</option>
              <option value="stack" className="bg-slate-900">System stack</option>
            </select>
            <input
              type="text"
              value={f.family}
              onChange={(e) => onChange({ ...f, family: e.target.value })}
              placeholder="Family name, e.g. Bebas Neue"
              className="flex-1 px-3 py-1.5 rounded-lg border text-white text-[12px] placeholder:text-white/30 focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={f.weights || ''}
              onChange={(e) => onChange({ ...f, weights: e.target.value })}
              placeholder="Weights, e.g. 400;700"
              className="w-36 px-3 py-1.5 rounded-lg border text-white text-[11px] placeholder:text-white/30 focus:outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              value={f.fallback || ''}
              onChange={(e) => onChange({ ...f, fallback: e.target.value })}
              placeholder="Fallback stack, e.g. Impact, system-ui, sans-serif"
              className="flex-1 px-3 py-1.5 rounded-lg border text-white text-[11px] placeholder:text-white/30 focus:outline-none"
              style={inputStyle}
            />
          </div>
          {f.source === 'upload' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
              >
                {busy ? 'Uploading…' : f.url ? 'Replace file' : 'Choose file'}
              </button>
              {f.url && <span className="text-[10px] text-white/40 truncate flex-1">{f.url.split('/').pop()}</span>}
            </div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }}
      />
    </div>
  );
}

function PaletteField({ value, inherited, onChange }: {
  value?: BrandColor[]; inherited: BrandColor[] | null; onChange: (p: BrandColor[]) => void;
}) {
  const list = value || [];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Palette</div>
      <div className="space-y-1.5">
        {list.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#000000'}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
              className="w-9 h-8 rounded cursor-pointer bg-transparent border border-white/20"
            />
            <input
              type="text"
              value={c.hex}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
              className="w-24 px-2 py-1.5 rounded-lg border text-white text-[11px] font-mono focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <input
              type="text"
              value={c.label}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              placeholder="What it's for — e.g. headline navy, price gold"
              className="flex-1 px-3 py-1.5 rounded-lg border text-white text-[11px] placeholder:text-white/30 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-white/35 hover:text-rose-300 px-1">✕</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...list, { hex: '#1c3d6e', label: '' }])}
        className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white"
      >
        + Add colour
      </button>
      {inherited && list.length === 0 && (
        <InheritNote>Using the group&apos;s {inherited.length}-colour palette</InheritNote>
      )}
    </div>
  );
}

function LogoField({ value, inherited, onChange, onError }: {
  value?: BrandLogo[]; inherited: BrandLogo[] | null;
  onChange: (l: BrandLogo[]) => void; onError: (e: string) => void;
}) {
  const list = value || [];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/content-calendar/upload', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok || !d.url) { onError(d.error || 'Logo upload failed'); return; }
      onChange([...list, { label: file.name.replace(/\.[^.]+$/, ''), url: d.url }]);
    } catch (e: any) {
      onError(e?.message || 'Logo upload failed');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-white/45 mb-1">Logos</div>
      <div className="space-y-1.5">
        {list.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.url} alt={l.label} className="w-10 h-10 object-contain rounded bg-white/10 border border-white/15" />
            <input
              type="text"
              value={l.label}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              placeholder="When to use it — e.g. white version, for dark backgrounds"
              className="flex-1 px-3 py-1.5 rounded-lg border text-white text-[11px] placeholder:text-white/30 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-white/35 hover:text-rose-300 px-1">✕</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:text-white disabled:opacity-50"
      >
        {busy ? 'Uploading…' : '+ Upload a logo'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }}
      />
      {inherited && list.length === 0 && (
        <InheritNote>Using the group&apos;s {inherited.length} logo file(s)</InheritNote>
      )}
    </div>
  );
}
