'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { Loader2, CreditCard, Calendar, ShieldCheck } from 'lucide-react';

interface TenantRentCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  amount: number;
  month: string;
  year: number;
  onSuccess?: () => void;
}

export function TenantRentCheckout({
  open,
  onOpenChange,
  invoiceId,
  amount,
  month,
  year,
  onSuccess
}: TenantRentCheckoutProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Create order on backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in again to pay this invoice.');
      }
      const response = await fetch('/api/rent/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // 2. Open Razorpay Checkout with UPI preference
      const options = {
        key: data.keyId,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: 'Kupera Hostel Rent',
        description: `Rent for ${month} ${year}`,
        order_id: data.orderId,
        handler: function () {
          toast({
            title: "Payment submitted",
            description: "Your payment is being verified. The invoice will update after Razorpay confirms it.",
          });
          onOpenChange(false);
          if (onSuccess) onSuccess();
        },
        prefill: {
          name: "Resident",
          contact: "9999999999",
          method: 'upi',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        theme: {
          color: "#4F46E5" // Indigo 600
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast({
          title: "Payment Failed",
          description: response.error.description,
          variant: "destructive",
        });
      });
      rzp.open();

    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5 text-indigo-400" />
              Pay Rent
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Secure payment via Razorpay. The payment is routed to the hostel&apos;s verified payout account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Rent Period</span>
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                    {month} {year}
                  </span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Room</span>
                  <span className="font-medium text-white">Hostel accommodation</span>
               </div>
               <div className="border-t border-slate-700/50 pt-3 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Total Amount</span>
                  <span className="text-xl font-bold text-emerald-400">₹{amount.toLocaleString('en-IN')}</span>
               </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg text-xs text-slate-400">
              Recurring payments are not available yet. Each rent payment must be confirmed individually.
            </div>
            
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Secured by Razorpay
            </div>
          </div>

          <DialogFooter className="sm:justify-stretch">
            <Button 
              onClick={handlePayment} 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Initializing Secure Checkout...
                </>
              ) : (
                `Pay ₹${amount.toLocaleString('en-IN')} Now`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
