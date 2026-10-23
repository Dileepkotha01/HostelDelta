import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import {
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR,
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
  HOSTEL_SUBSCRIPTION_TRIAL_DAYS,
} from '@/lib/hostel-subscription';

const requestSchema = z.object({
  onboardingId: z.string().uuid(),
  billingMode: z.enum(['AUTO_PAY', 'ONE_TIME']).default('AUTO_PAY'),
});

const AUTHORIZATION_WINDOW_SECONDS = 30 * 60;
const REUSE_CHECKOUT_MINIMUM_SECONDS = 5 * 60;

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_HOSTEL_SUBSCRIPTION_PLAN_ID;
  if (!supabaseUrl || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Subscription storage is not configured.' }, { status: 503 });
  }
  if (!keyId || !keySecret || !publicKeyId || keyId !== publicKeyId) {
    return NextResponse.json({
      error: 'Hostel payments are not configured. Set matching Razorpay API keys.',
    }, { status: 503 });
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid onboarding reference is required.' }, { status: 400 });
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await caller.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || !profile) {
      console.error('Failed to verify owner for subscription checkout:', profileError);
      return NextResponse.json({ error: 'Unable to verify this account for hostel setup.' }, { status: 500 });
    }
    if (profile.role !== 'hostel_owner' || !profile.active) {
      return NextResponse.json({ error: 'Only active hostel owners can start a hostel subscription.' }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { data: pendingHostel, error: pendingHostelError } = await admin
      .from('hostels')
      .select('id')
      .eq('owner_id', user.id)
      .eq('onboarding_id', parsed.data.onboardingId)
      .maybeSingle();
    if (pendingHostelError || !pendingHostel) {
      console.error('Unable to verify the saved hostel for subscription checkout:', pendingHostelError);
      return NextResponse.json({ error: 'Save your hostel details before starting payment.' }, { status: 409 });
    }
    const { data: existing, error: existingError } = await admin
      .from('owner_subscriptions')
      .select('id, razorpay_subscription_id, razorpay_order_id, billing_mode, trial_ends_at, status, hostel_id')
      .eq('hostel_owner_id', user.id)
      .eq('onboarding_id', parsed.data.onboardingId)
      .maybeSingle();
    if (existingError) {
      console.error('Failed to check for an existing subscription attempt:', existingError);
      return NextResponse.json({ error: 'Unable to check subscription status.' }, { status: 500 });
    }
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    if (parsed.data.billingMode === 'ONE_TIME') {
      if (existing && existing.status !== 'CREATED') {
        return NextResponse.json({ error: 'This onboarding payment has already been completed or cancelled.' }, { status: 409 });
      }
      if (existing?.billing_mode === 'AUTO_PAY' && existing.razorpay_subscription_id) {
        const previousSubscription = await razorpay.subscriptions.fetch(existing.razorpay_subscription_id);
        if (previousSubscription.status === 'created') {
          await razorpay.subscriptions.cancel(previousSubscription.id, false);
        } else if (!['expired', 'cancelled'].includes(previousSubscription.status)) {
          return NextResponse.json({ error: 'An automatic payment authorization is already in progress. Complete it or contact support before changing payment method.' }, { status: 409 });
        }
      }
      if (!existing?.razorpay_order_id) {
        const order = await razorpay.orders.create({
          amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
          currency: 'INR',
          receipt: `hostel_${parsed.data.onboardingId.replace(/-/g, '').slice(0, 32)}`,
          notes: {
            category: 'hostel_subscription',
            billing_mode: 'ONE_TIME',
            owner_id: user.id,
            hostel_id: pendingHostel.id,
            onboarding_id: parsed.data.onboardingId,
          },
        });
        const oneTimeRecord = {
          hostel_owner_id: user.id,
          hostel_id: pendingHostel.id,
          onboarding_id: parsed.data.onboardingId,
          razorpay_subscription_id: null,
          razorpay_order_id: order.id,
          plan_id: 'one_time',
          billing_mode: 'ONE_TIME',
          cancel_at_period_end: false,
          cancel_requested_at: null,
          status: 'CREATED',
          trial_starts_at: null,
          trial_ends_at: null,
          current_period_end: null,
        };
        const { error: saveOrderError } = existing
          ? await admin.from('owner_subscriptions').update(oneTimeRecord).eq('id', existing.id)
          : await admin.from('owner_subscriptions').insert(oneTimeRecord);
        if (saveOrderError) {
          console.error('Failed to save one-time hostel payment:', saveOrderError);
          return NextResponse.json({ error: 'Unable to save the hostel payment. Please try again.' }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          billingMode: 'ONE_TIME',
          keyId: publicKeyId,
          orderId: order.id,
          amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
          currency: 'INR',
          ownerName: user.user_metadata?.full_name || user.user_metadata?.name || '',
          ownerEmail: user.email || '',
          ownerPhone: user.phone || '',
        });
      }
      const previousOrder = await razorpay.orders.fetch(existing.razorpay_order_id);
      return NextResponse.json({
        success: true,
        billingMode: 'ONE_TIME',
        keyId: publicKeyId,
        orderId: previousOrder.id,
        amount: previousOrder.amount,
        currency: previousOrder.currency,
        ownerName: user.user_metadata?.full_name || user.user_metadata?.name || '',
        ownerEmail: user.email || '',
        ownerPhone: user.phone || '',
      });
    }

    if (!planId) {
      return NextResponse.json({
        error: 'Automatic renewal is not configured. Choose one-time payment or configure RAZORPAY_HOSTEL_SUBSCRIPTION_PLAN_ID.',
      }, { status: 503 });
    }
    const plan = await razorpay.plans.fetch(planId);
    if (
      plan.period !== 'monthly' ||
      plan.interval !== 1 ||
      plan.item.amount !== HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE ||
      plan.item.currency !== 'INR'
    ) {
      return NextResponse.json({
        error: `The configured Razorpay plan must be ₹${HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR.toLocaleString('en-IN')} INR, billed monthly.`,
      }, { status: 503 });
    }
    if (existing?.billing_mode === 'ONE_TIME' && existing.razorpay_order_id) {
      return NextResponse.json({ error: 'A one-time payment was already started for this hostel. Continue that payment before choosing automatic renewal.' }, { status: 409 });
    }
    if (existing) {
      if (existing.status !== 'CREATED') {
        return NextResponse.json({ error: 'This onboarding payment has already been completed or cancelled.' }, { status: 409 });
      }
      if (existing.billing_mode === 'AUTO_PAY' && existing.razorpay_subscription_id) {
        const previousSubscription = await razorpay.subscriptions.fetch(existing.razorpay_subscription_id);
        const nowUnix = Math.floor(Date.now() / 1000);
        if (
          previousSubscription.status === 'created' &&
          previousSubscription.expire_by &&
          previousSubscription.expire_by - nowUnix > REUSE_CHECKOUT_MINIMUM_SECONDS
        ) {
          return NextResponse.json({
            success: true,
            billingMode: 'AUTO_PAY',
            keyId: publicKeyId,
            subscriptionId: existing.razorpay_subscription_id,
            trialEndsAt: existing.trial_ends_at,
            amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
            currency: 'INR',
            ownerName: user.user_metadata?.full_name || user.user_metadata?.name || '',
            ownerEmail: user.email || '',
            ownerPhone: user.phone || '',
          });
        }
        if (previousSubscription.status === 'created') {
          await razorpay.subscriptions.cancel(previousSubscription.id, false);
        } else if (!['expired', 'cancelled'].includes(previousSubscription.status)) {
          return NextResponse.json({ error: 'A subscription authorization is already in progress. Complete hostel setup or contact support.' }, { status: 409 });
        }
      }
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + HOSTEL_SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const trialEndsAtUnix = Math.floor(trialEndsAt.getTime() / 1000);
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 1200,
      quantity: 1,
      customer_notify: 1,
      start_at: trialEndsAtUnix,
      expire_by: Math.floor(now.getTime() / 1000) + AUTHORIZATION_WINDOW_SECONDS,
      notes: {
        owner_id: user.id,
        onboarding_id: parsed.data.onboardingId,
        monthly_price_inr: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_INR,
      },
    });

    const pendingRecord = {
      hostel_owner_id: user.id,
      hostel_id: pendingHostel.id,
      onboarding_id: parsed.data.onboardingId,
      razorpay_subscription_id: subscription.id,
      plan_id: planId,
      status: 'CREATED',
      billing_mode: 'AUTO_PAY',
      cancel_at_period_end: false,
      cancel_requested_at: null,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      trial_starts_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_end: trialEndsAt.toISOString(),
    };
    const { error: insertError } = existing
      ? await admin.from('owner_subscriptions').update(pendingRecord).eq('id', existing.id)
      : await admin.from('owner_subscriptions').insert(pendingRecord);
    if (insertError) {
      try {
        await razorpay.subscriptions.cancel(subscription.id, false);
      } catch (cancelError) {
        console.error('Unable to cancel untracked Razorpay subscription:', cancelError);
      }
      console.error('Failed to save pending owner subscription:', insertError);
      return NextResponse.json({ error: 'Unable to save the subscription checkout. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      billingMode: 'AUTO_PAY',
      keyId: publicKeyId,
      subscriptionId: subscription.id,
      trialEndsAt: trialEndsAt.toISOString(),
      amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
      currency: 'INR',
      ownerName: user.user_metadata?.full_name || user.user_metadata?.name || '',
      ownerEmail: user.email || '',
      ownerPhone: user.phone || '',
    });
  } catch (error) {
    console.error('Failed to create hostel subscription:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to start subscription checkout.',
    }, { status: 500 });
  }
}
