'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, ShieldCheck, Users, User } from 'lucide-react';
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
        const d = data as unknown as { full_name: string | null; role: 'admin' | 'team' | 'client'; clients: { name: string } | null };
        setProfile({ full_name: d.full_name, role: d.role, client_name: d.clients?.name ?? null });
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const role = profile?.role ?? 'team';
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.team;
  const IconComp = cfg.icon;
  const displayName = profile?.full_name ?? email ?? 'User';

  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement('div', { style: { width: 34, height: 34, borderRadius: '50%', background: cfg.bg, border: '1px solid ' + cfg.color + '44', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(IconComp, { size: 16, color: cfg.color })
      ),
      React.createElement('div', null,
        React.createElement('div', { style: { color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.2 } }, displayName),
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.45)', fontSize: 11 } }, email ?? '')
      ),
      React.createElement('span', { style: { background: cfg.bg, color: cfg.color, border: '1px solid ' + cfg.color + '44', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, marginLeft: 6 } }, cfg.label)
    ),
    React.createElement('button', { onClick: handleLogout, style: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 } },
      React.createElement(LogOut, { size: 14 }),
      'Log out'
    )
  );
}
