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
          client_name: (data.clients as unknown as { name: string } | null)?.name ?? null,
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
