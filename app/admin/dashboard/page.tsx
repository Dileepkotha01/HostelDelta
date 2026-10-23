'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/admin-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp,
  Building2,
  Users,
  BedDouble,
  Receipt,
  PlusCircle,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { Hostel } from '@/lib/types';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    stats,
    hostelOverviews,
    hostels,
    tenants,
    payments,
    invoices,
    loading,
    createHostel,
    recordPayment,
    selectedHostelId,
    setSelectedHostelId,
    platformCommissionRate,
  } = useAdmin();

  // Modal states
  const [createHostelOpen, setCreateHostelOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New hostel form state
  const [newHostelName, setNewHostelName] = useState('');
  const [newHostelCity, setNewHostelCity] = useState('');
  const [newHostelState, setNewHostelState] = useState('');
  const [newHostelFloors, setNewHostelFloors] = useState('3');
  const [newHostelRooms, setNewHostelRooms] = useState('12');
  const [newHostelBillingDay, setNewHostelBillingDay] = useState('5');

  // New payment form state
  const [payHostelId, setPayHostelId] = useState('');
  const [payTenantId, setPayTenantId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'upi' | 'cash' | 'card' | 'bank_transfer' | 'razorpay'>('upi');
  const [payNotes, setPayNotes] = useState('');

  // Handle create hostel
  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostelName.trim()) return;

    setSubmitting(true);
    await createHostel({
      name: newHostelName.trim(),
      city: newHostelCity.trim(),
      state: newHostelState.trim(),
      total_floors: parseInt(newHostelFloors, 10) || 1,
      total_rooms: parseInt(newHostelRooms, 10) || 1,
      billing_day: parseInt(newHostelBillingDay, 10) || 1,
      currency: 'INR',
    });
    setSubmitting(false);
    setCreateHostelOpen(false);
    setNewHostelName('');
    setNewHostelCity('');
    setNewHostelState('');
  };

  // Handle record payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payHostelId || !payTenantId || !payAmount) return;

    setSubmitting(true);
    await recordPayment({
      hostel_id: payHostelId,
      tenant_id: payTenantId,
      amount: parseFloat(payAmount),
      method: payMethod,
      status: 'completed',
      notes: payNotes,
    });
    setSubmitting(false);
    setRecordPaymentOpen(false);
    setPayAmount('');
    setPayNotes('');
  };

  // Filter tenants for selected hostel in payment modal
  const paymentModalTenants = tenants.filter(
    (t) => !payHostelId || t.hostel_id === payHostelId
  );

  // Platform commissions calculation
  const platformEarnings = Math.round((stats.totalRevenue * platformCommissionRate) / 100);

  // Payment method breakdown
  const paymentMethodsSummary = React.useMemo(() => {
    const summary: Record<string, number> = { upi: 0, cash: 0, card: 0, bank_transfer: 0, razorpay: 0 };
    payments
      .filter((p) => p.status === 'completed')
      .forEach((p) => {
        const method = p.method in summary ? p.method : 'upi';
        summary[method] += Number(p.amount) || 0;
      });
    return summary;
  }, [payments]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Super Admin Command Center
            </h1>
            <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/40 text-xs">
              Live Platform
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Unified oversight of all hostels, global collections, active occupancy, and revenue streams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="h-9 text-xs border-border bg-card/80 text-foreground/90 hover:bg-secondary hover:text-foreground flex items-center gap-1.5"
            onClick={() => {
              if (hostels.length > 0) {
                setPayHostelId(hostels[0].id);
              }
              setRecordPaymentOpen(true);
            }}
          >
            <Receipt className="h-3.5 w-3.5 text-indigo-400" />
            <span>Record Global Payment</span>
          </Button>

          <Button
            className="h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-foreground font-medium shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
            onClick={() => setCreateHostelOpen(true)}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add New Hostel</span>
          </Button>
        </div>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Metric 1: Total Platform Revenue */}
        <Card className="bg-gradient-to-br from-card via-card to-indigo-950/40 border-border/80 shadow-lg relative overflow-hidden group hover:border-border transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Platform Revenue
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              ₹{stats.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="text-emerald-400 font-semibold flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
                {payments.filter((p) => p.status === 'completed').length} Payments
              </span>
              <span>•</span>
              <span className="text-muted-foreground">Across {stats.totalHostels} Hostels</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Pending Receivables */}
        <Card className="bg-gradient-to-br from-card via-card to-amber-950/30 border-border/80 shadow-lg relative overflow-hidden group hover:border-border transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Receivables
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              ₹{stats.pendingRevenue.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="text-amber-400 font-semibold">
                {invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length} Invoices Pending
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Global Occupancy */}
        <Card className="bg-gradient-to-br from-card via-card to-indigo-950/40 border-border/80 shadow-lg relative overflow-hidden group hover:border-border transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Global Bed Occupancy
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BedDouble className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {stats.occupancyRate}%
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.occupiedBeds}/{stats.totalBeds} Beds
              </span>
            </div>
            <Progress value={stats.occupancyRate} className="h-2 mt-3 bg-secondary" />
          </CardContent>
        </Card>

        {/* Metric 4: Platform Scale */}
        <Card className="bg-gradient-to-br from-card via-card to-purple-950/30 border-border/80 shadow-lg relative overflow-hidden group hover:border-border transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Network Capacity
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {stats.totalHostels} <span className="text-base font-normal text-muted-foreground">Hostels</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{stats.totalRooms} Rooms</span>
              <span>•</span>
              <span className="text-purple-300 font-semibold">{stats.totalTenants} Active Tenants</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Hostel Performance Table */}
      <Card className="bg-card/90 border-border shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-400" />
              All Hostels Performance Matrix
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Comparative capacity, occupancy, and financial collection performance per property.
            </CardDescription>
          </div>
          <Link href="/admin/hostels">
            <Button variant="ghost" size="sm" className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-secondary">
              <span>View Hostels Directory</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/60 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Hostel Name & Location</th>
                  <th className="py-3 px-4">Owner / Contact</th>
                  <th className="py-3 px-4">Rooms / Beds</th>
                  <th className="py-3 px-4">Occupancy</th>
                  <th className="py-3 px-4">Revenue Collected</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {hostelOverviews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground/70 text-sm">
                      No hostels registered yet. Click &quot;Add New Hostel&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  hostelOverviews.map((hostel) => (
                    <tr key={hostel.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{hostel.name}</span>
                          {selectedHostelId === hostel.id && (
                            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] h-4">
                              Scoped
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {hostel.city ? `${hostel.city}, ${hostel.state || 'India'}` : 'Location unconfigured'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-foreground/90 text-xs font-medium">{hostel.owner_name}</div>
                        <div className="text-[11px] text-muted-foreground/70">{hostel.owner_email || 'No email'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-foreground/80">
                        <span>{hostel.rooms_count} rooms</span>
                        <span className="text-muted-foreground/70"> • </span>
                        <span>{hostel.beds_count} beds</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground min-w-[32px]">
                            {hostel.occupancy_rate}%
                          </span>
                          <div className="w-16 bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full"
                              style={{ width: `${hostel.occupancy_rate}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/70">
                          {hostel.occupied_beds_count} occupied
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-400 text-xs">
                          ₹{(hostel.total_revenue || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-amber-400 text-xs">
                          ₹{(hostel.pending_revenue || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-secondary"
                            onClick={() => {
                              setSelectedHostelId(hostel.id);
                            }}
                          >
                            Scope
                          </Button>
                          <Link href="/admin/hostels">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs border-border bg-card text-foreground/80 hover:text-foreground"
                            >
                              Manage
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Grid: Financial Breakdown & Recent Global Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Financial & Commission Overview */}
        <Card className="bg-card/90 border-border shadow-xl lg:col-span-1">
          <CardHeader className="border-b border-border/80 pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Payment Channels & Commission
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Aggregated collection breakdown by method
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Commission Widget */}
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                <span>Platform Earnings ({platformCommissionRate}%)</span>
                <span className="font-bold text-foreground text-sm">
                  ₹{platformEarnings.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Calculated on ₹{stats.totalRevenue.toLocaleString('en-IN')} total gross collections.
              </p>
            </div>

            {/* Methods Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-indigo-400" /> UPI / QR Codes
                </span>
                <span className="font-semibold text-foreground">
                  ₹{paymentMethodsSummary.upi.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Cash Collections
                </span>
                <span className="font-semibold text-foreground">
                  ₹{paymentMethodsSummary.cash.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" /> Bank Transfers
                </span>
                <span className="font-semibold text-foreground">
                  ₹{paymentMethodsSummary.bank_transfer.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-400" /> Razorpay Gateway
                </span>
                <span className="font-semibold text-foreground">
                  ₹{paymentMethodsSummary.razorpay.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/admin/revenue">
                <Button variant="outline" size="sm" className="w-full text-xs border-border bg-card text-foreground/80 hover:text-foreground">
                  <span>Detailed Revenue Analytics</span>
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Recent Global Transactions Feed */}
        <Card className="bg-card/90 border-border shadow-xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/80 pb-3">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-400" />
                Live Global Payments Feed
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Latest transactions recorded across all properties
              </CardDescription>
            </div>
            <Link href="/admin/payments">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-400 hover:text-indigo-300">
                <span>View All ({payments.length})</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto">
              {payments.slice(0, 6).map((payment) => {
                const tenant = tenants.find((t) => t.id === payment.tenant_id);
                const hostel = hostels.find((h) => h.id === payment.hostel_id);
                const paymentDate = payment.created_at
                  ? new Date(payment.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent';

                return (
                  <div key={payment.id} className="p-3.5 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                        ₹
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {tenant?.full_name || 'Tenant Payment'}
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className="text-indigo-300">{hostel?.name || 'Hostel'}</span>
                          <span>•</span>
                          <span className="uppercase text-[10px] px-1 rounded bg-secondary text-foreground/80">
                            {payment.method}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-xs sm:text-sm">
                        +₹{Number(payment.amount).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">{paymentDate}</div>
                    </div>
                  </div>
                );
              })}

              {payments.length === 0 && (
                <div className="py-8 text-center text-muted-foreground/70 text-xs">
                  No payment records found yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= MODAL: ADD NEW HOSTEL ================= */}
      <Dialog open={createHostelOpen} onOpenChange={setCreateHostelOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              Add New Hostel to Platform
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new property on HostelHub. It will instantly connect to the global database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateHostel} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Hostel Name *</Label>
              <Input
                required
                placeholder="e.g. Royal Palms Executive PG"
                className="bg-background border-border text-sm text-foreground mt-1"
                value={newHostelName}
                onChange={(e) => setNewHostelName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">City</Label>
                <Input
                  placeholder="e.g. Bengaluru"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={newHostelCity}
                  onChange={(e) => setNewHostelCity(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">State</Label>
                <Input
                  placeholder="e.g. Karnataka"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={newHostelState}
                  onChange={(e) => setNewHostelState(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">Total Floors</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={newHostelFloors}
                  onChange={(e) => setNewHostelFloors(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Total Rooms</Label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={newHostelRooms}
                  onChange={(e) => setNewHostelRooms(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Billing Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={newHostelBillingDay}
                  onChange={(e) => setNewHostelBillingDay(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCreateHostelOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-foreground text-xs font-semibold"
              >
                {submitting ? 'Creating...' : 'Create Property'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: RECORD GLOBAL PAYMENT ================= */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-400" />
              Record Global Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Log an offline or direct payment for any tenant in the platform.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Select Hostel *</Label>
              <Select value={payHostelId} onValueChange={(val) => { setPayHostelId(val); setPayTenantId(''); }}>
                <SelectTrigger className="bg-background border-border text-xs text-foreground mt-1">
                  <SelectValue placeholder="Choose Hostel" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground/90">
                  {hostels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-foreground/80">Select Tenant *</Label>
              <Select value={payTenantId} onValueChange={setPayTenantId} disabled={!payHostelId}>
                <SelectTrigger className="bg-background border-border text-xs text-foreground mt-1">
                  <SelectValue placeholder={payHostelId ? "Choose Tenant" : "Select a hostel first"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground/90">
                  {paymentModalTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name} ({t.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-foreground/80">Amount (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="e.g. 8500"
                  className="bg-background border-border text-sm text-foreground mt-1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Payment Method</Label>
                <Select value={payMethod} onValueChange={(val) => setPayMethod(val as any)}>
                  <SelectTrigger className="bg-background border-border text-xs text-foreground mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground/90">
                    <SelectItem value="upi">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="cash">Cash in Hand</SelectItem>
                    <SelectItem value="bank_transfer">Bank NEFT / IMPS</SelectItem>
                    <SelectItem value="card">Card Swipe</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-foreground/80">Notes / Reference ID</Label>
              <Input
                placeholder="e.g. UTR #8291024 / Cash handed to owner"
                className="bg-background border-border text-sm text-foreground mt-1"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setRecordPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !payHostelId || !payTenantId || !payAmount}
                className="bg-indigo-600 hover:bg-indigo-500 text-foreground text-xs font-semibold"
              >
                {submitting ? 'Recording...' : 'Save Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
