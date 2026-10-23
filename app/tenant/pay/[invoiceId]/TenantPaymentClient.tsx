'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Building2, User, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TenantPaymentClient({
  invoice,
  accessToken,
}: {
  invoice: any;
  accessToken: string;
}) {
  const { toast } = useToast();
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleProceedToPay = async () => {
    setPaymentState('processing');

    try {
      const response = await fetch('/api/rent/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          accessToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      const options = {
        key: data.keyId,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: invoice.hostel?.name || 'Kupera Hostel Rent',
        description: `Invoice ${invoice.invoice_number}`,
        order_id: data.orderId,
        handler: function (response: any) {
          setPaymentState('success');
        },
        prefill: {
          name: invoice.tenant?.full_name || 'Tenant Name',
          email: invoice.tenant?.email || 'tenant@example.com',
          contact: invoice.tenant?.phone || '9999999999',
          method: 'upi',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [
                  { method: 'upi' }
                ],
              },
              other: {
                name: 'Other Payment Methods',
                instruments: [
                  { method: 'netbanking' },
                  { method: 'card' }
                ],
              },
            },
            sequence: ['block.upi', 'block.other'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        theme: { color: "#4F46E5" }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setErrorMessage(response.error.description);
        setPaymentState('failed');
      });
      rzp.open();

    } catch (error: any) {
      setErrorMessage(error.message);
      setPaymentState('failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {/* 
        Responsive Modal Alert Banner Overlays (Fixed in center)
      */}
      {paymentState === 'processing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <h2 className="text-xl font-bold text-slate-800">Processing Payment...</h2>
            <p className="text-slate-500 text-sm">Please do not close this window.</p>
          </div>
        </div>
      )}

      {paymentState === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Payment submitted</h2>
            <p className="text-slate-500 text-sm">Razorpay is verifying your payment. Invoice #{invoice.invoice_number} will update after confirmation.</p>
            <Button onClick={() => window.location.reload()} className="mt-4 bg-green-600 hover:bg-green-700">Check status</Button>
          </div>
        </div>
      )}

      {paymentState === 'failed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Payment Failed</h2>
            <p className="text-slate-500 text-sm">{errorMessage || 'Something went wrong. Try again.'}</p>
            <Button onClick={() => setPaymentState('idle')} className="mt-4 bg-red-600 hover:bg-red-700">Try Again</Button>
          </div>
        </div>
      )}

      {/* Main Checkout Page */}
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="bg-indigo-600 text-white rounded-t-xl pb-6 pt-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <CardTitle className="text-2xl font-bold flex flex-col items-center gap-2 relative z-10">
            <Building2 className="w-8 h-8" />
            {invoice.hostel?.name || 'Hostel Name'}
          </CardTitle>
          <CardDescription className="text-indigo-100 relative z-10">
            Secure Rent Payment Checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
             <User className="w-5 h-5 text-indigo-500 shrink-0" />
             <div>
               <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Tenant Name</p>
               <p className="text-sm font-medium text-slate-900">{invoice.tenant?.full_name}</p>
             </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
             <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
             <div>
               <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Billing Cycle</p>
               <p className="text-sm font-medium text-slate-900">{invoice.billing_month}/{invoice.billing_year}</p>
             </div>
          </div>
          
          <div className="border-t border-slate-200 pt-4 mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-600 font-medium">Rent Amount</span>
              <span className="text-slate-900 font-medium">₹{invoice.amount?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600 font-medium">Amount Paid</span>
              <span className="text-slate-900 font-medium">₹{Number(invoice.amount_paid || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-4">
              <span className="text-lg font-bold text-slate-900">Total Payable</span>
              <span className="text-2xl font-black text-indigo-600">
                ₹{(invoice.amount - (invoice.amount_paid || 0)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pb-8 pt-4 px-6">
          <Button 
            onClick={handleProceedToPay} 
            className="w-full py-6 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
            disabled={paymentState === 'processing' || invoice.status === 'paid'}
          >
            {invoice.status === 'paid' ? 'Invoice paid' : 'Proceed to Pay'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
