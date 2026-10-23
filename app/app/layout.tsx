'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, profile, loading, signOut } = useAuth();

  const isAllowedStaff =
    !!profile &&
    profile.active &&
    (profile.role === 'hostel_owner' || profile.role === 'caretaker');

  useEffect(() => {
    if (loading) return;
    if (!session || !profile || !profile.active || (profile.role !== 'hostel_owner' && profile.role !== 'caretaker')) {
      if (session && profile?.role === 'super_admin') {
        router.replace('/admin/dashboard');
        return;
      }
      if (session) void signOut();
      router.replace('/login');
    }
  }, [session, profile, loading, signOut, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !isAllowedStaff) return null;

  return <AppShell>{children}</AppShell>;
}
