import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE, HOSTEL_SUBSCRIPTION_TRIAL_DAYS } from '@/lib/hostel-subscription';

const createSchema = z.object({ hostelId: z.string().uuid() });
const verifySchema = z.object({
  hostelId: z.string().uuid(),
  orderId: z.string().min(1).max(255),
  paymentId: z.string().min(1).max(255),
  signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

async function getOwner(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { response: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) };
  }
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await caller.auth.getUser(accessToken);
  if (error || !user) {
    return { response: NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 }) };
  }
  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error('Unable to verify owner for subscription renewal:', profileError);
    return { response: NextResponse.json({ error: 'Unable to verify this account.' }, { status: 500 }) };
  }
  if (profile.role !== 'hostel_owner' || !profile.active) {
    return { response: NextResponse.json({ error: 'Only active hostel owners can renew a hostel.' }, { status: 403 }) };
  }
  return { user };
}

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId;
  if (!keyId || !keySecret || !publicKeyId || keyId !== publicKeyId) {
    return { error: NextResponse.json({ error: 'Hostel payments are not configured.' }, { status: 503 }) };
  }
  return { razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId: publicKeyId, keySecret };
}

async function recordSubscriptionPayment(
  admin: ReturnType<typeof createSupabaseAdmin>,
  payment: {
    subscriptionId: string;
    hostelId: string;
    ownerId: string;
    orderId: string;
    paymentId: string;
    paymentMethod: string | null;
    paidAt: string;
  }
) {
  const { error } = await admin
    .from('owner_subscription_payments')
    .upsert({
      owner_subscription_id: payment.subscriptionId,
      hostel_id: payment.hostelId,
      hostel_owner_id: payment.ownerId,
      razorpay_order_id: payment.orderId,
      razorpay_payment_id: payment.paymentId,
      amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE / 100,
      currency: 'INR',
      status: 'PAID',
      payment_method: payment.paymentMethod,
      paid_at: payment.paidAt,
    }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });
  return error;
}

export async function POST(request: Request) {
  try {
    const ownerResult = await getOwner(request);
    if ('response' in ownerResult) return ownerResult.response;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'A valid hostel is required.' }, { status: 400 });
    const razorpayResult = getRazorpay();
    if ('error' in razorpayResult) return razorpayResult.error;

    const admin = createSupabaseAdmin();
    const { data: hostel, error: hostelError } = await admin
      .from('hostels')
      .select('id, name')
      .eq('id', parsed.data.hostelId)
      .eq('owner_id', ownerResult.user.id)
      .maybeSingle();
    if (hostelError || !hostel) {
      console.error('Unable to verify hostel for billing renewal:', hostelError);
      return NextResponse.json({ error: 'Unable to verify this hostel.' }, { status: 404 });
    }
    const { data: subscription, error: subscriptionError } = await admin
      .from('owner_subscriptions')
      .select('id, status, current_period_end, razorpay_order_id')
      .eq('hostel_owner_id', ownerResult.user.id)
      .eq('hostel_id', hostel.id)
      .maybeSingle();
    if (subscriptionError || !subscription) {
      console.error('Unable to load hostel subscription for renewal:', subscriptionError);
      return NextResponse.json({ error: 'No renewable subscription was found for this hostel.' }, { status: 409 });
    }

    if (subscription.razorpay_order_id) {
      const existingOrder = await razorpayResult.razorpay.orders.fetch(subscription.razorpay_order_id);
      if (existingOrder.status !== 'paid') {
        return NextResponse.json({
          success: true,
          keyId: razorpayResult.keyId,
          orderId: existingOrder.id,
          amount: existingOrder.amount,
          currency: existingOrder.currency,
          hostelName: hostel.name,
        });
      }
    }

    const order = await razorpayResult.razorpay.orders.create({
      amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
      currency: 'INR',
      receipt: `renew_${subscription.id.replace(/-/g, '').slice(0, 32)}`,
      notes: {
        category: 'hostel_subscription_renewal',
        billing_mode: 'ONE_TIME',
        owner_id: ownerResult.user.id,
        hostel_id: hostel.id,
        subscription_record_id: subscription.id,
      },
    });
    const { error: updateError } = await admin
      .from('owner_subscriptions')
      .update({ razorpay_order_id: order.id, billing_mode: 'ONE_TIME' })
      .eq('id', subscription.id);
    if (updateError) {
      console.error('Unable to save hostel renewal order:', updateError);
      return NextResponse.json({ error: 'Unable to save the renewal payment. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      keyId: razorpayResult.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      hostelName: hostel.name,
    });
  } catch (error) {
    console.error('Unable to create hostel renewal payment:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start renewal payment.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ownerResult = await getOwner(request);
    if ('response' in ownerResult) return ownerResult.response;
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'The renewal payment response is invalid.' }, { status: 400 });
    const razorpayResult = getRazorpay();
    if ('error' in razorpayResult) return razorpayResult.error;

    const expectedSignature = createHmac('sha256', razorpayResult.keySecret)
      .update(`${parsed.data.orderId}|${parsed.data.paymentId}`)
      .digest();
    const receivedSignature = Buffer.from(parsed.data.signature, 'hex');
    if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
      return NextResponse.json({ error: 'The renewal payment signature is invalid.' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: subscription, error: subscriptionError } = await admin
      .from('owner_subscriptions')
      .select('id, current_period_end, razorpay_order_id, razorpay_payment_id, hostel_id')
      .eq('hostel_owner_id', ownerResult.user.id)
      .eq('hostel_id', parsed.data.hostelId)
      .eq('razorpay_order_id', parsed.data.orderId)
      .maybeSingle();
    if (subscriptionError || !subscription) {
      console.error('Unable to verify the saved hostel renewal:', subscriptionError);
      return NextResponse.json({ error: 'This renewal does not match the selected hostel.' }, { status: 409 });
    }
    if (subscription.razorpay_payment_id === parsed.data.paymentId) {
      const historyError = await recordSubscriptionPayment(admin, {
        subscriptionId: subscription.id,
        hostelId: parsed.data.hostelId,
        ownerId: ownerResult.user.id,
        orderId: parsed.data.orderId,
        paymentId: parsed.data.paymentId,
        paymentMethod: null,
        paidAt: new Date().toISOString(),
      });
      if (historyError) console.error('Unable to repair hostel renewal payment history:', historyError);
      return NextResponse.json({
        success: true,
        currentPeriodEnd: subscription.current_period_end,
        billingHistoryWarning: !!historyError,
      });
    }
    const { data: hostel, error: hostelError } = await admin
      .from('hostels')
      .select('id')
      .eq('id', parsed.data.hostelId)
      .eq('owner_id', ownerResult.user.id)
      .maybeSingle();
    if (hostelError || !hostel) {
      console.error('Unable to verify the renewal hostel:', hostelError);
      return NextResponse.json({ error: 'Unable to verify this hostel.' }, { status: 404 });
    }

    const [order, initialPayment] = await Promise.all([
      razorpayResult.razorpay.orders.fetch(parsed.data.orderId),
      razorpayResult.razorpay.payments.fetch(parsed.data.paymentId),
    ]);
    if (
      order.amount !== HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE ||
      order.currency !== 'INR' ||
      order.notes?.category !== 'hostel_subscription_renewal' ||
      order.notes?.owner_id !== ownerResult.user.id ||
      order.notes?.hostel_id !== hostel.id ||
      order.notes?.subscription_record_id !== subscription.id ||
      initialPayment.order_id !== order.id ||
      initialPayment.amount !== order.amount ||
      initialPayment.currency !== 'INR' ||
      !['authorized', 'captured'].includes(initialPayment.status)
    ) {
      return NextResponse.json({ error: 'Razorpay could not verify this renewal payment.' }, { status: 402 });
    }
    const capturedPayment = initialPayment.status === 'authorized'
      ? await razorpayResult.razorpay.payments.capture(initialPayment.id, order.amount, 'INR')
      : initialPayment;
    if (capturedPayment.status !== 'captured') {
      return NextResponse.json({ error: 'Razorpay has not confirmed the renewal payment yet.' }, { status: 402 });
    }

    const periodStart = Math.max(Date.now(), subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0);
    const currentPeriodEnd = new Date(periodStart + HOSTEL_SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let updateQuery = admin
      .from('owner_subscriptions')
      .update({
        status: 'ACTIVE',
        billing_mode: 'ONE_TIME',
        cancel_at_period_end: false,
        cancel_requested_at: null,
        current_period_end: currentPeriodEnd,
        trial_ends_at: null,
        razorpay_payment_id: capturedPayment.id,
        payment_method: capturedPayment.method || null,
        authorized_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .eq('razorpay_order_id', order.id);
    updateQuery = subscription.razorpay_payment_id
      ? updateQuery.eq('razorpay_payment_id', subscription.razorpay_payment_id)
      : updateQuery.is('razorpay_payment_id', null);
    const { data: updated, error: updateError } = await updateQuery.select('id').maybeSingle();
    if (updateError || !updated) {
      if (updateError) console.error('Unable to activate hostel after manual renewal:', updateError);
      const { data: latest, error: latestError } = await admin
        .from('owner_subscriptions')
        .select('razorpay_payment_id, current_period_end')
        .eq('id', subscription.id)
        .maybeSingle();
      if (!latestError && latest?.razorpay_payment_id === capturedPayment.id) {
        const historyError = await recordSubscriptionPayment(admin, {
          subscriptionId: subscription.id,
          hostelId: parsed.data.hostelId,
          ownerId: ownerResult.user.id,
          orderId: parsed.data.orderId,
          paymentId: capturedPayment.id,
          paymentMethod: capturedPayment.method || null,
          paidAt: new Date().toISOString(),
        });
        if (historyError) console.error('Unable to record concurrent hostel renewal payment history:', historyError);
        return NextResponse.json({
          success: true,
          currentPeriodEnd: latest.current_period_end,
          billingHistoryWarning: !!historyError,
        });
      }
      if (latestError) console.error('Unable to confirm concurrent hostel renewal:', latestError);
      return NextResponse.json({ error: 'Payment was captured, but the hostel renewal could not be activated. Contact support with payment ID.' }, { status: 500 });
    }
    const historyError = await recordSubscriptionPayment(admin, {
      subscriptionId: subscription.id,
      hostelId: parsed.data.hostelId,
      ownerId: ownerResult.user.id,
      orderId: parsed.data.orderId,
      paymentId: capturedPayment.id,
      paymentMethod: capturedPayment.method || null,
      paidAt: new Date().toISOString(),
    });
    if (historyError) console.error('Hostel is active but its renewal payment history could not be saved:', historyError);
    return NextResponse.json({ success: true, currentPeriodEnd, billingHistoryWarning: !!historyError });
  } catch (error) {
    console.error('Unable to verify hostel renewal payment:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify the renewal payment.' }, { status: 500 });
  }
}
