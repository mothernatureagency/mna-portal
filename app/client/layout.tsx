import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { clients } from '@/lib/clients';
import ClientPortalShell from '@/components/client-portal/ClientPortalShell';

export const dynamic = 'force-dynamic';

/**
 * Client Portal layout.
 *
 * Wraps /client/* in a stripped-down shell (no MNA sidebar, no agents/AI nav).
 * Resolves the authenticated Supabase user, pulls user_metadata.client_id, and
 * hands the matching client record down to the shell as a prop so every page
 * can read it without needing to re-query.
 *
 * Staff (non-client users) who happen to land here are allowed through so we
 * can QA the portal, and their shell shows a small "staff preview" banner.
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
  // For MVP: if the user is a client, their metadata must carry client_id.
  // If it's missing, we default to Prime IV Niceville since that's the first
  // live client portal. Staff users can hit /client to QA and we show them
  // Niceville by default too.
  const clientId =
    (meta.client_id as string) ||
    (role === 'client' ? 'prime-iv' : 'prime-iv'); // default QA target

  const client = clients.find((c) => c.id === clientId) || clients.find((c) => c.id === 'prime-iv')!;

  return (
    <ClientPortalShell
      client={client}
      userEmail={user.email || ''}
      isStaffPreview={role !== 'client'}
    >
      {children}
    </ClientPortalShell>
  );
}
