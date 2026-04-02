'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logout, ShieldCheck, Users, User } from 'lucide-react';
import React from 'react';

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
  const [profile, setProfile] = useState(null as Profile | null);
  const [email, setEmail] = useState(null as string | null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, clients(name)')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile({
          full_name: data.full_name,
          role: data.role as Profile['role'],
          client_name: (data.clients as unknown as { name: string } | null)?.name ?? null,
        });
      }
    }
    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/lock');
  }

  if (!profile) return null;

  const role = profile.role || 'client';
  const RoleIcon = ROLE_CONFIG[role]?.icon || User;
  const roleLabel = ROLE_CONFIG[role]?.label || role;

  return React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a5e,#0fa86e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
        React.createElement('span', { style: { color: '#fff', fontSize: 13, fontWeight: 700 } }, (profile.full_name || email || 'U').charAt(0).toUpperCase())
      ),
      React.createElement('div', null,
        React.createElement('div', { style: { color: '#fff', fontSize: 12, fontWeight: 600 } }, profile.full_name || email || 'User'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 } },
          React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: ROLE_CONFIG[role]?.bg || 'rgba(255,255,255,0.1)', border: '1px solid ' + (ROLE_CONFIG[role]?.color || '#fff') + '33' } },
            React.createElement(RoleIcon, { size: 9, style: { color: ROLE_CONFIG[role]?.color || '#fff' } }),
            React.createElement('span', { style: { color: ROLE_CONFIG[role]?.color || '#fff', fontSize: 9, fontWeight: 600 } }, roleLabel)
          )
        )
      )
    ),
    React.createElement('button', {
      onClick: handleSignOut,
      style: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 11 }
    },
      React.createElement(Logout, { size: 12 }),
      React.createElement('span', null, 'Sign Out')
    )
  );
      }
