import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const requestSchema = z.object({
  hostelId: z.string().uuid(),
  action: z.literal('cancel_at_period_end'),
});

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  if (!supabaseUrl || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Subscription management is not configured.' }, { status: 503 });
  }
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay subscription management is not configured.' }, { status: 503 });
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid hostel and billing action are required.' }, { status: 400 });
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
      console.error('Unable to verify owner for subscription management:', profileError);
      return NextResponse.json({ error: 'Unable to verify this account.' }, { status: 500 });
    }
    if (profile.role !== 'hostel_owner' || !profile.active) {
      return NextResponse.json({ error: 'Only active hostel owners can manage subscriptions.' }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { data: subscription, error: subscriptionError } = await admin
      .from('owner_subscriptions')
      .select('id, status, billing_mode, razorpay_subscription_id, current_period_end, cancel_at_period_end')
      .eq('hostel_owner_id', user.id)
      .eq('hostel_id', parsed.data.hostelId)
      .maybeSingle();
    if (subscriptionError) {
      console.error('Unable to load subscription for cancellation:', subscriptionError);
      return NextResponse.json({ error: 'Unable to load this hostel subscription.' }, { status: 500 });
    }
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription was found for this hostel.' }, { status: 404 });
    }
    if (subscription.billing_mode !== 'AUTO_PAY' || !subscription.razorpay_subscription_id) {
      return NextResponse.json({ error: 'This hostel does not have an automatic renewal mandate to cancel.' }, { status: 409 });
    }
    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.current_period_end,
      });
    }
    if (subscription.status === 'CANCELLED') {
      const { error: cancelledUpdateError } = await admin
        .from('owner_subscriptions')
        .update({
          cancel_at_period_end: true,
          cancel_requested_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .eq('hostel_owner_id', user.id);
      if (cancelledUpdateError) {
        console.error('Unable to synchronize cancelled subscription state:', cancelledUpdateError);
        return NextResponse.json({ error: 'The subscription is already cancelled, but its status could not be synchronized.' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.current_period_end,
      });
    }
    if (!['TRIALING', 'ACTIVE'].includes(subscription.status)) {
      return NextResponse.json({ error: 'Only an active or trialing subscription can be cancelled.' }, { status: 409 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const gatewaySubscription = await razorpay.subscriptions.fetch(subscription.razorpay_subscription_id);
    if (['cancelled', 'completed', 'expired'].includes(gatewaySubscription.status)) {
      return NextResponse.json({ error: 'The Razorpay subscription is no longer active. Refresh billing details.' }, { status: 409 });
    }
    await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id, true);

    const { error: updateError } = await admin
      .from('owner_subscriptions')
      .update({
        cancel_at_period_end: true,
        cancel_requested_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .eq('hostel_owner_id', user.id);
    if (updateError) {
      console.error('Razorpay accepted cancellation but local subscription state could not be saved:', updateError);
      return NextResponse.json({
        error: 'Razorpay accepted the cancellation, but the billing page could not save the confirmation. Refresh the page or contact support.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.current_period_end,
    });
  } catch (error) {
    console.error('Unable to cancel hostel autopay:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to cancel automatic renewal.',
    }, { status: 500 });
  }
}
