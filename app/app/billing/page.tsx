'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HostelBillingRenewal } from '@/components/hostel-billing-renewal';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  Receipt,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR } from '@/lib/hostel-subscription';

interface HostelRecord {
  id: string;
  name: string;
}

interface SubscriptionRecord {
  id: string;
  hostel_id: string | null;
  onboarding_id: string | null;
  status: string;
  billing_mode: 'AUTO_PAY' | 'ONE_TIME';
  current_period_end: string | null;
  trial_ends_at: string | null;
  authorized_at: string | null;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_subscription_id: string | null;
  cancel_at_period_end: boolean;
  cancel_requested_at: string | null;
}

interface SubscriptionPayment {
  id: string;
  hostel_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface HostelBillingRecord extends HostelRecord {
  subscription: SubscriptionRecord | null;
  payments: SubscriptionPayment[];
}

function formatDate(date: string | null) {
  if (!date) return 'Not available';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? 'Not available'
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusStyle(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'TRIALING':
      return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'HALTED':
    case 'PAYMENT_FAILED':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'CREATED':
    case 'PENDING_PAYMENT':
    case 'PROCESSING':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BillingPage() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<HostelBillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<HostelBillingRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [renewalHostelId, setRenewalHostelId] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!profile?.id || profile.role !== 'hostel_owner') {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [hostelResult, subscriptionResult, paymentResult] = await Promise.all([
      supabase.from('hostels').select('id, name').eq('owner_id', profile.id).order('name'),
      supabase
        .from('owner_subscriptions')
        .select('id, hostel_id, onboarding_id, status, billing_mode, current_period_end, trial_ends_at, authorized_at, payment_method, razorpay_payment_id, razorpay_order_id, razorpay_subscription_id, cancel_at_period_end, cancel_requested_at')
        .eq('hostel_owner_id', profile.id)
        .not('hostel_id', 'is', null),
      supabase
        .from('owner_subscription_payments')
        .select('id, hostel_id, amount, currency, status, payment_method, razorpay_payment_id, razorpay_order_id, paid_at, created_at')
        .eq('hostel_owner_id', profile.id)
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(100),
    ]);
    const loadError = hostelResult.error || subscriptionResult.error || paymentResult.error;
    if (loadError) {
      console.error('Unable to load owner billing details:', loadError);
      toast({
        title: 'Could not load billing details',
        description: loadError.message || 'Please refresh and try again.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    const subscriptions = (subscriptionResult.data || []) as SubscriptionRecord[];
    const subscriptionByHostel = new Map(subscriptions.map((subscription) => [subscription.hostel_id, subscription]));
    const paymentsByHostel = new Map<string, SubscriptionPayment[]>();
    for (const payment of (paymentResult.data || []) as SubscriptionPayment[]) {
      const history = paymentsByHostel.get(payment.hostel_id) || [];
      history.push(payment);
      paymentsByHostel.set(payment.hostel_id, history);
    }
    setRecords(((hostelResult.data || []) as HostelRecord[]).map((hostel) => ({
      ...hostel,
      subscription: subscriptionByHostel.get(hostel.id) || null,
      payments: paymentsByHostel.get(hostel.id) || [],
    })));
    setLoading(false);
  }, [profile?.id, profile?.role, toast]);

  useEffect(() => {
    if (!authLoading) void loadBilling();
  }, [authLoading, loadBilling]);

  const metrics = useMemo(() => {
    const subscriptions = records.map((record) => record.subscription).filter((subscription): subscription is SubscriptionRecord => !!subscription);
    return {
      hostels: records.length,
      active: subscriptions.filter((subscription) => ['ACTIVE', 'TRIALING'].includes(subscription.status)).length,
      recurring: subscriptions.filter((subscription) =>
        subscription.billing_mode === 'AUTO_PAY' &&
        ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
        !subscription.cancel_at_period_end
      ).length,
      monthlyTotal: subscriptions.filter((subscription) =>
        subscription.billing_mode === 'AUTO_PAY' &&
        ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
        !subscription.cancel_at_period_end
      ).length * HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR,
    };
  }, [records]);

  async function requestCancellation() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error(sessionError?.message || 'Your session has expired. Sign in again.');
      }
      const response = await fetch('/api/subscriptions/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ hostelId: cancelTarget.id, action: 'cancel_at_period_end' }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to cancel automatic renewal.');
      toast({
        title: 'Automatic renewal cancelled',
        description: `Access remains available until ${formatDate(cancelTarget.subscription?.current_period_end || null)}.`,
      });
      setCancelTarget(null);
      await loadBilling();
    } catch (error) {
      toast({
        title: 'Could not cancel automatic renewal',
        description: error instanceof Error ? error.message : 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading billing details...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      <header className="relative overflow-hidden rounded-3xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 via-card to-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-background/70 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure owner billing
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Billing &amp; subscriptions</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Manage access, payment methods, renewals, and automatic billing across your hostels.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-4 py-3 text-sm shadow-sm">
            <CreditCard className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold">₹{HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')}</span>
            <span className="text-muted-foreground">per hostel / month</span>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Hostels', value: metrics.hostels, icon: Receipt, tone: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Active subscriptions', value: metrics.active, icon: BadgeCheck, tone: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Autopay enabled', value: metrics.recurring, icon: CalendarClock, tone: 'text-sky-600 bg-sky-500/10' },
          { label: 'Estimated monthly total', value: `₹${metrics.monthlyTotal.toLocaleString('en-IN')}`, icon: CreditCard, tone: 'text-violet-600 bg-violet-500/10' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${metric.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-bold">Your subscriptions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each hostel has its own access period and renewal settings.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadBilling()}>
            Refresh details <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>

        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
            <Receipt className="mx-auto h-9 w-9 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">No hostel subscriptions yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Subscriptions for hostels you add will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const subscription = record.subscription;
              const latestPayment = record.payments[0];
              const status = subscription?.status || 'NOT CONFIGURED';
              const isAutoPay = subscription?.billing_mode === 'AUTO_PAY';
              const isInitialPaymentPending = !!subscription?.onboarding_id &&
                ['CREATED', 'PENDING_PAYMENT', 'PROCESSING', 'PAYMENT_FAILED'].includes(subscription.status);
              const accessEnd = subscription?.status === 'TRIALING'
                ? subscription.trial_ends_at
                : subscription?.current_period_end;
              const periodIsCurrent = !!accessEnd && new Date(accessEnd).getTime() > Date.now();
              const hasAccess = !!subscription && (
                (['ACTIVE', 'TRIALING'].includes(subscription.status) && periodIsCurrent) ||
                (subscription.status === 'CANCELLED' && periodIsCurrent)
              );
              const renewDate = subscription?.status === 'TRIALING'
                ? subscription.trial_ends_at
                : subscription?.current_period_end;

              return (
                <article key={record.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{record.name}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Hostel subscription · {isAutoPay ? 'Automatic renewal' : 'One-time billing'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`w-fit rounded-full px-3 py-1 ${statusStyle(status)}`}>
                      {hasAccess ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <AlertCircle className="mr-1.5 h-3.5 w-3.5" />}
                      {statusLabel(status)}
                    </Badge>
                  </div>

                  <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {subscription?.status === 'TRIALING' ? 'Free trial ends' : 'Access through'}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock className="h-4 w-4 text-indigo-500" />{formatDate(renewDate || null)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Renewal preference</p>
                      <p className="mt-1.5 text-sm font-semibold">{isAutoPay ? 'Automatic monthly' : 'Pay manually'}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{isAutoPay ? '₹1,499 per month after trial' : 'One payment gives 30 days access'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment method</p>
                      <p className="mt-1.5 text-sm font-semibold capitalize">{subscription?.payment_method?.replaceAll('_', ' ') || (isAutoPay ? 'Razorpay mandate' : 'Not available')}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest payment reference</p>
                      <p className="mt-1.5 truncate text-sm font-semibold" title={latestPayment?.razorpay_payment_id || subscription?.razorpay_payment_id || undefined}>
                        {latestPayment?.razorpay_payment_id || subscription?.razorpay_payment_id || 'No payment recorded'}
                      </p>
                      {(latestPayment?.razorpay_order_id || subscription?.razorpay_order_id) && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={latestPayment?.razorpay_order_id || subscription?.razorpay_order_id || undefined}>
                          Order {latestPayment?.razorpay_order_id || subscription?.razorpay_order_id}
                        </p>
                      )}
                    </div>
                  </div>

                  {record.payments.length > 0 && (
                    <div className="border-t border-border/70 px-5 py-4 sm:px-6">
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Receipt className="h-3.5 w-3.5" />Payment activity
                      </h4>
                      <div className="space-y-2">
                        {record.payments.slice(0, 3).map((payment) => (
                          <div key={payment.id} className="flex flex-col gap-1 rounded-xl bg-muted/30 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span className="font-medium">₹{Number(payment.amount).toLocaleString('en-IN')} {payment.currency}</span>
                              <span className="text-xs capitalize text-muted-foreground">{payment.payment_method?.replaceAll('_', ' ') || 'Razorpay'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground sm:justify-end">
                              <span>{formatDate(payment.paid_at || payment.created_at)}</span>
                              <span className="max-w-36 truncate" title={payment.razorpay_payment_id || undefined}>
                                {payment.razorpay_payment_id || statusLabel(payment.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {subscription?.cancel_at_period_end && (
                    <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 sm:mx-6">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Automatic renewal is cancelled. Hostel access remains available until {formatDate(subscription.current_period_end)}.</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-xs text-muted-foreground">
                      {subscription?.authorized_at
                        ? `Billing authorization recorded ${formatDate(subscription.authorized_at)}`
                        : 'Payments are securely processed by Razorpay.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {isInitialPaymentPending && subscription && (
                        <Button
                          size="sm"
                          onClick={() => window.dispatchEvent(new CustomEvent('hostel-billing-resume-onboarding', {
                            detail: { onboardingId: subscription.onboarding_id },
                          }))}
                        >
                          <CreditCard className="mr-2 h-3.5 w-3.5" />Continue payment
                        </Button>
                      )}
                      {subscription && !hasAccess && !isInitialPaymentPending && (
                        <Button size="sm" onClick={() => setRenewalHostelId(record.id)}>
                          <CreditCard className="mr-2 h-3.5 w-3.5" />Pay once to renew
                        </Button>
                      )}
                      {subscription && isAutoPay && hasAccess && !subscription.cancel_at_period_end && (
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(record)}>
                          <XCircle className="mr-2 h-3.5 w-3.5" />Cancel autopay
                        </Button>
                      )}
                      {subscription?.cancel_at_period_end && (
                        <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />Cancellation scheduled
                        </span>
                      )}
                      {subscription?.billing_mode === 'ONE_TIME' && hasAccess && (
                        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                          <BadgeCheck className="h-3.5 w-3.5" />No autopay mandate
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />Payments &amp; security</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Checkout and recurring mandates are handled by Razorpay. HostelHub does not store full card or bank credentials. Available methods depend on the payment methods enabled for your account.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4 text-indigo-500" />Need help with billing?</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep the payment reference shown above when contacting support about a charge or subscription. Cancellation requests take effect at the end of the current billing period.
          </p>
        </div>
      </section>

      <HostelBillingRenewal
        open={!!renewalHostelId}
        onOpenChange={(open) => { if (!open) setRenewalHostelId(null); }}
        hostelId={renewalHostelId || ''}
        onSuccess={() => {
          void loadBilling();
          window.dispatchEvent(new Event('hostel-billing-updated'));
        }}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open && !cancelling) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel automatic renewal?</AlertDialogTitle>
            <AlertDialogDescription>
              Autopay for {cancelTarget?.name} will stop at the end of the current billing period. The hostel remains accessible through {formatDate(cancelTarget?.subscription?.current_period_end || null)}. No further recurring payment will be requested after that date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep autopay</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(event) => {
                event.preventDefault();
                void requestCancellation();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling...</> : 'Cancel at period end'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
