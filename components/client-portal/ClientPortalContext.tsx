'use client';

import { createContext, useContext } from 'react';
import type { Client } from '@/lib/clients';

type ClientPortalCtx = {
  client: Client;
  userEmail: string;
  isStaffPreview: boolean;
};

const Ctx = createContext<ClientPortalCtx | null>(null);

export function ClientPortalProvider({
  client,
  userEmail,
  isStaffPreview,
  children,
}: ClientPortalCtx & { children: React.ReactNode }) {
  return (
    <Ctx.Provider value={{ client, userEmail, isStaffPreview }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClientPortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClientPortal must be used within ClientPortalProvider');
  return ctx;
}
