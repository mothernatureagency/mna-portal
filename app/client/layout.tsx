import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { clients } from '@/lib/clients';
import ClientPortalShell from '@/components/client-portal/ClientPortalShell';

export const dynamic = 'force-dynamic';

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

  return (
    <ClientPortalShell
      client={activeClient}
      userEmail={user.email || ''}
      isStaffPreview={isStaff || isOwner}
      accessibleClients={clientList}
    >
      {children}
    </ClientPortalShell>
  );
}
