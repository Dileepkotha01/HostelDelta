'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Receipt,
  IndianRupee,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  Smartphone,
  CreditCard,
  Building,
  Calendar,
  Wallet
} from 'lucide-react';
import type { Invoice, Payment, PaymentMethod, Tenant } from '@/lib/types';

export default function PaymentsPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<(Invoice & { tenant?: Tenant; payments?: Payment[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recordPaymentFor, setRecordPaymentFor] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!hostelId) {
      setLoading(false);
      return;
    }
    loadData(hostelId);
  }, [isReady, hostelId]);

  async function loadData(hostelId: string) {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*, tenant:tenants(*), payments(*)')
      .eq('hostel_id', hostelId)
      .order('created_at', { ascending: false });
    setInvoices((data || []) as (Invoice & { tenant?: Tenant; payments?: Payment[] })[]);
    setLoading(false);
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase()) && !inv.tenant?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [invoices, statusFilter, search]);

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const totalCollected = invoices.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
    const totalPending = invoices.reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)), 0);
    const totalOverdue = invoices
      .filter((i) => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < now))
      .reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)), 0);

    const paidCount = invoices.filter((i) => i.status === 'paid').length;
    const pendingCount = invoices.filter((i) => i.status !== 'paid').length;
    const overdueCount = invoices.filter((i) => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.due_date) < now)).length;
    const totalInvoices = invoices.length;

    return { totalCollected, totalPending, totalOverdue, paidCount, pendingCount, overdueCount, totalInvoices };
  }, [invoices]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.hostel_id || !recordPaymentFor) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('payments').insert({
        invoice_id: recordPaymentFor.id,
        tenant_id: recordPaymentFor.tenant_id,
        hostel_id: profile.hostel_id,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        status: 'completed',
        recorded_by: profile.id,
        notes: paymentNotes,
      });

      if (error) throw error;

      const newPaid = Number(recordPaymentFor.amount_paid) + parseFloat(paymentAmount);
      const newStatus = newPaid >= Number(recordPaymentFor.amount) ? 'paid' : 'partial';

      await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', recordPaymentFor.id);

      toast({ title: 'Payment recorded successfully', description: `₹${paymentAmount} collected via ${paymentMethod}` });
      setRecordPaymentFor(null);
      setPaymentAmount('');
      setPaymentNotes('');
      loadData(profile.hostel_id);
    } catch (err) {
      toast({ title: 'Failed to record payment', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
    setSubmitting(false);
  }

  function exportCSV() {
    const headers = ['Invoice #', 'Tenant', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number,
      inv.tenant?.full_name || '',
      inv.amount,
      inv.amount_paid,
      Number(inv.amount) - Number(inv.amount_paid),
      inv.due_date,
      inv.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse"><Receipt className="w-8 h-8 opacity-50" /><p>Loading finances...</p></div></div>;
  }

  if (isReady && !hasHostel) {
    return <NoHostelLinked />;
  }

  const statCards = [
    {
      label: 'Total Collected',
      value: `₹${stats.totalCollected.toLocaleString('en-IN')}`,
      sub: `${stats.paidCount} cleared`,
      icon: IndianRupee,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-400/5 border-emerald-400/40 text-emerald-600',
    },
    {
      label: 'Pending Dues',
      value: `₹${stats.totalPending.toLocaleString('en-IN')}`,
      sub: `${stats.pendingCount} unpaid`,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'from-amber-500/20 to-amber-400/5 border-amber-400/40 text-amber-600',
    },
    {
      label: 'Overdue Amount',
      value: `₹${stats.totalOverdue.toLocaleString('en-IN')}`,
      sub: `${stats.overdueCount} overdue`,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'from-red-500/20 to-red-400/5 border-red-400/40 text-red-600',
    },
    {
      label: 'Total Invoices',
      value: `${stats.totalInvoices}`,
      sub: `${stats.paidCount}/${stats.totalInvoices} settled`,
      icon: Receipt,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'from-blue-500/20 to-blue-400/5 border-blue-400/40 text-blue-600',
    },
  ];

  const methodIcons: Record<PaymentMethod, typeof Banknote> = {
    cash: Banknote,
    upi: Smartphone,
    card: CreditCard,
    bank_transfer: Banknote,
    razorpay: Smartphone,
    stripe: CreditCard,
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-2 font-medium">Manage rent collection, invoices, and payment history.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="shadow-sm w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" /> Export Data
        </Button>
      </div>

      {/* KPI Stats - 2 side-by-side on mobile, matching rooms page style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 sm:p-4 transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between ${stat.bg}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] sm:text-xs font-semibold opacity-85 truncate">
                  {stat.label}
                </span>
                <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur-sm shadow-sm shrink-0">
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color}`} />
                </div>
              </div>
              <div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate">
                  {stat.value}
                </p>
                <p className="text-[10px] sm:text-xs opacity-70 mt-0.5 truncate">
                  {stat.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-2xl p-2 flex flex-col sm:flex-row gap-2 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoice or tenant name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none" />
        </div>
        <div className="h-px sm:h-8 w-full sm:w-px bg-border my-1 sm:my-0" />
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="h-10 bg-transparent border-none p-0 space-x-1 w-full sm:w-auto justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="all" className="data-[state=active]:bg-secondary rounded-xl">All</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl">Pending</TabsTrigger>
            <TabsTrigger value="partial" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-xl">Partial</TabsTrigger>
            <TabsTrigger value="paid" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-xl">Paid</TabsTrigger>
            <TabsTrigger value="overdue" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600 rounded-xl">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Invoice List - 2 side-by-side per row on mobile */}
      {filteredInvoices.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-20 text-center gap-4 bg-card/50">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Receipt className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No Invoices</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-sm">
              Invoices will automatically appear here when tenants are onboarded and on billing dates.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className={`flex flex-col justify-between p-4 sm:p-5 rounded-2xl border bg-card hover:shadow-lg transition-all duration-200 gap-3 ${
                inv.status === 'paid'
                  ? 'hover:border-emerald-500/50'
                  : inv.status === 'overdue'
                  ? 'border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20'
                  : 'hover:border-primary/50'
              }`}
            >
              {/* Header: Avatar / Status icon + Badge */}
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    inv.status === 'paid'
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                      : inv.status === 'overdue'
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-600'
                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
                  }`}
                >
                  {inv.status === 'paid' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : inv.status === 'overdue' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>

                <Badge
                  variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'}
                  className="capitalize text-xs px-2 py-0.5"
                >
                  {inv.status}
                </Badge>
              </div>

              {/* Tenant info */}
              <div>
                <h4 className="font-bold text-base truncate leading-tight">{inv.tenant?.full_name || 'Resident'}</h4>
                <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">{inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" /> Due: {new Date(inv.due_date).toLocaleDateString()}
                </p>
              </div>

              {/* Amounts & Action */}
              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-foreground">₹{Number(inv.amount).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-muted-foreground">Paid: ₹{Number(inv.amount_paid).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {inv.status !== 'paid' ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setRecordPaymentFor(inv);
                      setPaymentAmount(String(Number(inv.amount) - Number(inv.amount_paid)));
                    }}
                    className={`w-full h-8 text-[11px] sm:text-xs shadow-md ${
                      inv.status === 'overdue' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 shrink-0" /> Collect
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled className="w-full h-8 text-[11px] opacity-70 bg-secondary/50">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Settled
                  </Button>
                )}
              </div>
              
              {/* Expandable Payment History if any */}
              {inv.payments && inv.payments.length > 0 && (
                <div className="w-full mt-4 p-3 bg-secondary/50 rounded-xl space-y-2 text-sm">
                  <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Payment History</p>
                  {inv.payments.map((p) => {
                    const Icon = methodIcons[p.method] || Banknote;
                    return (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-background flex items-center justify-center shadow-sm">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="capitalize font-medium">{p.method.replace('_', ' ')}</span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">· {new Date(p.created_at).toLocaleString()}</span>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+ ₹{Number(p.amount).toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={!!recordPaymentFor} onOpenChange={(open) => { if (!open) setRecordPaymentFor(null); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border rounded-3xl shadow-2xl">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Record Payment
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Collecting for <strong className="text-foreground">{recordPaymentFor?.tenant?.full_name}</strong>
                <br />
                Invoice <span className="font-mono text-xs">{recordPaymentFor?.invoice_number}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleRecordPayment} className="p-6 space-y-6">
            {/* Balance Card */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Total Bill</span>
                <span className="font-semibold">₹{Number(recordPaymentFor?.amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="font-semibold text-emerald-600">₹{Number(recordPaymentFor?.amount_paid || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium">Balance Due</span>
                <span className="font-black text-3xl text-primary">
                  ₹{(Number(recordPaymentFor?.amount || 0) - Number(recordPaymentFor?.amount_paid || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Amount Received (₹)</Label>
                <Input id="pay-amount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required className="font-bold text-lg bg-secondary/30" />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash (Hand-to-Hand)</SelectItem>
                    <SelectItem value="upi">UPI / QR Code</SelectItem>
                    <SelectItem value="card">Credit / Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-notes">Notes / Reference No. (Optional)</Label>
                <Input id="pay-notes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Transaction ID, etc." className="bg-secondary/30" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setRecordPaymentFor(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !paymentAmount} className="shadow-lg shadow-primary/20">
                {submitting ? 'Processing...' : 'Confirm Payment'} <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
