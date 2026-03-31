'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, ShieldCheck, Users, User } from 'lucide-react';

type Profile = {
  full_name: string | null;
  role: 'admin' | 'team' | 'client';
  client_name: string | null;
};

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: ShieldCheck, color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  team: { label: 'Team', icon: Users, color: '#0c6da4', bg: 'rgba(12,109,164,0.10)' },
  client: { label: 'Client', icon: User, color: '#059669', bg: 'rgba(5,150,105,0.10)' },
};

export default function UserBanner() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      // Fetch profile + joined client name in one query
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, clients(name)')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name,
          role: data.role as Profile['role'],
          client_name: (data.clients as { name: string } | null)?.name ?? null,
        });
      }
    }

    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (!profile) return null;

  const roleConfig = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.client;
  const RoleIcon = roleConfig.icon;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-2xl mb-2"
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(0,0,0,0.05)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {(profile.full_name ?? email ?? '?').charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div>
          <div className="text-[13px] font-semibold text-gray-800 leading-tight">
            {profile.full_name ?? email}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Role badge */}
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: roleConfig.color, background: roleConfig.bg }}
            >
              <RoleIcon size={10} />
              {roleConfig.label}
            </span>

            {/* Client name (only shown for non-admin) */}
            {profile.client_name && profile.role !== 'admin' && (
              <span className="text-[11px] text-gray-400">{profile.client_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        title="Sign out"
        className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
      >
        <LogOut size={13} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
