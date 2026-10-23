'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Receipt,
  Search,
  Download,
  PlusCircle,
  CreditCard,
  Building2,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDownLeft,
} from 'lucide-react';
import type { PaymentMethod } from '@/lib/types';

export default function AdminPaymentsPage() {
  const {
    payments,
    hostels,
    tenants,
    recordPayment,
    selectedHostelId,
    setSelectedHostelId,
  } = useAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Record payment dialog state
  const [recordOpen, setRecordOpen] = useState(false);
  const [payHostelId, setPayHostelId] = useState('');
  const [payTenantId, setPayTenantId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('upi');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const tenant = tenants.find((t) => t.id === p.tenant_id);
      const hostel = hostels.find((h) => h.id === p.hostel_id);

      const matchesSearch =
        (tenant && tenant.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (hostel && hostel.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.transaction_id && p.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMethod = filterMethod === 'all' || p.method === filterMethod;
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [payments, tenants, hostels, searchTerm, filterMethod, filterStatus]);

  // Aggregate stats
  const totalAmount = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const digitalAmount = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'completed' && p.method !== 'cash')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const cashAmount = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'completed' && p.method === 'cash')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const averageTransaction = useMemo(() => {
    const completed = filteredPayments.filter((p) => p.status === 'completed');
    if (completed.length === 0) return 0;
    return Math.round(totalAmount / completed.length);
  }, [filteredPayments, totalAmount]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Hostel', 'Tenant', 'Amount', 'Method', 'Status', 'Transaction ID', 'Notes'];
    const rows = filteredPayments.map((p) => {
      const tenant = tenants.find((t) => t.id === p.tenant_id);
      const hostel = hostels.find((h) => h.id === p.hostel_id);
      const date = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '';
      return [
        `"${date}"`,
        `"${hostel?.name || ''}"`,
        `"${tenant?.full_name || ''}"`,
        p.amount,
        `"${p.method}"`,
        `"${p.status}"`,
        `"${p.transaction_id || ''}"`,
        `"${p.notes || ''}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hostelhub-payments-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
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
    setRecordOpen(false);
    setPayAmount('');
    setPayNotes('');
  };

  const modalTenants = tenants.filter((t) => !payHostelId || t.hostel_id === payHostelId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-indigo-400" />
            Global Payments & Transactions Ledger
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Audit, verify, and record transactions across all hostels in the ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 text-xs border-border bg-card text-foreground/90 hover:text-foreground hover:bg-secondary flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (hostels.length > 0) setPayHostelId(hostels[0].id);
              setRecordOpen(true);
            }}
            className="h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-foreground font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* KPI Ticker Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/90 border-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Total Ledger Volume
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">
            ₹{totalAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">
            {filteredPayments.length} recorded payments
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Digital Collections
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-400 mt-1">
            ₹{digitalAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">
            UPI, Cards & Razorpay
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Cash in Hand
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">
            ₹{cashAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">
            Physical offline payments
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Average Ticket Size
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            ₹{averageTransaction.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">
            Per payment transaction
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by tenant, hostel, or transaction notes..."
            className="pl-9 bg-background border-border text-foreground text-xs h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="bg-card border-border text-xs text-foreground h-9">
              <SelectValue placeholder="Payment Method" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground/90">
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="upi">UPI / QR Code</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="razorpay">Razorpay</SelectItem>
              <SelectItem value="card">Card Swipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-card border-border text-xs text-foreground h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground/90">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Tenant & Contact</th>
                <th className="py-3 px-4">Hostel</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Notes / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground/70 text-sm">
                    No transactions match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const tenant = tenants.find((t) => t.id === payment.tenant_id);
                  const hostel = hostels.find((h) => h.id === payment.hostel_id);
                  const date = payment.created_at
                    ? new Date(payment.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <tr key={payment.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground text-xs">
                          {tenant?.full_name || 'Anonymous Tenant'}
                        </div>
                        <div className="text-[11px] text-muted-foreground/70">{tenant?.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-indigo-300 font-medium">
                          {hostel?.name || 'Property'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-border text-foreground/80 text-[10px] uppercase font-mono">
                          {payment.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400 text-sm whitespace-nowrap">
                        ₹{Number(payment.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={`text-[10px] capitalize ${
                            payment.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : payment.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                        {payment.notes || payment.transaction_id || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL: RECORD PAYMENT ================= */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-400" />
              Record Manual Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Log an offline or direct transaction for any tenant in the platform.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-foreground/80">Target Hostel *</Label>
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
              <Label className="text-xs text-foreground/80">Tenant *</Label>
              <Select value={payTenantId} onValueChange={setPayTenantId} disabled={!payHostelId}>
                <SelectTrigger className="bg-background border-border text-xs text-foreground mt-1">
                  <SelectValue placeholder={payHostelId ? "Select Tenant" : "Choose a hostel first"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground/90">
                  {modalTenants.map((t) => (
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
                  placeholder="e.g. 7500"
                  className="bg-background border-border text-sm mt-1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Method</Label>
                <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)}>
                  <SelectTrigger className="bg-background border-border text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground/90">
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-foreground/80">Reference / Notes</Label>
              <Input
                placeholder="e.g. Cash collected / Bank Ref #19201"
                className="bg-background border-border text-sm mt-1"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setRecordOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !payHostelId || !payTenantId || !payAmount} className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                {submitting ? 'Recording...' : 'Save Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
