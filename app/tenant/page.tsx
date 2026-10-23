'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { TenantRentCheckout } from '@/components/TenantRentCheckout';
import { RentReceiptList } from '@/components/RentReceiptList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import type { Tenant, Invoice, Hostel } from '@/lib/types';

export default function TenantDashboardPage() {
  const router = useRouter();
  const { profile, session, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const loadData = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Find tenant record for this user
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (tenantData) {
        setTenant(tenantData as Tenant);
        
        // Fetch hostel details
        const { data: hostelData } = await supabase
          .from('hostels')
          .select('*')
          .eq('id', tenantData.hostel_id)
          .single();
          
        if (hostelData) setHostel(hostelData as Hostel);

        // Fetch latest pending invoice
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .in('status', ['pending', 'partial', 'overdue'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invoiceData) {
            setPendingInvoice(invoiceData as Invoice);
        } else {
            setPendingInvoice(null);
        }
      }
    } catch (error) {
      console.error('Error loading tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session || !profile?.active || profile.role !== 'tenant') {
      router.replace('/login');
      return;
    }
    void loadData();
  }, [authLoading, session, profile?.id, profile?.role, profile?.active, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <p className="mt-4 text-slate-400">Loading your space...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Hostelhood</h2>
        <p className="text-slate-400">You haven&apos;t been assigned to a hostel yet. Please contact your hostel manager to complete onboarding.</p>
      </div>
    );
  }

  const balanceDue = pendingInvoice ? (Number(pendingInvoice.amount) - Number(pendingInvoice.amount_paid)) : 0;
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const invoiceMonthName = pendingInvoice ? monthNames[pendingInvoice.billing_month - 1] : "";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Hello, {tenant.full_name.split(' ')[0]}</h1>
        <p className="text-slate-400 mt-1">Manage your stay at {hostel?.name || 'your hostel'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Due Card */}
        <Card className="md:col-span-1 bg-slate-900 border-slate-800">
            <CardHeader>
                <CardTitle className="text-lg text-white">Current Rent</CardTitle>
                <CardDescription className="text-slate-400">
                    {pendingInvoice ? `Due for ${invoiceMonthName} ${pendingInvoice.billing_year}` : 'You are all caught up!'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {pendingInvoice && balanceDue > 0 ? (
                    <div className="space-y-6">
                        <div className="flex items-end justify-between">
                            <span className="text-4xl font-black text-indigo-400">₹{balanceDue.toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>Due by {new Date(pendingInvoice.due_date).toLocaleDateString()}</span>
                        </div>

                        <Button 
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6"
                            onClick={() => setCheckoutOpen(true)}
                        >
                            <CreditCard className="mr-2 h-5 w-5" /> Pay Now
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-emerald-400">No Pending Dues</h4>
                            <p className="text-xs text-slate-400 mt-1">Your rent is fully paid.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Payment History & Receipts */}
        <div className="md:col-span-2">
            <RentReceiptList tenantId={tenant.id} />
        </div>
      </div>

      {pendingInvoice && hostel && (
        <TenantRentCheckout 
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            invoiceId={pendingInvoice.id}
            amount={balanceDue}
            month={invoiceMonthName}
            year={pendingInvoice.billing_year}
            onSuccess={loadData}
        />
      )}
    </div>
  );
}
