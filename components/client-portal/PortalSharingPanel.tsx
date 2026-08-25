'use client';

import { usePortalEdit } from './PortalEditContext';
import { PORTAL_PAGES } from '@/lib/portal-layout';

/**
 * One screen listing everything this client can be shown — every page, and
 * every section inside a page — each with its own switch, plus a master
 * pause that hides the whole portal in one click.
 */

function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-[22px] shrink-0 rounded-full transition-colors ${
        disabled ? 'cursor-not-allowed opacity-40' : ''
      }`}
      style={{ background: on ? 'rgba(16,185,129,.75)' : 'rgba(255,255,255,.18)' }}
    >
      <span
        className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? 21 : 3 }}
      />
    </button>
  );
}

export default function PortalSharingPanel({ onClose }: { onClose: () => void }) {
  const {
    client,
    pageShared,
    sectionShared,
    togglePage,
    toggleSection,
    paused,
    setPaused,
    setAllPages,
    setAllSections,
    saving,
    error,
  } = usePortalEdit();

  const sharedPages = PORTAL_PAGES.filter((p) => pageShared(p.href)).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 md:p-8" style={{ background: 'rgba(3,10,18,.72)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-[720px] rounded-2xl overflow-hidden my-auto"
        style={{ background: 'linear-gradient(180deg,#12263a,#0d1b2a)', border: '1px solid rgba(255,255,255,.12)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
          <div>
            <div className="text-[16px] font-extrabold text-white">Sharing &amp; access</div>
            <div className="text-[11.5px] text-white/55 mt-0.5">
              Choose what <span className="text-white/80 font-semibold">{client.name}</span> sees in their portal.
              {saving && <span className="text-amber-300 ml-1">Saving…</span>}
              {error && <span className="text-rose-300 ml-1">{error}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Master switch */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background: paused ? 'rgba(244,63,94,.12)' : 'rgba(16,185,129,.08)',
            borderBottom: '1px solid rgba(255,255,255,.09)',
          }}
        >
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                {paused ? 'pause_circle' : 'share' }
              </span>
              {paused ? 'Portal paused' : 'Portal is live'}
            </div>
            <div className="text-[11px] text-white/55 mt-0.5">
              {paused
                ? 'This client sees a short notice instead of their portal. Nothing was deleted — flip it back any time.'
                : 'One click stops sharing everything without changing any of the settings below.'}
            </div>
          </div>
          <button
            onClick={() => setPaused(!paused)}
            className={`shrink-0 text-[12px] font-bold px-3.5 py-2 rounded-xl transition-colors ${
              paused
                ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40'
                : 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/35'
            }`}
          >
            {paused ? 'Resume sharing' : 'Stop sharing'}
          </button>
        </div>

        {/* Pages + sections */}
        <div className="max-h-[52vh] overflow-y-auto px-5 py-4" style={{ opacity: paused ? 0.5 : 1 }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Pages · {sharedPages}/{PORTAL_PAGES.length} shared
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setAllPages(true)} className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-white/8 text-white/70 hover:bg-white/15 hover:text-white">
                Share all
              </button>
              <button onClick={() => setAllPages(false)} className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-white/8 text-white/70 hover:bg-white/15 hover:text-white">
                Hide all
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {PORTAL_PAGES.map((page) => {
              const on = pageShared(page.href);
              return (
                <div key={page.href} className="rounded-xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="material-symbols-outlined text-white/50" style={{ fontSize: 18 }}>{page.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
                        {page.label}
                        {page.locked && (
                          <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                            always on
                          </span>
                        )}
                      </div>
                      {page.sections.length > 0 && (
                        <div className="text-[10.5px] text-white/45">
                          {page.sections.filter((sec) => sectionShared(sec.id)).length}/{page.sections.length} sections shared
                        </div>
                      )}
                    </div>
                    <Switch on={on} disabled={page.locked} onChange={(v) => togglePage(page.href, v)} label={`Share ${page.label}`} />
                  </div>

                  {page.sections.length > 0 && (
                    <div className="px-3.5 pb-3 pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,.06)', opacity: on ? 1 : 0.45 }}>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[9.5px] font-bold uppercase tracking-widest text-white/35">Sections</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => setAllSections(true)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/8 text-white/60 hover:bg-white/15 hover:text-white">
                            All on
                          </button>
                          <button onClick={() => setAllSections(false)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/8 text-white/60 hover:bg-white/15 hover:text-white">
                            All off
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {page.sections.map((sec) => (
                          <div key={sec.id} className="flex items-center gap-3 py-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-semibold text-white/85 truncate">{sec.label}</div>
                              {sec.note && <div className="text-[10px] text-white/40 truncate">{sec.note}</div>}
                            </div>
                            <Switch
                              on={sectionShared(sec.id)}
                              onChange={(v) => toggleSection(sec.id, v)}
                              label={`Share ${sec.label}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,.09)' }}>
          <span className="text-[10.5px] text-white/40">Changes save automatically and apply to {client.shortName} only.</span>
          <button onClick={onClose} className="text-[12px] font-bold px-3.5 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
