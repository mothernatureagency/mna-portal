'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Client } from '@/lib/clients';
import {
  ALL_SECTIONS,
  EMPTY_LAYOUT,
  PORTAL_CONTENT_KEY,
  PORTAL_LAYOUT_KEY,
  PORTAL_PAGES,
  isPageShared,
  isSectionShared,
  type PortalContent,
  type PortalLayout,
} from '@/lib/portal-layout';

/**
 * Portal edit mode.
 *
 * Staff (and owners) previewing a client portal get an "Edit portal" toggle.
 * While it's on they can retitle/edit every editable section, and flip any
 * page or section between shared and hidden for this specific client.
 * Everything persists per client to `client_kv` via /api/client-kv.
 *
 * Clients never see the chrome: `canEdit` is false for them, and hidden
 * pages/sections simply don't render.
 */

type Ctx = {
  client: Client;
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  layout: PortalLayout;
  content: PortalContent;
  saving: boolean;
  error: string | null;
  pageShared: (href: string) => boolean;
  sectionShared: (id: string) => boolean;
  togglePage: (href: string, shared: boolean) => void;
  toggleSection: (id: string, shared: boolean) => void;
  /** Master switch: pause the whole portal for this client. */
  paused: boolean;
  setPaused: (v: boolean) => void;
  /** Bulk share/hide every page (Overview stays locked on). */
  setAllPages: (shared: boolean) => void;
  setAllSections: (shared: boolean) => void;
  /** Merge a patch into portal_content and persist (debounced). */
  updateContent: (patch: Partial<PortalContent>) => void;
  /** Set one section heading. */
  setTitle: (sectionId: string, title: string) => void;
  /** Read a section heading with its default. */
  title: (sectionId: string, fallback: string) => string;
};

const PortalEditCtx = createContext<Ctx | null>(null);

async function saveKv(clientId: string, key: string, value: unknown) {
  const res = await fetch('/api/client-kv', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, key, value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Save failed (${res.status})`);
  }
}

export function PortalEditProvider({
  client,
  canEdit,
  initialLayout,
  initialContent,
  children,
}: {
  client: Client;
  canEdit: boolean;
  initialLayout: PortalLayout;
  initialContent: PortalContent;
  children: React.ReactNode;
}) {
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<PortalLayout>(initialLayout || EMPTY_LAYOUT);
  const [content, setContent] = useState<PortalContent>(initialContent || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(0);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (key: string, value: unknown) => {
      inflight.current += 1;
      setSaving(true);
      setError(null);
      try {
        await saveKv(client.id, key, value);
      } catch (e: any) {
        setError(e?.message || 'Save failed');
      } finally {
        inflight.current -= 1;
        if (inflight.current <= 0) setSaving(false);
      }
    },
    [client.id],
  );

  const writeLayout = useCallback(
    (next: PortalLayout) => {
      setLayout(next);
      void persist(PORTAL_LAYOUT_KEY, next);
    },
    [persist],
  );

  const togglePage = useCallback(
    (href: string, shared: boolean) => {
      writeLayout({ ...layout, pages: { ...layout.pages, [href]: shared } });
    },
    [layout, writeLayout],
  );

  const toggleSection = useCallback(
    (id: string, shared: boolean) => {
      writeLayout({ ...layout, sections: { ...layout.sections, [id]: shared } });
    },
    [layout, writeLayout],
  );

  const setPaused = useCallback(
    (v: boolean) => writeLayout({ ...layout, paused: v }),
    [layout, writeLayout],
  );

  const setAllPages = useCallback(
    (shared: boolean) => {
      const pages: Record<string, boolean> = {};
      for (const p of PORTAL_PAGES) if (!p.locked) pages[p.href] = shared;
      writeLayout({ ...layout, pages });
    },
    [layout, writeLayout],
  );

  const setAllSections = useCallback(
    (shared: boolean) => {
      const sections: Record<string, boolean> = {};
      for (const sec of ALL_SECTIONS) sections[sec.id] = shared;
      writeLayout({ ...layout, sections });
    },
    [layout, writeLayout],
  );

  // Content edits come from keystroke-level editors, so coalesce writes.
  const updateContent = useCallback(
    (patch: Partial<PortalContent>) => {
      setContent((prev) => {
        const next = { ...prev, ...patch };
        if (contentTimer.current) clearTimeout(contentTimer.current);
        contentTimer.current = setTimeout(() => void persist(PORTAL_CONTENT_KEY, next), 600);
        return next;
      });
    },
    [persist],
  );

  const setTitle = useCallback(
    (sectionId: string, value: string) => {
      setContent((prev) => {
        const titles = { ...(prev.titles || {}), [sectionId]: value };
        const next = { ...prev, titles };
        if (contentTimer.current) clearTimeout(contentTimer.current);
        contentTimer.current = setTimeout(() => void persist(PORTAL_CONTENT_KEY, next), 600);
        return next;
      });
    },
    [persist],
  );

  const value = useMemo<Ctx>(
    () => ({
      client,
      canEdit,
      editMode: canEdit && editMode,
      setEditMode,
      layout,
      content,
      saving,
      error,
      pageShared: (href: string) => isPageShared(layout, href),
      sectionShared: (id: string) => isSectionShared(layout, id),
      togglePage,
      toggleSection,
      paused: layout.paused === true,
      setPaused,
      setAllPages,
      setAllSections,
      updateContent,
      setTitle,
      title: (sectionId: string, fallback: string) => content.titles?.[sectionId] ?? fallback,
    }),
    [client, canEdit, editMode, layout, content, saving, error, togglePage, toggleSection, setPaused, setAllPages, setAllSections, updateContent, setTitle],
  );

  return <PortalEditCtx.Provider value={value}>{children}</PortalEditCtx.Provider>;
}

export function usePortalEdit() {
  const ctx = useContext(PortalEditCtx);
  if (!ctx) throw new Error('usePortalEdit must be used within PortalEditProvider');
  return ctx;
}
