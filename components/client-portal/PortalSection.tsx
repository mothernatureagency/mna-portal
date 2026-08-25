'use client';

import { usePortalEdit } from './PortalEditContext';
import { ALL_SECTIONS } from '@/lib/portal-layout';

/**
 * Wraps one portal section.
 *
 * • Client view — renders the children, or nothing at all when the section
 *   has been un-shared for this client.
 * • Staff view — same, until "Edit portal" is on; then every section gains a
 *   control strip with a Shared/Hidden toggle, and hidden sections show up
 *   dimmed so they can be turned back on.
 */
export default function PortalSection({
  id,
  titleKey,
  defaultTitle,
  children,
}: {
  id: string;
  /** Set when the section's heading lives inside a child that can't host an inline editor. */
  titleKey?: string;
  defaultTitle?: string;
  children: React.ReactNode;
}) {
  const { editMode, sectionShared, toggleSection, title, setTitle } = usePortalEdit();
  const shared = sectionShared(id);

  if (!shared && !editMode) return null;
  if (!editMode) return <>{children}</>;

  const label = ALL_SECTIONS.find((s) => s.id === id)?.label || id;

  return (
    <div
      className="relative rounded-2xl"
      style={{
        outline: shared ? '1px dashed rgba(255,255,255,.18)' : '1px dashed rgba(244,63,94,.45)',
        outlineOffset: 6,
      }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</span>
        <button
          type="button"
          onClick={() => toggleSection(id, !shared)}
          className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
            shared
              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {shared ? 'visibility' : 'visibility_off'}
          </span>
          {shared ? 'Shared' : 'Hidden'}
        </button>
        {titleKey && (
          <input
            value={title(titleKey, defaultTitle || '')}
            onChange={(e) => setTitle(titleKey, e.target.value)}
            placeholder="Section heading"
            className="text-[11px] font-semibold text-white bg-white/10 rounded-md px-2 py-0.5 outline-none border-b border-dashed border-white/35 focus:bg-white/20 focus:border-white/70"
          />
        )}
      </div>
      <div style={{ opacity: shared ? 1 : 0.4 }}>{children}</div>
    </div>
  );
}
