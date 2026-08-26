'use client';

import { createContext, useContext } from 'react';
import type { Client } from '@/lib/clients';

type ClientPortalCtx = {
  client: Client;
  userEmail: string;
  isStaffPreview: boolean;
  /** Resolved server-side for the client actually being viewed. */
  metaAdAccountId?: string;
};

const Ctx = createContext<ClientPortalCtx | null>(null);

export function ClientPortalProvider({
  client,
  userEmail,
  isStaffPreview,
  metaAdAccountId,
  children,
}: ClientPortalCtx & { children: React.ReactNode }) {
  return (
    <Ctx.Provider value={{ client, userEmail, isStaffPreview, metaAdAccountId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClientPortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClientPortal must be used within ClientPortalProvider');
  return ctx;
}
