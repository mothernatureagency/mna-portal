import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { clients as staticClients, makeCustomClient, type Client } from '@/lib/clients';
import { query } from '@/lib/db';
import ClientPortalShell from '@/components/client-portal/ClientPortalShell';
import {
  EMPTY_LAYOUT,
  PORTAL_CONTENT_KEY,
  PORTAL_LAYOUT_KEY,
  normalizeContent,
  normalizeLayout,
  type PortalContent,
  type PortalLayout,
} from '@/lib/portal-layout';

export const dynamic = 'force-dynamic';

// Static built-ins + custom clients (High Street, Holland, Vortex, …) from the
// DB, so the portal switcher and access resolution see every client.
async function getAllClients(): Promise<Client[]> {
  try {
    const { rows } = await query<any>(
      `select id, name, short_name, location, logo_url, industry, brand_from, brand_to, notes from custom_clients`,
    );
    const custom = rows.map((r) => makeCustomClient({
      id: r.id, name: r.name, shortName: r.short_name, location: r.location,
      logoUrl: r.logo_url, industry: r.industry, brandFrom: r.brand_from, brandTo: r.brand_to, notes: r.notes,
    }));
    const seen = new Set(staticClients.map((c) => c.id));
    return [...staticClients, ...custom.filter((c) => !seen.has(c.id))];
  } catch {
    return staticClients;
  }
}

/**
 * Per-client portal configuration: which pages/sections are shared, plus the
 * staff-authored content overrides. Loaded server-side so the sidebar renders
 * with the right nav on first paint (no flash of hidden pages).
 */
async function getPortalConfig(clientId: string): Promise<{ layout: PortalLayout; content: PortalContent }> {
  try {
    const { rows } = await query<{ key: string; value: unknown }>(
      `select key, value from client_kv where client_id = $1 and key = any($2::text[])`,
      [clientId, [PORTAL_LAYOUT_KEY, PORTAL_CONTENT_KEY]],
    );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      layout: normalizeLayout(byKey.get(PORTAL_LAYOUT_KEY)),
      content: normalizeContent(byKey.get(PORTAL_CONTENT_KEY)),
    };
  } catch {
    return { layout: EMPTY_LAYOUT, content: {} };
  }
}

/**
 * Client Portal layout.
 *
 * Supports single-client accounts (client_id) and multi-client accounts
 * (client_ids as comma-separated string, e.g. "prime-iv-pinecrest,serenity-bayfront").
 *
 * When a user has access to multiple clients, they can switch between them
 * via a dropdown in the sidebar. The active selection is stored in a cookie.
 */
export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/client');

  const clients = await getAllClients();

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';

  // Build the list of client IDs this user can access
  let accessibleIds: string[] = [];

  // Multi-client: comma-separated list in client_ids
  const clientIdsRaw = meta.client_ids as string | undefined;
  if (clientIdsRaw) {
    accessibleIds = clientIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Single client fallback
  const singleId = meta.client_id as string | undefined;
  if (singleId && !accessibleIds.includes(singleId)) {
    accessibleIds.push(singleId);
  }

  // Staff/admin can see all non-mna clients in client view
  const isStaff = role !== 'client' && role !== 'owner';
  const isOwner = role === 'owner';

  // If staff/admin with no specific client assignment, give access to all
  if (accessibleIds.length === 0) {
    if (isStaff) {
      accessibleIds = clients.filter((c) => c.id !== 'mna').map((c) => c.id);
    } else {
      // Client role with no assignment — fallback
      accessibleIds = ['prime-iv'];
    }
  }

  // Resolve which client to show — check cookie for saved selection
  const cookieStore = cookies();
  const savedClientId = cookieStore.get('mna_portal_client')?.value;
  const activeId = savedClientId && accessibleIds.includes(savedClientId)
    ? savedClientId
    : accessibleIds[0];

  const activeClient = clients.find((c) => c.id === activeId) || clients.find((c) => c.id === 'prime-iv')!;

  // Build accessible client objects
  const accessibleClients = accessibleIds
    .map((id) => clients.find((c) => c.id === id))
    .filter(Boolean) as typeof clients;

  // Staff sees all non-mna clients, owners/clients see only their assigned
  const clientList = isStaff ? clients.filter((c) => c.id !== 'mna') : accessibleClients;

  const { layout: portalLayout, content: portalContent } = await getPortalConfig(activeClient.id);

  return (
    <ClientPortalShell
      client={activeClient}
      userEmail={user.email || ''}
      isStaffPreview={isStaff || isOwner}
      accessibleClients={clientList}
      portalLayout={portalLayout}
      portalContent={portalContent}
    >
      {children}
    </ClientPortalShell>
  );
}
