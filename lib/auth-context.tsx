'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  switchHostel: (hostelId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  switchHostel: async () => {},
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function userCanAccessHostel(userId: string, hostelId: string, role: string | null | undefined): Promise<boolean> {
  if (!UUID_RE.test(hostelId)) return false;
  if (role === 'super_admin') return true;

  const { data: owned } = await supabase
    .from('hostels')
    .select('id')
    .eq('id', hostelId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (owned) return true;

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('hostel_id', hostelId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  return !!staff;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialLoadDone = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        void loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
      initialLoadDone = true;
    }).catch((error) => {
      console.error('Error restoring session:', error);
      setLoading(false);
      initialLoadDone = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Skip the very first fired event — it duplicates getSession() on page load
      if (!initialLoadDone) return;
      setSession(session);
      if (session) {
        setLoading(true);
        (async () => {
          await loadProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
    }

    let loadedProfile = data as Profile | null;
    if (loadedProfile && typeof window !== 'undefined') {
      const savedHostelId = localStorage.getItem(`hostelhub_active_hostel_${userId}`);
      if (savedHostelId) {
        const allowed = await userCanAccessHostel(userId, savedHostelId, loadedProfile.role);
        if (allowed) {
          loadedProfile = { ...loadedProfile, hostel_id: savedHostelId };
        } else {
          localStorage.removeItem(`hostelhub_active_hostel_${userId}`);
        }
      }
    }

    setProfile(loadedProfile);
    setLoading(false);
  }

  async function switchHostel(hostelId: string) {
    if (!session?.user?.id || !profile) return;

    const allowed = await userCanAccessHostel(session.user.id, hostelId, profile.role);
    if (!allowed) {
      console.warn('Rejected hostel switch for inaccessible hostel.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`hostelhub_active_hostel_${session.user.id}`, hostelId);
    }

    setProfile((prev) => (prev ? { ...prev, hostel_id: hostelId } : null));

  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, switchHostel }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
