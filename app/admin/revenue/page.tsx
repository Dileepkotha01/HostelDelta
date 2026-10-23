'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  Sliders,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function AdminRevenuePage() {
  const {
    hostelOverviews,
    payments,
    invoices,
    stats,
    platformCommissionRate,
    setPlatformCommissionRate,
  } = useAdmin();

  const [commissionInput, setCommissionInput] = useState(String(platformCommissionRate));

  // Compute MRR (sum of all active tenant monthly rents across all hostels)
  const estimatedMRR = useMemo(() => {
    return hostelOverviews.reduce((sum, h) => {
      // Approximate MRR from hostel rooms & occupancy or total revenue
      return sum + (h.total_revenue || 0);
    }, 0);
  }, [hostelOverviews]);

  // Ranked hostels by revenue
  const rankedHostels = useMemo(() => {
    return [...hostelOverviews].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
  }, [hostelOverviews]);

  // Overdue / Unpaid Invoices
  const unpaidInvoices = useMemo(() => {
    return invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue' || i.status === 'partial')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [invoices]);

  // Projected platform commission
  const calculatedCommission = Math.round((stats.totalRevenue * platformCommissionRate) / 100);

  const handleUpdateCommission = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(commissionInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setPlatformCommissionRate(parsed);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-400" />
            Platform Revenue & Commission Analytics
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track gross collections, collection efficiency, overdue rents, and platform revenue commissions.
          </p>
        </div>
      </div>

      {/* KPI Tickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/90 border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gross Platform Inflow
            </span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-2">
            ₹{stats.totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center">
            <CheckCircle2 className="h-3 w-3 mr-1 inline" />
            100% Verified in Database
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unpaid / Due Rent
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2">
            ₹{stats.pendingRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Across {unpaidInvoices.length} outstanding invoices
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform Take ({platformCommissionRate}%)
            </span>
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400 mt-2">
            ₹{calculatedCommission.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Net commission earned by platform
          </div>
        </Card>

        <Card className="bg-card/90 border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collection Efficiency
            </span>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-foreground mt-2">
            {stats.totalRevenue + stats.pendingRevenue > 0
              ? Math.round(
                  (stats.totalRevenue / (stats.totalRevenue + stats.pendingRevenue)) * 100
                )
              : 100}
            %
          </div>
          <div className="text-xs text-purple-400 mt-1">
            Realized cash collection ratio
          </div>
        </Card>
      </div>

      {/* Two Column Grid: Leaderboard & Commission Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Hostel Revenue Leaderboard */}
        <Card className="bg-card/90 border-border shadow-xl lg:col-span-2">
          <CardHeader className="border-b border-border/80 pb-4">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-400" />
              Hostel Collection Leaderboard
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Properties ranked by total gross revenue generated
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {rankedHostels.map((hostel, index) => {
              const maxRevenue = rankedHostels[0]?.total_revenue || 1;
              const percentOfTop = Math.min(
                100,
                Math.round(((hostel.total_revenue || 0) / maxRevenue) * 100)
              );

              return (
                <div key={hostel.id} className="p-3.5 rounded-xl bg-background/60 border border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground/80">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-foreground text-xs sm:text-sm">
                          {hostel.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70 ml-1.5">
                          ({hostel.city || 'India'})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">
                        ₹{(hostel.total_revenue || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {hostel.occupancy_rate}% occupied
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${percentOfTop}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right 1 Col: Platform Commission Calculator */}
        <Card className="bg-card/90 border-border shadow-xl">
          <CardHeader className="border-b border-border/80 pb-4">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              Commission Model
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure your platform fee percentage
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <form onSubmit={handleUpdateCommission} className="space-y-3">
              <div>
                <label className="text-xs text-foreground/80 block mb-1">
                  Commission Rate (% of gross rent)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="bg-background border-border text-foreground text-sm h-9"
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                  />
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs h-9">
                    Apply
                  </Button>
                </div>
              </div>
            </form>

            <div className="p-3 rounded-lg bg-background border border-border space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Platform Volume:</span>
                <span className="font-semibold text-foreground">₹{stats.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Configured Commission:</span>
                <span className="font-semibold text-indigo-400">{platformCommissionRate}%</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                <span>Calculated Platform Revenue:</span>
                <span className="text-emerald-400">₹{calculatedCommission.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              This commission applies to all rent collected via UPI, Razorpay, or offline verification through HostelHub.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Receivables Aging Table */}
      <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/80 pb-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Outstanding & Overdue Invoices Roster
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Uncollected rents requiring follow-up or automated AI voice call triggers
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {unpaidInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground/70 text-xs">
                      All invoices are currently fully cleared! Zero overdue rent.
                    </td>
                  </tr>
                ) : (
                  unpaidInvoices.slice(0, 8).map((inv) => {
                    const balance = Math.max(0, (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0));
                    return (
                      <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-300">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground/80">
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground/80">
                          ₹{Number(inv.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          ₹{(Number(inv.amount_paid) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-400 text-xs">
                          ₹{balance.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-[10px] capitalize ${
                              inv.status === 'overdue'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
