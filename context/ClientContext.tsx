'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { clients as staticClients, makeCustomClient, Client } from '@/lib/clients';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

type ClientContextType = {
  activeClient: Client;
  setActiveClientId: (id: string) => void;
  allClients: Client[];
  userRole: string;
  userEmail: string;
  refreshClients: () => void;
};

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientIdState] = useState('mna');
  const [hydrated, setHydrated] = useState(false);
  const [userRole, setUserRole] = useState('staff');
  const [userEmail, setUserEmail] = useState('');
  const [accessibleClientIds, setAccessibleClientIds] = useState<string[] | null>(null);
  const [customClients, setCustomClients] = useState<Client[]>([]);

  // Load dynamically-added Prime IV clients and merge them with the built-ins.
  //
  // This used to fail silently: a request that raced session refresh got the
  // login page's HTML, JSON.parse threw, and the catch swallowed it — leaving
  // the switcher showing only the built-in clients with no way back except a
  // reload. Retry a few times with backoff so a transient miss self-corrects.
  function loadCustomClients(attempt = 0) {
    fetch('/api/clients')
      .then((r) => { if (!r.ok) throw new Error(`clients fetch failed (${r.status})`); return r.json(); })
      .then((d) => {
        const rows = (d.items || []) as Array<{ id: string; name: string; short_name?: string; location?: string; logo_url?: string; industry?: string; brand_from?: string; brand_to?: string; notes?: string }>;
        setCustomClients(rows.map((r) => makeCustomClient({ id: r.id, name: r.name, shortName: r.short_name, location: r.location, logoUrl: r.logo_url, industry: r.industry, brandFrom: r.brand_from, brandTo: r.brand_to, notes: r.notes })));
      })
      .catch(() => {
        if (attempt < 3) setTimeout(() => loadCustomClients(attempt + 1), 600 * (attempt + 1));
      });
  }
  useEffect(() => { loadCustomClients(); }, []);

  // The provider also mounts on /login (it wraps the whole app), where the
  // custom-clients fetch and the user lookup run logged-out and fail. Login
  // navigates client-side, so nothing remounts — re-run both when the auth
  // state flips to signed-in so the full client list appears without a reload.
  useEffect(() => {
    const supabase = createSupabaseClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED / INITIAL_SESSION matter too — a returning user with a
      // stale cookie never fires SIGNED_IN, so without these the first failed
      // fetch would never be retried.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        loadCustomClients();
        loadUser();
      }
    });
    return () => sub.subscription.unsubscribe();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Built-in + custom, de-duped by id.
  const clients = useMemo(() => {
    const seen = new Set(staticClients.map((c) => c.id));
    return [...staticClients, ...customClients.filter((c) => !seen.has(c.id))];
  }, [customClients]);

  // Load user metadata and saved client (on mount, and again after sign-in)
  function loadUser() {
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
      // Accept any saved id; it resolves against the merged (built-in +
      // custom) list once custom clients finish loading.
      if (saved) setActiveClientIdState(saved);
      setHydrated(true);
    }).catch(() => {
      // Fallback if not authenticated
      const saved = localStorage.getItem('mna_active_client');
      // Accept any saved id; it resolves against the merged (built-in +
      // custom) list once custom clients finish loading.
      if (saved) setActiveClientIdState(saved);
      setHydrated(true);
    });
  }
  useEffect(() => { loadUser(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
    <ClientContext.Provider value={{ activeClient, setActiveClientId, allClients, userRole, userEmail, refreshClients: loadCustomClients }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClient must be used within ClientProvider');
  return ctx;
}
