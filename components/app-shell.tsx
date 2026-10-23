'use client';

import { useState, useEffect, useRef, ReactNode, FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-provider';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HostelSwitcher } from '@/components/hostel-switcher';
import { OnboardHostelWizard } from '@/components/OnboardHostelWizard';
import { HostelBillingRenewal } from '@/components/hostel-billing-renewal';
import { useToast } from '@/hooks/use-toast';
import type { Hostel } from '@/lib/types';
import type { PendingHostelOnboarding } from '@/lib/hostel-onboarding';
import { HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR } from '@/lib/hostel-subscription';
import {
  Building2,
  LayoutDashboard,
  BedDouble,
  Users,
  Receipt,
  PhoneCall,
  Wrench,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Phone,
  MapPin,
  DoorOpen,
  Layers,
  Pencil,
  PlusCircle,
  ChevronDown,
  Loader2,
  TrendingDown,
  CreditCard,
  CalendarDays,
  AlertCircle,
  X,
} from 'lucide-react';


const NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/rooms', label: 'Rooms', icon: BedDouble },
  { href: '/app/tenants', label: 'Tenants', icon: Users },
  { href: '/app/payments', label: 'Payments', icon: Receipt },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/expenses', label: 'Expenses', icon: TrendingDown },
  { href: '/app/ai-calls', label: 'AI Calls', icon: PhoneCall },
  { href: '/app/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];


const MOBILE_NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/rooms', label: 'Rooms', icon: BedDouble },
  { href: '/app/tenants', label: 'Tenants', icon: Users },
  { href: '/app/payments', label: 'Payments', icon: Receipt },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/expenses', label: 'Expenses', icon: TrendingDown },
];


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut, switchHostel } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentHostel, setCurrentHostel] = useState<Hostel | null>(null);
  const [billingAccess, setBillingAccess] = useState<'checking' | 'available' | 'blocked' | 'error'>('checking');
  const [resumingPayment, setResumingPayment] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [billingInfo, setBillingInfo] = useState<{ status: string; trialEndsAt: string | null; periodEndsAt: string | null } | null>(null);
  const [billingRefresh, setBillingRefresh] = useState(0);

  // Hostel list for mobile switcher
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [hostelSwitcherOpen, setHostelSwitcherOpen] = useState(false);

  // Edit hostel details modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [saving, setSaving] = useState(false);

  // Add hostel wizard (full onboarding)
  const [addHostelOpen, setAddHostelOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<PendingHostelOnboarding | null>(null);
  const [pendingOnboardings, setPendingOnboardings] = useState<PendingHostelOnboarding[]>([]);
  const [dismissedOnboardingBanners, setDismissedOnboardingBanners] = useState<Set<string>>(() => new Set());
  const [pendingOnboardingsRefresh, setPendingOnboardingsRefresh] = useState(0);
  const isBillingPage = pathname === '/app/billing' || pathname.startsWith('/app/billing/');
  const continueHostelPaymentRef = useRef<(onboardingId: string) => Promise<void>>(async () => {});

  // ── Scroll to top on every page change ──
  useEffect(() => {
    // Scroll the window to top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // Also scroll the main content container if it's a custom scroll area
    const mainEl = document.getElementById('main-scroll-area');
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    async function fetchHostelData() {
      if (!profile?.id) return;

      const [hostelResult, hostelsResult] = await Promise.all([
        profile.hostel_id
          ? supabase.from('hostels').select('*').eq('id', profile.hostel_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('hostels').select('id, name').eq('owner_id', profile.id).order('created_at', { ascending: true }),
      ]);

      setCurrentHostel(hostelResult.data as Hostel | null);
      setHostels((hostelsResult.data as { id: string; name: string }[]) || []);
    }
    void fetchHostelData();
  }, [profile?.hostel_id, profile?.id, profile?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingOnboardings() {
      if (!profile?.id || profile.role !== 'hostel_owner') {
        setPendingOnboardings([]);
        return;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionError || !accessToken) {
        if (sessionError) console.error('Unable to load pending hostel payments:', sessionError);
        return;
      }
      const response = await fetch('/api/hostels/onboarding', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        onboardings?: PendingHostelOnboarding[];
      };
      if (cancelled) return;
      if (!response.ok) {
        console.error('Unable to load pending hostel payments:', result.error || response.statusText);
        return;
      }
      setPendingOnboardings(result.onboardings || []);
    }

    void loadPendingOnboardings().catch((error: unknown) => {
      console.error('Unable to load pending hostel payments:', error);
    });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, pendingOnboardingsRefresh]);

  useEffect(() => {
    let cancelled = false;

    async function checkBillingAccess() {
      // Owners and staff both require an active hostel subscription for operational access.
      if (!profile?.id || !profile.hostel_id || !['hostel_owner', 'caretaker'].includes(profile.role)) {
        setBillingInfo(null);
        setBillingAccess('available');
        return;
      }

      setBillingAccess('checking');
      const { data, error } = await supabase
        .from('owner_subscriptions')
        .select('status, trial_ends_at, current_period_end')
        .eq('hostel_id', profile.hostel_id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('Unable to verify hostel subscription access:', error);
        setBillingAccess('error');
        return;
      }
      if (!data) {
        const { data: hostel } = await supabase
          .from('hostels')
          .select('onboarding_id')
          .eq('id', profile.hostel_id)
          .maybeSingle();
        if (cancelled) return;
        if (hostel?.onboarding_id) {
          const { data: onboarding } = await supabase
            .from('owner_hostel_onboarding_drafts')
            .select('status')
            .eq('onboarding_id', hostel.onboarding_id)
            .maybeSingle();
          if (cancelled) return;
          if (onboarding && onboarding.status !== 'COMPLETED') {
            setBillingInfo({ status: onboarding.status, trialEndsAt: null, periodEndsAt: null });
            setBillingAccess('blocked');
            return;
          }
        }
        // No active subscription row means the hostel must complete billing — never grant free access.
        setBillingInfo({ status: 'MISSING', trialEndsAt: null, periodEndsAt: null });
        setBillingAccess('blocked');
        return;
      }

      const trialEndsAt = data.trial_ends_at as string | null;
      const periodEndsAt = data.current_period_end as string | null;
      const now = Date.now();
      const trialEnded = !!trialEndsAt && new Date(trialEndsAt).getTime() <= now;
      const periodEnded = !periodEndsAt || new Date(periodEndsAt).getTime() <= now;
      const trialStillValid = !!trialEndsAt && !trialEnded;
      const periodStillValid = !!periodEndsAt && !periodEnded;
      const allowed = data.status === 'ACTIVE'
        ? periodStillValid
        : data.status === 'TRIALING'
          ? trialStillValid
          : data.status === 'CANCELLED'
            ? periodStillValid
            : false;

      setBillingInfo({ status: data.status, trialEndsAt, periodEndsAt });
      setBillingAccess(allowed ? 'available' : 'blocked');
    }

    void checkBillingAccess();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, profile?.hostel_id, billingRefresh]);

  useEffect(() => {
    const refreshBilling = () => setBillingRefresh((value) => value + 1);
    window.addEventListener('hostel-billing-updated', refreshBilling);
    return () => window.removeEventListener('hostel-billing-updated', refreshBilling);
  }, []);

  useEffect(() => {
    const resumePayment = (event: Event) => {
      const onboardingId = (event as CustomEvent<{ onboardingId?: string }>).detail?.onboardingId;
      if (onboardingId) void continueHostelPaymentRef.current(onboardingId);
    };
    window.addEventListener('hostel-billing-resume-onboarding', resumePayment);
    return () => window.removeEventListener('hostel-billing-resume-onboarding', resumePayment);
  }, []);

  const trialDaysRemaining = billingInfo?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billingInfo.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const isInitialPaymentPending = ['CREATED', 'PENDING_PAYMENT', 'PROCESSING', 'PAYMENT_FAILED']
    .includes(billingInfo?.status || '');

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  function handleNav(href: string) {
    router.push(href);
    setMobileOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  function openEditModal() {
    setEditName(currentHostel?.name || '');
    setEditAddress(currentHostel?.address || '');
    setEditCity(currentHostel?.city || '');
    setEditState(currentHostel?.state || '');
    setEditOpen(true);
  }

  async function handleSaveHostelDetails(e: FormEvent) {
    e.preventDefault();
    if (!currentHostel?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('hostels')
      .update({ name: editName, address: editAddress, city: editCity, state: editState })
      .eq('id', currentHostel.id);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      setCurrentHostel((prev) => prev ? { ...prev, name: editName, address: editAddress, city: editCity, state: editState } : prev);
      toast({ title: 'Hostel details updated ✅' });
      setEditOpen(false);
    }
    setSaving(false);
  }

  async function handleHostelCreated(hostelId: string) {
    setAddHostelOpen(false);
    await switchHostel(hostelId);
    setPendingOnboardingsRefresh((current) => current + 1);
    setBillingRefresh((current) => current + 1);
    const { data: hostel, error } = await supabase
      .from('hostels')
      .select('*')
      .eq('id', hostelId)
      .maybeSingle();
    if (error) console.error('Unable to load the newly created hostel:', error);
    if (hostel) setCurrentHostel(hostel as Hostel);
    setHostels((current) => current.some((item) => item.id === hostelId)
      ? current
      : [...current, { id: hostelId, name: hostel?.name || 'New hostel' }]);
    router.push('/app/dashboard');
  }

  function handleAddHostelOpenChange(value: boolean) {
    setAddHostelOpen(value);
    if (!value) {
      setResumeDraft(null);
      setPendingOnboardingsRefresh((current) => current + 1);
    }
  }

  async function handleContinueHostelPayment(requestedOnboardingId = currentHostel?.onboarding_id) {
    if (resumingPayment) return;

    const onboardingId = requestedOnboardingId;
    if (!onboardingId) {
      toast({
        title: 'Saved payment setup not found',
        description: 'The saved hostel setup is not linked to this hostel. Refresh the dashboard or contact support.',
        variant: 'destructive',
      });
      return;
    }

    setResumingPayment(true);
    try {
      let onboarding = pendingOnboardings.find((item) => item.onboarding_id === onboardingId);
      if (!onboarding) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (sessionError || !accessToken) {
          throw new Error(sessionError?.message || 'Your session has expired. Sign in again to continue payment.');
        }

        const response = await fetch('/api/hostels/onboarding', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json().catch(() => ({})) as {
          error?: string;
          onboardings?: PendingHostelOnboarding[];
        };
        if (!response.ok) {
          throw new Error(result.error || 'Unable to load the saved hostel setup.');
        }
        const onboardings = result.onboardings || [];
        setPendingOnboardings(onboardings);
        onboarding = onboardings.find((item) => item.onboarding_id === onboardingId);
      }

      if (!onboarding) {
        throw new Error('The saved hostel payment details could not be found. No new payment was started.');
      }

      setResumeDraft(onboarding);
      setAddHostelOpen(true);
    } catch (error) {
      console.error('Unable to resume hostel payment:', error);
      toast({
        title: 'Unable to continue payment',
        description: error instanceof Error ? error.message : 'Please refresh the dashboard and try again.',
        variant: 'destructive',
      });
    } finally {
      setResumingPayment(false);
    }
  }

  continueHostelPaymentRef.current = handleContinueHostelPayment;

  function handleBillingPayment() {
    if (isInitialPaymentPending) {
      void handleContinueHostelPayment();
      return;
    }
    if (!currentHostel?.id) {
      toast({
        title: 'Select a hostel first',
        description: 'Choose the hostel you want to renew from the hostel switcher.',
        variant: 'destructive',
      });
      return;
    }
    setRenewalOpen(true);
  }

  async function handleSwitchHostel(id: string) {
    setHostelSwitcherOpen(false);
    if (id === profile?.hostel_id) return;
    await switchHostel(id);
    toast({ title: 'Switched hostel ✅' });
  }

  // Mobile drawer content with hostel details on top and navigation below
  const MobileSidebarContent = (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {/* ── Top Section: Hostel Details & Contact Info ── */}
      <div className="p-4 border-b border-border bg-gradient-to-b from-primary/10 via-primary/5 to-transparent space-y-3">
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-base leading-tight text-foreground truncate">
                {currentHostel?.name || 'Select a hostel'}
              </h2>
              <span className="inline-block mt-0.5 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {profile?.role?.replace('_', ' ') || 'Hostel Owner'}
              </span>
            </div>
          </div>
        </div>

        {/* Basic Details: Phone Number, Location, Rooms/Floors */}
        <div className="mt-2 pt-2.5 border-t border-border/60 space-y-2 text-xs">
          {/* Hostel / Contact Phone */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
            <a
              href={`tel:${profile?.phone || '+919800000000'}`}
              className="hover:text-primary transition-colors font-medium text-foreground"
            >
              {profile?.phone || '+91 98000 00000'}
            </a>
          </div>

          {/* Location / City */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {[currentHostel?.address, currentHostel?.city, currentHostel?.state].filter(Boolean).join(', ') ||
                'Demo Campus, Bangalore, Karnataka'}
            </span>
          </div>

          {/* Basic Stats: Rooms & Floors */}
          <div className="flex items-center gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/80 text-foreground font-medium">
              <DoorOpen className="w-3 h-3 text-primary" />
              <span>{currentHostel?.total_rooms ?? 0} Rooms</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/80 text-foreground font-medium">
              <Layers className="w-3 h-3 text-primary" />
              <span>{currentHostel?.total_floors ?? 1} Floors</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active</span>
            </div>
          </div>
        </div>

        {/* Edit Hostel Details button */}
        <button
          onClick={() => { openEditModal(); setMobileOpen(false); }}
          className="w-full flex items-center justify-center gap-2 mt-1 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-all active:scale-[0.98]"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Hostel Details
        </button>
      </div>

      {/* ── User Profile Pill ── */}
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2.5 shrink-0">
        <Avatar className="w-7 h-7">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-xs overflow-hidden">
          <p className="font-semibold text-foreground truncate">{profile?.full_name || 'Demo Owner'}</p>
          <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
        </div>
      </div>

      {/* ── Navigation Items Below ── */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Menu Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer: Theme & Sign Out ── */}
      <div className="border-t border-border p-3 space-y-1 bg-card shrink-0">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 border-r border-border bg-card flex-col z-30 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Floating edge toggle button */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="absolute -right-3.5 top-6 z-50 w-7 h-7 rounded-full border border-border bg-card shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Inner content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo / Branding */}
          <div
            className={`flex items-center shrink-0 border-b border-border transition-all duration-300 ${
              sidebarOpen ? 'gap-3 px-5 py-5' : 'justify-center py-5'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-lg leading-tight whitespace-nowrap">HostelHub</h1>
                <p className="text-xs text-muted-foreground capitalize whitespace-nowrap">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => handleNav(item.href)}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-all ${
                    sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'
                  } ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {sidebarOpen && (
                    <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom: theme / sign-out */}
          <div className="border-t border-border p-2 space-y-1">
            <button
              onClick={toggle}
              title={!sidebarOpen ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all ${
                sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'
              }`}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 shrink-0" />
              ) : (
                <Sun className="w-5 h-5 shrink-0" />
              )}
              {sidebarOpen && (
                <span className="whitespace-nowrap overflow-hidden">
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </span>
              )}
            </button>

            <button
              onClick={handleSignOut}
              title={!sidebarOpen ? 'Sign Out' : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all ${
                sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center py-2.5'
              }`}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {sidebarOpen && (
                <span className="whitespace-nowrap overflow-hidden">Sign Out</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3 h-14 border-b border-border bg-card/90 backdrop-blur-md gap-2">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm leading-tight">HostelHub</span>
        </div>

        {/* Center: Hostel switcher / Add hostel */}
        <div className="flex-1 flex justify-center">
          {hostels.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setHostelSwitcherOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-all max-w-[160px]"
              >
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{currentHostel?.name || 'Select Hostel'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
              {hostelSwitcherOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHostelSwitcherOpen(false)} />
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-52 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1.5">Your Hostels</p>
                    {hostels.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => handleSwitchHostel(h.id)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                          h.id === profile?.hostel_id ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{h.name}</span>
                      </button>
                    ))}
                    <div className="h-px bg-border mx-3" />
                    <button
                      onClick={() => { setHostelSwitcherOpen(false); setAddHostelOpen(true); }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/10 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Another Hostel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAddHostelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/15 transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Hostel
            </button>
          )}
        </div>

        {/* Right: Profile pic avatar — no ring, rounded square */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              id="mobile-menu-trigger"
              aria-label="Open menu and hostel details"
              className="relative w-9 h-9 rounded-xl overflow-hidden bg-primary shadow-md hover:shadow-lg hover:scale-105 transition-all active:scale-95 focus:outline-none shrink-0"
            >
              <div className="w-full h-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                {initials}
              </div>
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-card" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px] sm:w-[360px] p-0 flex flex-col">
            {MobileSidebarContent}
          </SheetContent>
        </Sheet>
      </header>

      {/* ── Desktop Top Bar ── */}
      <header
        className={`hidden lg:flex sticky top-0 z-20 items-center justify-between px-6 h-14 border-b border-border bg-card/80 backdrop-blur-md transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-lg border-r border-border pr-4 hidden xl:block">
            {NAV_ITEMS.find((n) => isActive(n.href))?.label || 'Dashboard'}
          </h2>
          {profile?.role === 'hostel_owner' && <HostelSwitcher />}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggle}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium leading-tight">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main
        id="main-scroll-area"
        className={`pb-20 lg:pb-8 min-h-screen transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {pendingOnboardings.filter((item) => !dismissedOnboardingBanners.has(item.onboarding_id)).map((onboarding) => (
            <div key={onboarding.onboarding_id} className="relative mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 pr-12 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  Complete payment for {onboarding.hostel_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {onboarding.status === 'PAYMENT_FAILED'
                    ? 'The previous payment did not complete. Your hostel details are saved.'
                    : onboarding.status === 'PROCESSING'
                      ? 'Payment was not completed. Your saved setup is ready to continue.'
                      : 'Your hostel details are saved and waiting for payment.'}
                </p>
              </div>
              <Button
                onClick={() => void handleContinueHostelPayment(onboarding.onboarding_id)}
                disabled={resumingPayment}
                className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-500"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {resumingPayment ? 'Loading saved setup...' : 'Continue payment'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Dismiss payment reminder for ${onboarding.hostel_name}`}
                title="Close payment reminder"
                onClick={() => setDismissedOnboardingBanners((current) => {
                  const next = new Set(current);
                  next.add(onboarding.onboarding_id);
                  return next;
                })}
                className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {billingAccess === 'available' && billingInfo?.status === 'TRIALING' && (
            <div className="mb-5 flex flex-col gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your free trial
              </p>
              <p className="text-xs text-muted-foreground">
                ₹{HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')}/month per hostel. First recurring debit after {billingInfo.trialEndsAt
                  ? new Date(billingInfo.trialEndsAt).toLocaleDateString()
                  : 'your trial'}.
              </p>
            </div>
          )}
          {billingAccess === 'blocked' && !isBillingPage ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-card p-7 text-center shadow-lg">
                <CreditCard className="mx-auto h-8 w-8 text-amber-500" />
                <h2 className="mt-4 text-lg font-bold text-foreground">Hostel services are locked</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {profile?.role === 'caretaker'
                    ? 'This hostel subscription is inactive. Ask the hostel owner to renew billing before continuing.'
                    : 'Complete payment to continue using this hostel. Choose a one-time payment or monthly autopay in the payment step.'}
                </p>
                {profile?.role === 'hostel_owner' && (
                  <>
                    <Button
                      onClick={handleBillingPayment}
                      disabled={resumingPayment}
                      className="mt-5 w-full bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {resumingPayment
                        ? 'Loading saved setup...'
                        : isInitialPaymentPending ? 'Continue payment' : 'Pay once to renew for 30 days'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/app/billing')}
                      className="mt-2 w-full"
                    >
                      Manage billing
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : children}
        </div>
      </main>

      {billingAccess === 'checking' && !!profile?.hostel_id && !isBillingPage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Verifying hostel subscription...
          </div>
        </div>
      )}

      {billingAccess === 'error' && !isBillingPage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <AlertCircle className="h-7 w-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Unable to verify billing</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We could not verify this hostel’s subscription. Retry the secure status check to restore access.
            </p>
            <Button
              onClick={() => setBillingRefresh((value) => value + 1)}
              className="mt-6 w-full"
            >
              Retry status check
            </Button>
            <Button variant="ghost" onClick={() => void handleSignOut()} className="mt-2 w-full">
              Sign out
            </Button>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Nav Bar ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around h-16 border-t border-border bg-card/95 backdrop-blur-md px-2 shadow-lg">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg min-w-[60px] min-h-[48px] transition-colors ${
                active ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Edit Hostel Details Modal ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="w-5 h-5 text-primary" /> Edit Hostel Details
            </DialogTitle>
            <DialogDescription className="text-sm">Update your hostel&apos;s basic information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveHostelDetails} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-hostel-name">Hostel Name</Label>
              <Input id="edit-hostel-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={"e.g. Sunrise Men's Hostel"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hostel-address">Address</Label>
              <Input id="edit-hostel-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-hostel-city">City</Label>
                <Input id="edit-hostel-city" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-hostel-state">State</Label>
                <Input id="edit-hostel-state" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="shadow-md shadow-primary/20">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Hostel Wizard (Full Onboarding) ── */}
      {profile && (
        <OnboardHostelWizard
          open={addHostelOpen}
          onOpenChange={handleAddHostelOpenChange}
          userId={profile.id}
          onSuccess={handleHostelCreated}
          resumeDraft={resumeDraft}
        />
      )}
      {currentHostel && (
        <HostelBillingRenewal
          open={renewalOpen}
          onOpenChange={setRenewalOpen}
          hostelId={currentHostel.id}
          onSuccess={() => setBillingRefresh((value) => value + 1)}
        />
      )}
    </div>
  );
}
