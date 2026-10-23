'use client';

import { useEffect, useState, useMemo, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { OnboardTenantDialog } from '@/components/onboard-tenant-dialog';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  CreditCard,
  Building,
  User,
  ShieldCheck,
  Pause,
  Play,
  Eye,
  Download,
  Award,
  FileText,
  Upload,
  Clock,
  AlertCircle,
  IndianRupee,
  DoorOpen,
  Sparkles,
  Check,
} from 'lucide-react';
import type { Tenant, Room, Bed, Invoice } from '@/lib/types';

export default function TenantsPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [aadhaarPreviewTenant, setAadhaarPreviewTenant] = useState<Tenant | null>(null);
  const [aadhaarPreviewUrl, setAadhaarPreviewUrl] = useState<string | null>(null);
  const [aadhaarPreviewContentType, setAadhaarPreviewContentType] = useState('');
  const [aadhaarPreviewLoading, setAadhaarPreviewLoading] = useState(false);
  const [aadhaarPreviewError, setAadhaarPreviewError] = useState('');
  const [downloadingTenantId, setDownloadingTenantId] = useState<string | null>(null);
  const [uploadingTenantId, setUploadingTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!hostelId) {
      setLoading(false);
      return;
    }
    loadData(hostelId);
  }, [isReady, hostelId]);

  // Auto-open onboarding form if ?onboard=true in URL (from dashboard button)
  useEffect(() => {
    if (searchParams.get('onboard') === 'true' && isReady && hasHostel) {
      setOnboardingOpen(true);
      // Clean up the URL param without re-navigating
      router.replace('/app/tenants', { scroll: false });
    }
  }, [searchParams, isReady, hasHostel]);

  useEffect(() => {
    const tenant = aadhaarPreviewTenant;
    if (!tenant?.id_proof_url) {
      setAadhaarPreviewUrl(null);
      setAadhaarPreviewContentType('');
      setAadhaarPreviewLoading(false);
      setAadhaarPreviewError('');
      return;
    }
    const documentPath = tenant.id_proof_url;

    let cancelled = false;
    let objectUrl: string | null = null;
    setAadhaarPreviewUrl(null);
    setAadhaarPreviewContentType('');
    setAadhaarPreviewError('');
    setAadhaarPreviewLoading(true);

    async function loadDocument() {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .download(documentPath);

      if (cancelled) return;
      if (error) {
        setAadhaarPreviewError(error.message);
        setAadhaarPreviewLoading(false);
        return;
      }

      objectUrl = URL.createObjectURL(data);
      setAadhaarPreviewUrl(objectUrl);
      setAadhaarPreviewContentType(data.type);
      setAadhaarPreviewLoading(false);
    }

    void loadDocument().catch((error: unknown) => {
      if (cancelled) return;
      setAadhaarPreviewError(error instanceof Error ? error.message : 'Unable to load this ID document.');
      setAadhaarPreviewLoading(false);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [aadhaarPreviewTenant]);

  async function loadData(hostelId: string) {
    setLoading(true);
    const [{ data: tenantData }, { data: roomData }, { data: invoiceData }] = await Promise.all([
      supabase.from('tenants').select('*').eq('hostel_id', hostelId).order('created_at', { ascending: false }),
      supabase.from('rooms').select('*, beds(*)').eq('hostel_id', hostelId).order('room_number'),
      supabase.from('invoices').select('*').eq('hostel_id', hostelId).order('created_at', { ascending: false }),
    ]);
    setTenants((tenantData || []) as Tenant[]);
    setRooms((roomData || []) as Room[]);
    setInvoices((invoiceData || []) as Invoice[]);
    setLoading(false);
  }

  const tenantRoomMap = useMemo(() => {
    const map: Record<string, { roomNumber: string; bedLabel: string }> = {};
    rooms.forEach((r) => {
      r.beds?.forEach((b) => {
        if (b.tenant_id) {
          map[b.tenant_id] = { roomNumber: r.room_number, bedLabel: b.bed_label };
        }
      });
    });
    return map;
  }, [rooms]);

  const filteredTenants = tenants.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search && !t.full_name.toLowerCase().includes(search.toLowerCase()) && !t.phone.includes(search)) return false;
    return true;
  });



  async function toggleAICalls(tenantId: string, current: boolean) {
    const { error } = await supabase
      .from('tenants')
      .update({ pause_ai_calls: !current })
      .eq('id', tenantId);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
      return;
    }

    setTenants(tenants.map((t) => (t.id === tenantId ? { ...t, pause_ai_calls: !current } : t)));
    toast({ title: !current ? 'AI calls paused' : 'AI calls resumed', description: `For ${tenants.find(t => t.id === tenantId)?.full_name}` });
  }

  // Calculate Tenant Score and Payment Metrics
  function getTenantMetrics(tenant: Tenant) {
    const tInvoices = invoices.filter((i) => i.tenant_id === tenant.id);
    const overdueCount = tInvoices.filter((i) => i.status === 'overdue').length;
    const paidCount = tInvoices.filter((i) => i.status === 'paid').length;
    
    let score = 100;
    if (overdueCount > 0) score -= overdueCount * 25;
    score = Math.max(45, Math.min(100, score));

    let ratingText = '⭐ 98/100 — Excellent Standing';
    let ratingColor = 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    if (score < 70) {
      ratingText = '⚠️ 60/100 — Late Payment Defaults';
      ratingColor = 'text-red-600 bg-red-500/10 border-red-500/20';
    } else if (score < 90) {
      ratingText = '⚡ 85/100 — Good Standing';
      ratingColor = 'text-amber-600 bg-amber-500/10 border-amber-500/20';
    }

    return { score, ratingText, ratingColor, tInvoices, overdueCount, paidCount };
  }

  async function downloadAadhaar(tenant: Tenant) {
    if (!tenant.id_proof_url) {
      toast({ title: 'No ID document uploaded', variant: 'destructive' });
      return;
    }

    setDownloadingTenantId(tenant.id);
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .download(tenant.id_proof_url);
      if (error) throw error;

      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      const extension = tenant.id_proof_url.split('.').pop() || 'file';
      const safeName = tenant.full_name.trim().replace(/[^\w.-]+/g, '_');
      link.href = objectUrl;
      link.download = `${safeName}_ID.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({ title: 'ID document downloaded', description: `Saved ${link.download}` });
    } catch (error) {
      toast({
        title: 'Unable to download ID document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingTenantId(null);
    }
  }

  async function uploadTenantIdProof(tenant: Tenant, file: File) {
    if (!hostelId || !profile?.id) {
      toast({ title: 'Unable to identify your account', description: 'Refresh the page and try again.', variant: 'destructive' });
      return;
    }

    setUploadingTenantId(tenant.id);
    let uploadedPath: string | null = null;
    let didUpload = false;
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const documentPath = `${profile.id}/kyc/${Date.now()}.${fileExt}`;
      uploadedPath = documentPath;
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(documentPath, file);
      if (uploadError) throw uploadError;
      didUpload = true;

      const { error: updateError } = await supabase
        .from('tenants')
        .update({ id_proof_url: documentPath })
        .eq('id', tenant.id)
        .eq('hostel_id', hostelId)
        .select('id')
        .single();
      if (updateError) throw updateError;

      setTenants((current) => current.map((item) => (
        item.id === tenant.id ? { ...item, id_proof_url: documentPath } : item
      )));
      setSelectedTenant((current) => (
        current?.id === tenant.id ? { ...current, id_proof_url: documentPath } : current
      ));
      toast({ title: 'ID document uploaded', description: `Saved the document for ${tenant.full_name}.` });
    } catch (error) {
      if (didUpload && uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from('kyc-documents')
          .remove([uploadedPath]);
        if (cleanupError) console.error('Unable to remove the failed ID document upload:', cleanupError);
      }
      toast({
        title: 'Unable to upload ID document',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingTenantId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <Users className="w-8 h-8 opacity-50" />
          <p>Loading tenants...</p>
        </div>
      </div>
    );
  }

  if (isReady && !hasHostel) {
    return <NoHostelLinked />;
  }

  const totalCount = tenants.length;
  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const leaveCount = tenants.filter((t) => t.status === 'on_leave').length;
  const inactiveCount = tenants.filter((t) => t.status === 'inactive').length;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage resident profiles, Aadhaar KYC, rent scores & onboarding.
          </p>
        </div>
        <Button onClick={() => setOnboardingOpen(true)} className="shadow-lg shadow-primary/20 w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" /> Onboard Tenant
        </Button>
      </div>

      {/* KPI Stats Cards - 2 side-by-side on mobile, matching Rooms & Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Total Tenants', value: totalCount, sub: 'Registered residents', color: 'from-blue-500/20 to-blue-400/5 border-blue-400/40 text-blue-600', icon: Users },
          { label: 'Active', value: activeCount, sub: 'Currently staying', color: 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600', icon: CheckCircle2 },
          { label: 'On Leave', value: leaveCount, sub: 'Temporarily away', color: 'from-amber-500/20 to-amber-400/5 border-amber-400/40 text-amber-600', icon: Clock },
          { label: 'Inactive', value: inactiveCount, sub: 'Checked out', color: 'from-slate-500/20 to-slate-400/5 border-slate-400/40 text-slate-600', icon: X },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border bg-gradient-to-br p-3.5 sm:p-4 ${s.color} transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between`}>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] sm:text-xs font-semibold opacity-85 truncate">{s.label}</span>
                <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur-sm shadow-sm shrink-0">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate">{s.value}</p>
                <p className="text-[10px] sm:text-xs opacity-70 mt-0.5 truncate">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="bg-card border rounded-2xl p-2 flex flex-col sm:flex-row gap-2 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none text-sm"
          />
        </div>
        <div className="h-px sm:h-8 w-full sm:w-px bg-border my-1 sm:my-0" />
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="h-9 bg-transparent border-none p-0 space-x-1 w-full sm:w-auto justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="all" className="data-[state=active]:bg-secondary rounded-xl text-xs">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-xl text-xs">Active</TabsTrigger>
            <TabsTrigger value="on_leave" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl text-xs">On Leave</TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-secondary rounded-xl text-xs">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tenant Grid - 2 side-by-side per row on mobile */}
      {filteredTenants.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-20 text-center gap-4 bg-card/50">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No Tenants Found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-sm">
              {search ? 'No tenants match your search criteria.' : 'You haven’t onboarded any tenants yet.'}
            </p>
          </div>
          {!search && (
            <Button onClick={() => setOnboardingOpen(true)} variant="outline" className="mt-2">
              <UserPlus className="w-4 h-4 mr-2" /> Start Onboarding
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
          {filteredTenants.map((tenant) => {
            const allocation = tenantRoomMap[tenant.id];
            const initials = tenant.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div
                key={tenant.id}
                className="group flex flex-col rounded-xl sm:rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                {/* Banner */}
                <div
                  className={`h-7 sm:h-10 w-full ${
                    tenant.status === 'active'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/5'
                      : tenant.status === 'on_leave'
                      ? 'bg-gradient-to-r from-amber-500/20 to-amber-400/5'
                      : 'bg-gradient-to-r from-secondary to-muted'
                  }`}
                />

                <div className="px-3 sm:px-5 pb-3 sm:pb-5 -mt-4 sm:-mt-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Avatar & Badge */}
                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-background border-2 sm:border-4 border-card shadow-sm flex items-center justify-center shrink-0 text-sm sm:text-lg font-black text-primary">
                        {initials}
                      </div>
                      <Badge
                        variant={tenant.status === 'active' ? 'default' : tenant.status === 'on_leave' ? 'secondary' : 'outline'}
                        className="mt-1 text-[10px] sm:text-xs capitalize px-1.5 sm:px-2"
                      >
                        {tenant.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Info */}
                    <h3 className="text-sm sm:text-base font-bold truncate leading-tight">{tenant.full_name}</h3>
                    <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-primary shrink-0" />
                      {tenant.phone}
                    </p>

                    {/* Room & Rent Details */}
                    <div className="my-2.5 p-2 sm:p-3 rounded-lg bg-secondary/60 space-y-1.5 text-[11px] sm:text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Room</span>
                        <span className="font-semibold text-foreground truncate max-w-[90px]">
                          {allocation ? `#${allocation.roomNumber} (${allocation.bedLabel})` : 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Rent</span>
                        <span className="font-semibold text-foreground">₹{Number(tenant.monthly_rent).toLocaleString('en-IN')}/mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedTenant(tenant)}
                      className="w-full h-8 text-[11px] sm:text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                    >
                      <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 shrink-0" />
                      View
                    </Button>

                    <a href={`tel:${tenant.phone}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full h-8 text-[11px] sm:text-xs">
                        <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 text-primary shrink-0" />
                        Call
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TENANT DETAILS MODAL ── */}
      {selectedTenant && (
        <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
          <DialogContent className="w-[calc(100vw-32px)] sm:w-auto max-w-2xl max-h-[85vh] overflow-y-auto p-0 bg-card border-border rounded-2xl shadow-2xl mx-auto my-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-x-hidden">
            {(() => {
              const metrics = getTenantMetrics(selectedTenant);
              const allocation = tenantRoomMap[selectedTenant.id];
              const initials = selectedTenant.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const checkInDate = selectedTenant.agreement_start
                ? new Date(selectedTenant.agreement_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(selectedTenant.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div className="overflow-x-hidden">
                  {/* Modal Banner */}
                  <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-4 sm:p-6 text-white relative">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-lg sm:text-2xl font-black text-white shrink-0 shadow-lg backdrop-blur-sm">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-2xl font-extrabold truncate max-w-[160px] sm:max-w-none">{selectedTenant.full_name}</h2>
                          <Badge variant="outline" className="bg-white/20 border-white/40 text-white uppercase text-[10px] shrink-0">
                            {selectedTenant.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-indigo-100 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {selectedTenant.phone}
                          {selectedTenant.email && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" /> {selectedTenant.email}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {/* Tenant Reliability Score */}
                    <div className={`p-4 rounded-xl border ${metrics.ratingColor} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Award className="w-4 h-4" />
                          <span>Tenant Reliability & Rent Score</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background/80 shadow-sm">
                          {metrics.ratingText}
                        </span>
                      </div>
                      <p className="text-xs opacity-90">
                        Calculated based on prompt rent payments. {metrics.overdueCount === 0 ? '✨ Excellent track record — 0 late payments.' : `⚠️ ${metrics.overdueCount} overdue instances recorded.`}
                      </p>
                    </div>

                    {/* Basic & Room Details */}
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /> Date of Joining</span>
                        <p className="font-bold text-sm text-foreground mt-1">{checkInDate}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><DoorOpen className="w-3.5 h-3.5 text-primary" /> Room & Bed</span>
                        <p className="font-bold text-sm text-foreground mt-1">
                          {allocation ? `Room #${allocation.roomNumber} (${allocation.bedLabel})` : 'Unassigned'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5 text-primary" /> Monthly Rent</span>
                        <p className="font-bold text-sm text-foreground mt-1">₹{Number(selectedTenant.monthly_rent).toLocaleString('en-IN')}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Security Deposit</span>
                        <p className="font-bold text-sm text-foreground mt-1">₹{Number(selectedTenant.security_deposit).toLocaleString('en-IN')}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Rent Due Day</span>
                        <p className="font-bold text-sm text-foreground mt-1">Day {selectedTenant.rent_due_day} of month</p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" /> Emergency Contact</span>
                        <p className="font-bold text-sm text-foreground mt-1 truncate">{selectedTenant.emergency_contact_phone || 'Not provided'}</p>
                      </div>
                    </div>

                    {/* Aadhaar Card & KYC Section */}
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                            {selectedTenant.id_proof_type.replace(/_/g, ' ')} Document
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={selectedTenant.id_proof_url
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                            : 'text-muted-foreground text-[10px]'}
                        >
                          {selectedTenant.id_proof_url ? 'Document uploaded' : 'No document uploaded'}
                        </Badge>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-indigo-100 dark:border-indigo-950 text-xs gap-2.5">
                        <div>
                          <p className="text-muted-foreground text-[11px]">Identity document</p>
                          <p className="font-bold text-sm text-foreground">
                            {selectedTenant.id_proof_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`tenant-id-upload-${selectedTenant.id}`}
                            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 px-2 text-xs font-medium text-foreground ${uploadingTenantId === selectedTenant.id ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}
                          >
                            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            {uploadingTenantId === selectedTenant.id
                              ? 'Uploading...'
                              : selectedTenant.id_proof_url ? 'Replace' : 'Upload'}
                          </label>
                          <Input
                            id={`tenant-id-upload-${selectedTenant.id}`}
                            type="file"
                            accept="image/*,.pdf"
                            disabled={uploadingTenantId === selectedTenant.id}
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              if (file) void uploadTenantIdProof(selectedTenant, file);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAadhaarPreviewTenant(selectedTenant)}
                            disabled={!selectedTenant.id_proof_url}
                            className="h-8 text-xs flex-1 sm:flex-none bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950 border-indigo-300 dark:border-indigo-800"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" /> View document
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => void downloadAadhaar(selectedTenant)}
                            disabled={!selectedTenant.id_proof_url || downloadingTenantId === selectedTenant.id}
                            className="h-8 text-xs flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            {downloadingTenantId === selectedTenant.id ? 'Downloading...' : 'Download'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" /> Tenant Payment History ({metrics.tInvoices.length})
                      </h4>
                      {metrics.tInvoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic bg-secondary/40 p-3 rounded-xl">No invoices or payment history recorded yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {metrics.tInvoices.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border bg-card text-xs">
                              <div>
                                <p className="font-mono font-bold text-foreground">{inv.invoice_number}</p>
                                <p className="text-muted-foreground text-[10px]">Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-foreground">₹{Number(inv.amount).toLocaleString('en-IN')}</p>
                                <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                                  {inv.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* ── ID DOCUMENT PREVIEW DIALOG ── */}
      {aadhaarPreviewTenant && (
        <Dialog open={!!aadhaarPreviewTenant} onOpenChange={(open) => !open && setAadhaarPreviewTenant(null)}>
          <DialogContent className="max-w-md p-6 bg-card border-border rounded-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <FileText className="w-5 h-5 text-indigo-600" /> ID Document Preview
              </DialogTitle>
              <DialogDescription className="text-xs">
                {aadhaarPreviewTenant.id_proof_type.replace(/_/g, ' ')} for {aadhaarPreviewTenant.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 min-h-48 rounded-xl border border-indigo-500/30 bg-secondary/30 flex items-center justify-center overflow-auto">
              {aadhaarPreviewLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading ID document...</p>
              ) : aadhaarPreviewError ? (
                <p className="p-6 text-sm text-destructive">Unable to load ID document: {aadhaarPreviewError}</p>
              ) : aadhaarPreviewUrl && aadhaarPreviewContentType.startsWith('image/') ? (
                <Image
                  src={aadhaarPreviewUrl}
                  alt={`${aadhaarPreviewTenant.id_proof_type.replace(/_/g, ' ')} for ${aadhaarPreviewTenant.full_name}`}
                  width={1200}
                  height={800}
                  unoptimized
                  className="max-h-[60vh] w-full object-contain"
                />
              ) : aadhaarPreviewUrl && (
                aadhaarPreviewContentType === 'application/pdf' ||
                aadhaarPreviewTenant.id_proof_url?.toLowerCase().endsWith('.pdf')
              ) ? (
                <iframe
                  src={aadhaarPreviewUrl}
                  title={`${aadhaarPreviewTenant.id_proof_type.replace(/_/g, ' ')} for ${aadhaarPreviewTenant.full_name}`}
                  className="h-[60vh] w-full"
                />
              ) : aadhaarPreviewUrl ? (
                <a href={aadhaarPreviewUrl} target="_blank" rel="noreferrer" className="p-6 text-sm text-primary underline">
                  Open uploaded document
                </a>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">No ID document was uploaded for this tenant.</p>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setAadhaarPreviewTenant(null)} size="sm">
                Close
              </Button>
              <Button
                onClick={() => void downloadAadhaar(aadhaarPreviewTenant)}
                disabled={!aadhaarPreviewTenant.id_proof_url || downloadingTenantId === aadhaarPreviewTenant.id}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {downloadingTenantId === aadhaarPreviewTenant.id ? 'Downloading...' : 'Download original'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modern Onboarding Dialog Component with centered steps */}
      <OnboardTenantDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        hostelId={hostelId}
        userId={profile?.id}
        onSuccess={() => {
          if (hostelId) void loadData(hostelId);
        }}
      />
    </div>
  );
}
