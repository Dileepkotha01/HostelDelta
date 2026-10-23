import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import {
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
  HOSTEL_SUBSCRIPTION_TRIAL_DAYS,
} from '@/lib/hostel-subscription';

export const runtime = 'nodejs';

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        method?: string;
        created_at?: number;
        acquirer_data?: { bank_transaction_id?: string; rrn?: string };
      };
    };
    subscription?: {
      entity?: {
        id?: string;
        current_end?: number | null;
        start_at?: number | null;
        customer_id?: string | null;
        payment_method?: string | null;
      };
    };
  };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  let payload: RazorpayWebhook;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: 'Malformed webhook payload.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();

    if (payload.event === 'payment.captured') {
      const payment = payload.payload?.payment?.entity;
      if (!payment?.id || !payment.order_id || typeof payment.amount !== 'number' || !Number.isInteger(payment.amount)) {
        return NextResponse.json({ error: 'Captured payment payload is incomplete.' }, { status: 400 });
      }

      const { data: rentTransaction, error: rentTransactionError } = await supabase
        .from('rent_transactions')
        .select('id')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle();
      if (rentTransactionError) {
        console.error('Unable to identify captured Razorpay payment:', rentTransactionError);
        return NextResponse.json({ error: 'Unable to identify the captured payment.' }, { status: 500 });
      }
      if (!rentTransaction) {
        const { data: ownerSubscription, error: ownerLookupError } = await supabase
          .from('owner_subscriptions')
          .select('id, hostel_id, hostel_owner_id, current_period_end, razorpay_payment_id, billing_mode, status')
          .eq('razorpay_order_id', payment.order_id)
          .maybeSingle();
        if (ownerLookupError) {
          console.error('Unable to identify hostel subscription payment:', ownerLookupError);
          return NextResponse.json({ error: 'Unable to identify the captured payment.' }, { status: 500 });
        }
        if (!ownerSubscription) {
          return NextResponse.json({ success: true });
        }
        if (payment.amount !== HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE || payment.currency !== 'INR') {
          return NextResponse.json({ error: 'Captured hostel payment amount is invalid.' }, { status: 400 });
        }
        if (ownerSubscription.razorpay_payment_id && ownerSubscription.razorpay_payment_id !== payment.id) {
          return NextResponse.json({ error: 'This hostel order was already completed with a different payment.' }, { status: 409 });
        }

        const isCompletedOnboarding = !['CREATED', 'TRIALING', 'PROVISIONING'].includes(ownerSubscription.status);
        if (isCompletedOnboarding && ownerSubscription.hostel_id && ownerSubscription.hostel_owner_id) {
          const periodStart = Math.max(
            Date.now(),
            ownerSubscription.current_period_end ? new Date(ownerSubscription.current_period_end).getTime() : 0,
          );
          const currentPeriodEnd = new Date(
            periodStart + HOSTEL_SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString();
          const { error: activateError } = await supabase
            .from('owner_subscriptions')
            .update({
              status: 'ACTIVE',
              billing_mode: 'ONE_TIME',
              cancel_at_period_end: false,
              cancel_requested_at: null,
              current_period_end: currentPeriodEnd,
              trial_ends_at: null,
              razorpay_payment_id: payment.id,
              payment_method: payment.method || null,
              authorized_at: new Date().toISOString(),
            })
            .eq('id', ownerSubscription.id)
            .eq('razorpay_order_id', payment.order_id);
          if (activateError) {
            console.error('Failed to activate one-time hostel subscription from webhook:', activateError);
            return NextResponse.json({ error: 'Unable to apply captured hostel payment.' }, { status: 500 });
          }
          const { error: historyError } = await supabase.from('owner_subscription_payments').upsert({
            owner_subscription_id: ownerSubscription.id,
            hostel_id: ownerSubscription.hostel_id,
            hostel_owner_id: ownerSubscription.hostel_owner_id,
            razorpay_order_id: payment.order_id,
            razorpay_payment_id: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'PAID',
            payment_method: payment.method || null,
            paid_at: typeof payment.created_at === 'number'
              ? new Date(payment.created_at * 1000).toISOString()
              : new Date().toISOString(),
          }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });
          if (historyError) {
            console.error('Unable to record one-time hostel payment history:', historyError);
            return NextResponse.json({ error: 'Unable to record hostel payment history.' }, { status: 500 });
          }
        } else if (!ownerSubscription.razorpay_payment_id) {
          const { error: markPaidError } = await supabase
            .from('owner_subscriptions')
            .update({
              razorpay_payment_id: payment.id,
              payment_method: payment.method || null,
              authorized_at: new Date().toISOString(),
            })
            .eq('id', ownerSubscription.id)
            .is('razorpay_payment_id', null);
          if (markPaidError) {
            console.error('Failed to record onboarding payment before hostel setup:', markPaidError);
            return NextResponse.json({ error: 'Unable to store captured onboarding payment.' }, { status: 500 });
          }
        }

        return NextResponse.json({ success: true });
      }

      const { error } = await supabase.rpc('process_rent_payment', {
        p_order_id: payment.order_id,
        p_payment_id: payment.id,
        p_paid_amount: payment.amount / 100,
        p_bank_utr: payment.acquirer_data?.bank_transaction_id || payment.acquirer_data?.rrn || null,
      });
      if (error) {
        console.error('Failed to process captured Razorpay payment:', error);
        return NextResponse.json({ error: 'Unable to apply captured payment to the rent ledger.' }, { status: 500 });
      }
    } else if ([
      'subscription.authenticated',
      'subscription.activated',
      'subscription.charged',
      'subscription.halted',
      'subscription.cancelled',
      'subscription.completed',
    ].includes(payload.event || '')) {
      const subscription = payload.payload?.subscription?.entity;
      if (!subscription?.id) {
        return NextResponse.json({ error: 'Subscription payload is incomplete.' }, { status: 400 });
      }

      const statusByEvent: Record<string, string> = {
        'subscription.authenticated': 'TRIALING',
        'subscription.activated': 'TRIALING',
        'subscription.charged': 'ACTIVE',
        'subscription.halted': 'HALTED',
        'subscription.cancelled': 'CANCELLED',
        'subscription.completed': 'EXPIRED',
      };
      const subscriptionUpdate: Record<string, string | null> = {
        status: statusByEvent[payload.event || ''],
      };
      if (subscription.current_end) {
        subscriptionUpdate.current_period_end = new Date(subscription.current_end * 1000).toISOString();
      }
      if (subscription.start_at) {
        subscriptionUpdate.trial_ends_at = new Date(subscription.start_at * 1000).toISOString();
      }
      if (subscription.customer_id) subscriptionUpdate.razorpay_customer_id = subscription.customer_id;
      if (subscription.payment_method) subscriptionUpdate.payment_method = subscription.payment_method;
      if (payload.event === 'subscription.authenticated') {
        subscriptionUpdate.authorized_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('owner_subscriptions')
        .update(subscriptionUpdate)
        .eq('razorpay_subscription_id', subscription.id)
        .neq('status', 'PROVISIONING');

      if (error) {
        console.error('Failed to update owner subscription from webhook:', error);
        return NextResponse.json({ error: 'Unable to update subscription status.' }, { status: 500 });
      }

      const payment = payload.payload?.payment?.entity;
      if (
        payload.event === 'subscription.charged' &&
        payment?.id &&
        typeof payment.amount === 'number' &&
        Number.isInteger(payment.amount) &&
        payment.currency === 'INR'
      ) {
        const { data: ownerSubscription, error: lookupError } = await supabase
          .from('owner_subscriptions')
          .select('id, hostel_id, hostel_owner_id')
          .eq('razorpay_subscription_id', subscription.id)
          .maybeSingle();
        if (lookupError) {
          console.error('Unable to find subscription for recurring payment history:', lookupError);
          return NextResponse.json({ error: 'Unable to link recurring payment to its subscription.' }, { status: 500 });
        }
        if (ownerSubscription?.hostel_id && ownerSubscription.hostel_owner_id) {
          const { error: historyError } = await supabase
            .from('owner_subscription_payments')
            .upsert({
              owner_subscription_id: ownerSubscription.id,
              hostel_id: ownerSubscription.hostel_id,
              hostel_owner_id: ownerSubscription.hostel_owner_id,
              razorpay_order_id: payment.order_id || null,
              razorpay_payment_id: payment.id,
              amount: payment.amount / 100,
              currency: payment.currency,
              status: 'PAID',
              payment_method: payment.method || null,
              paid_at: typeof payment.created_at === 'number'
                ? new Date(payment.created_at * 1000).toISOString()
                : new Date().toISOString(),
            }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });
          if (historyError) {
            console.error('Unable to record recurring hostel subscription payment:', historyError);
            return NextResponse.json({ error: 'Unable to record recurring subscription payment.' }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Razorpay webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
