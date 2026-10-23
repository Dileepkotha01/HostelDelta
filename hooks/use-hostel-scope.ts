'use client';

import { useAuth } from '@/lib/auth-context';

/** Hostel-scoped pages: wait for auth, then expose profile.hostel_id when present. */
export function useHostelScope() {
  const { profile, loading: authLoading } = useAuth();
  const hostelId = profile?.hostel_id ?? null;
  const isReady = !authLoading;
  const hasHostel = isReady && Boolean(hostelId);

  return { profile, hostelId, authLoading, isReady, hasHostel };
}
