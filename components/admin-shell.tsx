'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAdmin } from '@/lib/admin-context';
import { getPortalUrl } from '@/lib/portal-urls';
import { useTheme } from '@/lib/theme-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Building2,
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Users,
  ShieldCheck,
  Activity,
  Sliders,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Menu,
  Database,
  Globe,
  Bell,
  CheckCircle2,
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/hostels', label: 'Hostels Directory', icon: Building2 },
  { href: '/admin/revenue', label: 'Revenue & Analytics', icon: TrendingUp },
  { href: '/admin/payments', label: 'All Transactions', icon: Receipt },
  { href: '/admin/tenants', label: 'Tenants & KYC', icon: Users },
  { href: '/admin/users', label: 'User Accounts', icon: ShieldCheck },
  { href: '/admin/operations', label: 'Global Operations', icon: Activity },
  { href: '/admin/settings', label: 'Subdomain & Settings', icon: Sliders },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const {
    hostels,
    selectedHostelId,
    setSelectedHostelId,
    refreshAll,
    loading,
    stats,
  } = useAdmin();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hostname, setHostname] = useState('admin.kupera.in');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHostname(window.location.host);
    }
  }, []);

  const { isSuperAdmin } = useAdmin();
  const authLoading = useAuth().loading;

  useEffect(() => {
    if (!authLoading && pathname !== '/admin/login') {
      if (!profile || !isSuperAdmin || !profile.active) {
        router.push('/admin/login');
      }
    }
  }, [profile, isSuperAdmin, pathname, router, authLoading]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAll();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'AD';

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return pathname === '/admin' || pathname === '/admin/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-card/90 backdrop-blur-xl relative z-30">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <Link href="/admin/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-all">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-lg text-foreground">HostelHub</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                  SuperAdmin
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 text-emerald-400" />
                <span className="font-mono text-[11px] truncate max-w-[140px]">{hostname}</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Hostel Scope Selector */}
        <div className="px-4 py-3 border-b border-border bg-background/40">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block flex items-center justify-between">
            <span>Admin Scope</span>
            <span className="text-indigo-400 text-[10px]">{hostels.length} Hostels</span>
          </label>
          <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
            <SelectTrigger className="w-full h-9 bg-background border-border text-xs text-foreground focus:ring-indigo-500">
              <SelectValue placeholder="All Hostels (Global)" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all" className="font-semibold text-indigo-600 dark:text-indigo-400">
                🌐 All Hostels (Global Platform)
              </SelectItem>
              {hostels.map((h) => (
                <SelectItem key={h.id} value={h.id} className="text-xs">
                  🏨 {h.name} {h.city ? `(${h.city})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                    active ? 'text-white' : 'text-muted-foreground group-hover:text-indigo-500'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Quick Bridge to Hostel Manager Portal */}
        <div className="p-3 mx-3 mb-2 rounded-xl bg-gradient-to-br from-indigo-500/10 via-card to-purple-500/10 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Owner Portal
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
            Need to manage day-to-day rooms, beds or single hostel operations?
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs border-indigo-500/50 hover:bg-indigo-600 hover:text-white bg-background text-indigo-600 dark:text-indigo-200 flex items-center justify-center gap-1.5"
            onClick={() => window.location.assign(getPortalUrl('app', '/app/dashboard'))}
          >
            <span>Open Hostel Manager</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-border bg-background/60 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-9 w-9 ring-1 ring-indigo-500/50">
              <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {profile?.full_name || 'Super Admin'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {profile?.email || 'admin@hostelhub.app'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Sign Out"
            className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Top Navbar */}
        <header className="h-16 px-4 lg:px-8 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-card text-foreground border-border">
                <div className="p-5 border-b border-border flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                    <ShieldAlert className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground text-base">HostelHub Admin</h2>
                    <p className="text-xs text-muted-foreground font-mono">{hostname}</p>
                  </div>
                </div>
                <div className="p-3">
                  <label className="text-[10px] uppercase text-muted-foreground font-bold block mb-1">
                    Select Scope
                  </label>
                  <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                    <SelectTrigger className="w-full h-9 bg-background border-border text-xs">
                      <SelectValue placeholder="All Hostels" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="all">🌐 All Hostels (Global)</SelectItem>
                      {hostels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          🏨 {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <nav className="p-3 space-y-1">
                  {ADMIN_NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                          active
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-border mt-auto">
                  <Button
                    variant="outline"
                    className="w-full text-xs border-indigo-500/50 text-indigo-600 dark:text-indigo-300"
                    onClick={() => {
                      setMobileOpen(false);
                      window.location.assign(getPortalUrl('app', '/app/dashboard'));
                    }}
                  >
                    Switch to Hostel Manager Portal
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb / Title indicator */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Database className="h-3 w-3" />
                Live Cloud Database
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span>Scope:</span>
                <strong className="text-foreground">
                  {selectedHostelId === 'all'
                    ? 'All Hostels'
                    : hostels.find((h) => h.id === selectedHostelId)?.name || 'Selected Hostel'}
                </strong>
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Live refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="h-8 px-2.5 text-xs bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              title="Refresh data from database"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </Button>

            {/* Quick jump to regular dashboard */}
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-sm flex items-center gap-1.5"
              onClick={() => window.location.assign(getPortalUrl('app', '/app/dashboard'))}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Hostel Manager</span>
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Global Live Metric Pill Banner */}
        <div className="bg-card/40 border-b border-border px-4 lg:px-8 py-2 overflow-x-auto flex items-center gap-6 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground font-medium">Platform Revenue:</span>
            <span className="font-bold text-emerald-400">
              ₹{stats.totalRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground font-medium">Pending Receivables:</span>
            <span className="font-bold text-amber-400">
              ₹{stats.pendingRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground font-medium">Global Occupancy:</span>
            <span className="font-bold text-indigo-400">{stats.occupancyRate}%</span>
            <span className="text-[11px] text-muted-foreground">
              ({stats.occupiedBeds}/{stats.totalBeds} beds)
            </span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground font-medium">Active Hostels:</span>
            <span className="font-semibold text-foreground">{stats.totalHostels}</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground font-medium">Active Tenants:</span>
            <span className="font-semibold text-foreground">{stats.totalTenants}</span>
          </div>
        </div>

        {/* Main Scrollable View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
