'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing secure sign in...');

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        if (active) setMessage(sessionError?.message || 'No active session was returned. Please sign in again.');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !data) {
        if (active) {
          setMessage(error?.message || 'Your account profile is not ready. Contact support before retrying.');
        }
        return;
      }

      const profile = data as Profile;
      const isAdminPortal = window.location.hostname.toLowerCase().startsWith('admin.');

      if (!profile.active) {
        await supabase.auth.signOut();
        if (active) setMessage('This account is inactive. Contact your platform administrator.');
        return;
      }

      if (isAdminPortal && profile.role !== 'super_admin') {
        await supabase.auth.signOut();
        if (active) setMessage('This portal requires an account with the super_admin role.');
        return;
      }

      if (!isAdminPortal && profile.role === 'super_admin') {
        await supabase.auth.signOut();
        if (active) {
          setMessage('Use the Super Admin Login on admin.kupera.in to access the command center.');
        }
        return;
      }

      router.replace(isAdminPortal ? '/admin/dashboard' : '/app/dashboard');
    }

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <p role="status" className="max-w-lg text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </main>
  );
}
