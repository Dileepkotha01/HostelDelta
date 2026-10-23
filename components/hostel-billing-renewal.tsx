'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR, HOSTEL_SUBSCRIPTION_TRIAL_DAYS } from '@/lib/hostel-subscription';
import { CreditCard, Loader2 } from 'lucide-react';

interface HostelBillingRenewalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string;
  onSuccess: () => void;
}

export function HostelBillingRenewal({ open, onOpenChange, hostelId, onSuccess }: HostelBillingRenewalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  async function handleRenewal() {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error(sessionError?.message || 'Your session has expired. Sign in again to renew.');
      }

      const response = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ hostelId }),
      });
      const checkout = await response.json().catch(() => ({})) as {
        error?: string;
        keyId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
        hostelName?: string;
      };
      if (!response.ok) throw new Error(checkout.error || 'Unable to start renewal payment.');
      if (!checkout.keyId || !checkout.orderId || !window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable. Refresh and try again.');
      }

      const { data: currentSession, error: currentSessionError } = await supabase.auth.getSession();
      const token = currentSession?.session?.access_token;
      if (currentSessionError || !token) {
        throw new Error(currentSessionError?.message || 'Your session expired before payment could open.');
      }
      setCheckoutOpen(true);
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amount,
        currency: checkout.currency || 'INR',
        name: 'HostelHub',
        description: `One-time payment for ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS} days of ${checkout.hostelName || 'hostel services'}`,
        prefill: {
          name: currentSession.session?.user.user_metadata?.full_name || '',
          email: currentSession.session?.user.email || '',
          contact: currentSession.session?.user.phone || '',
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => {
            setCheckoutOpen(false);
            setLoading(false);
          },
        },
        handler: (payment) => {
          setCheckoutOpen(false);
          void (async () => {
            if (!payment.razorpay_order_id) {
              throw new Error('Razorpay did not return a renewal order reference. Contact support before paying again.');
            }
            const verificationResponse = await fetch('/api/subscriptions/renew', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                hostelId,
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const verification = await verificationResponse.json().catch(() => ({})) as { error?: string; billingHistoryWarning?: boolean };
            if (!verificationResponse.ok) {
              throw new Error(verification.error || 'Payment was received but the renewal could not be confirmed.');
            }
            toast({
              title: 'Hostel renewed',
              description: `${checkout.hostelName || 'Your hostel'} is active for another ${HOSTEL_SUBSCRIPTION_TRIAL_DAYS} days.${verification.billingHistoryWarning ? ' Payment succeeded, but its billing history could not be saved. Contact support with your payment reference.' : ''}`,
            });
            onOpenChange(false);
            onSuccess();
          })().catch((error: unknown) => {
            console.error('Unable to complete hostel renewal:', error);
            toast({
              title: 'Payment needs verification',
              description: error instanceof Error ? error.message : 'Payment was received but renewal could not be confirmed. Contact support.',
              variant: 'destructive',
            });
          }).finally(() => setLoading(false));
        },
      });
      razorpay.on('payment.failed', (failure) => {
        setCheckoutOpen(false);
        setLoading(false);
        toast({
          title: 'Renewal payment failed',
          description: failure.error?.description || 'Razorpay could not complete the payment.',
          variant: 'destructive',
        });
      });
      window.requestAnimationFrame(() => razorpay.open());
    } catch (error) {
      console.error('Unable to start hostel renewal:', error);
      setCheckoutOpen(false);
      toast({
        title: 'Unable to renew hostel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }

  return (
    <Dialog open={open && !checkoutOpen} onOpenChange={(nextOpen) => { if (!loading) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew hostel access</DialogTitle>
          <DialogDescription>
            Pay once with any payment method enabled in Razorpay. No autopay mandate is created; this payment activates services for 30 days.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-center">
          <p className="text-2xl font-bold">₹{HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-sm text-muted-foreground">One-time payment · 30 days</p>
        </div>
        <Button onClick={() => void handleRenewal()} disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening secure checkout...</>
            : <><CreditCard className="mr-2 h-4 w-4" />Pay once and renew</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
