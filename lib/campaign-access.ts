import { createClient } from '@/lib/supabase/server';
export async function campaignAccess() {
  const {data:{user}} = await createClient().auth.getUser();
  if (!user) return null;
  const meta = user.user_metadata || {};
  const role = String(meta.role || 'staff');
  if (['contractor','student','creator'].includes(role)) return null;
  const ids = Array.from(new Set([String(meta.client_id || ''), ...String(meta.client_ids || '').split(',')].map(x=>x.trim()).filter(Boolean)));
  return { email:user.email || '', staff: role !== 'client', clientIds: ids };
}
