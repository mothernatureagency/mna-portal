import { createClient } from '@/lib/supabase/server';

/**
 * Shared auth guard for portal-facing API routes.
 *
 * Resolves the Supabase user and answers "may this user act on this client?".
 * Staff/owner/admin can act on any client; client-role users are scoped to
 * their own client_id (single) or client_ids (comma-separated, multi-account) —
 * mirroring the resolution in app/client/layout.tsx.
 */
export type PortalAuth = {
  userId: string;
  email: string;
  role: string;
  isStaff: boolean;
  allowedClientIds: string[]; // only meaningful when role === 'client'
};

export async function getPortalAuth(): Promise<PortalAuth | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const role = (meta.role as string) || 'staff';
  const isStaff = role !== 'client' && role !== 'contractor' && role !== 'student' && role !== 'creator';

  const ids = new Set<string>();
  const single = (meta.client_id as string) || '';
  if (single) ids.add(single.trim());
  const multi = (meta.client_ids as string) || '';
  for (const id of multi.split(',')) {
    const t = id.trim();
    if (t) ids.add(t);
  }

  return {
    userId: user.id,
    email: user.email || '',
    role,
    isStaff,
    allowedClientIds: Array.from(ids),
  };
}

export function canAccessClient(auth: PortalAuth, clientId: string): boolean {
  if (auth.isStaff) return true;
  if (auth.role === 'client') return auth.allowedClientIds.includes(clientId);
  return false;
}
