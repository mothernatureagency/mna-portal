'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clients, Client } from '@/lib/clients';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

type ClientContextType = {
  activeClient: Client;
  setActiveClientId: (id: string) => void;
  allClients: Client[];
  userRole: string;
  userEmail: string;
};

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientIdState] = useState('mna');
  const [hydrated, setHydrated] = useState(false);
  const [userRole, setUserRole] = useState('staff');
  const [userEmail, setUserEmail] = useState('');
  const [accessibleClientIds, setAccessibleClientIds] = useState<string[] | null>(null);

  // Load user metadata and saved client on mount
  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const role = (meta.role as string) || 'staff';
        setUserRole(role);
        setUserEmail(user.email || '');

        // For owner accounts, restrict to their assigned clients
        if (role === 'owner') {
          const ids: string[] = [];
          const clientIdsRaw = meta.client_ids as string | undefined;
          if (clientIdsRaw) {
            ids.push(...clientIdsRaw.split(',').map((s) => s.trim()).filter(Boolean));
          }
          const singleId = meta.client_id as string | undefined;
          if (singleId && !ids.includes(singleId)) {
            ids.push(singleId);
          }
          if (ids.length > 0) {
            setAccessibleClientIds(ids);
            // Default to the first accessible client if current selection isn't accessible
            const saved = localStorage.getItem('mna_active_client');
            if (saved && ids.includes(saved)) {
              setActiveClientIdState(saved);
            } else {
              setActiveClientIdState(ids[0]);
              localStorage.setItem('mna_active_client', ids[0]);
            }
            setHydrated(true);
            return;
          }
        }
      }

      // For staff/admin — load saved from localStorage, show all clients
      const saved = localStorage.getItem('mna_active_client');
      if (saved && clients.some((c) => c.id === saved)) {
        setActiveClientIdState(saved);
      }
      setHydrated(true);
    }).catch(() => {
      // Fallback if not authenticated
      const saved = localStorage.getItem('mna_active_client');
      if (saved && clients.some((c) => c.id === saved)) {
        setActiveClientIdState(saved);
      }
      setHydrated(true);
    });
  }, []);

  // Persist to localStorage on change
  function setActiveClientId(id: string) {
    setActiveClientIdState(id);
    localStorage.setItem('mna_active_client', id);
  }

  const activeClient = clients.find(c => c.id === activeClientId) ?? clients[0];

  // Filter clients for owner accounts
  const allClients = accessibleClientIds
    ? clients.filter((c) => accessibleClientIds.includes(c.id))
    : clients;

  // Don't render until hydrated to avoid flash of wrong client
  if (!hydrated) return null;

  return (
    <ClientContext.Provider value={{ activeClient, setActiveClientId, allClients, userRole, userEmail }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}
