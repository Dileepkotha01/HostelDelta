import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isValidIndianMobileNumber, toIndianMobileE164 } from '@/lib/indian-mobile';
import {
  HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE,
  HOSTEL_SUBSCRIPTION_TRIAL_DAYS,
} from '@/lib/hostel-subscription';

const setupSchema = z.object({
  ownerId: z.string().uuid(),
  totalFloors: z.number().int().min(1).max(50),
  hostel: z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().max(500).default(''),
    city: z.string().trim().max(120).default(''),
    state: z.string().trim().max(120).default(''),
    phone: z.string().trim().max(30).refine((value) => value === '' || isValidIndianMobileNumber(value)).optional(),
    email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
    gstin: z.string().trim().max(15).refine((value) => value === '' || /^[0-9A-Z]{15}$/i.test(value), 'Enter a valid 15-character GSTIN.').optional(),
    amenities: z.record(z.unknown()).default({}),
    food_details: z.string().trim().max(2200).default(''),
  }),
  rooms: z.array(z.object({
    floorNumber: z.number().int().min(1).max(50),
    roomNumber: z.string().trim().min(1).max(30),
    sharing: z.number().int().min(1).max(10),
    rent: z.number().finite().min(0).max(10000000),
  })).min(1).max(500),
  payment: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('AUTO_PAY'),
      onboardingId: z.string().uuid(),
      subscriptionId: z.string().min(1).max(255),
      paymentId: z.string().min(1).max(255),
      signature: z.string().regex(/^[a-f0-9]{64}$/i),
    }),
    z.object({
      mode: z.literal('ONE_TIME'),
      onboardingId: z.string().uuid(),
      orderId: z.string().min(1).max(255),
      paymentId: z.string().min(1).max(255),
      signature: z.string().regex(/^[a-f0-9]{64}$/i),
    }),
  ]),
});

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Hostel setup is not configured.' }, { status: 503 });
  }
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId;
  const planId = process.env.RAZORPAY_HOSTEL_SUBSCRIPTION_PLAN_ID;
  if (!keyId || !keySecret || !publicKeyId || keyId !== publicKeyId) {
    return NextResponse.json({ error: 'Hostel payment billing is not configured.' }, { status: 503 });
  }

  let admin: SupabaseClient | null = null;
  let createdHostelId: string | null = null;
  let claimedSubscriptionId: string | null = null;
  let claimedSubscriptionPreviousStatus: string | null = null;

  try {
    const bodyResult = setupSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      const issues = bodyResult.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'hostel details',
        message: issue.message,
      }));
      return NextResponse.json({
        error: `Hostel details are invalid: ${issues.map((issue) => `${issue.field} ${issue.message}`).join('; ')}`,
      }, { status: 400 });
    }
    const { ownerId, hostel, rooms, totalFloors, payment } = bodyResult.data;
    if (payment.mode === 'AUTO_PAY' && !planId) {
      return NextResponse.json({ error: 'Automatic renewal is not configured. Choose one-time payment or configure RAZORPAY_HOSTEL_SUBSCRIPTION_PLAN_ID.' }, { status: 503 });
    }
    if (rooms.some((room) => room.floorNumber > totalFloors)) {
      return NextResponse.json({ error: 'Every room must belong to a configured floor.' }, { status: 400 });
    }
    const roomNumbers = rooms.map((room) => room.roomNumber.toLowerCase());
    if (new Set(roomNumbers).size !== roomNumbers.length) {
      return NextResponse.json({ error: 'Room numbers must be unique.' }, { status: 400 });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 });
    }
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'The requested owner does not match the signed-in user.' }, { status: 403 });
    }
    const { data: profile, error: profileLookupError } = await callerClient
      .from('profiles')
      .select('role, active, hostel_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileLookupError || !profile) {
      console.error('Failed to verify owner role for hostel setup:', profileLookupError);
      return NextResponse.json({ error: 'Unable to verify this account for hostel setup.' }, { status: 500 });
    }
    if (profile.role !== 'hostel_owner' || !profile.active) {
      return NextResponse.json({ error: 'Only hostel owners can create a hostel workspace.' }, { status: 403 });
    }
    // Profile hostel assignments are not writable by authenticated clients.
    // Only proceed with privileged writes after verifying this owner's session and role.
    admin = createSupabaseAdmin();

    const { data: pendingSubscription, error: pendingSubscriptionError } = await admin
      .from('owner_subscriptions')
      .select('id, status, hostel_id, plan_id, trial_ends_at, billing_mode, razorpay_subscription_id, razorpay_order_id')
      .eq('hostel_owner_id', user.id)
      .eq('onboarding_id', payment.onboardingId)
      .maybeSingle();
    if (pendingSubscriptionError || !pendingSubscription) {
      console.error('Unable to verify pending hostel subscription:', pendingSubscriptionError);
      return NextResponse.json({ error: 'The subscription checkout could not be verified. Please retry from onboarding.' }, { status: 409 });
    }
    if (
      pendingSubscription.billing_mode !== payment.mode ||
      (payment.mode === 'AUTO_PAY' && pendingSubscription.razorpay_subscription_id !== payment.subscriptionId) ||
      (payment.mode === 'ONE_TIME' && pendingSubscription.razorpay_order_id !== payment.orderId)
    ) {
      return NextResponse.json({ error: 'This payment does not match the saved hostel checkout. Resume payment from the dashboard.' }, { status: 409 });
    }
    const expectedSignature = createHmac('sha256', keySecret)
      .update(payment.mode === 'AUTO_PAY'
        ? `${payment.paymentId}|${payment.subscriptionId}`
        : `${payment.orderId}|${payment.paymentId}`)
      .digest();
    const receivedSignature = Buffer.from(payment.signature, 'hex');
    if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
      return NextResponse.json({ error: 'The payment authorization signature is invalid.' }, { status: 400 });
    }
    if (pendingSubscription.hostel_id) {
      const { data: completedOnboarding, error: completedLookupError } = await admin
        .from('owner_hostel_onboarding_drafts')
        .select('status')
        .eq('onboarding_id', payment.onboardingId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (completedLookupError) {
        console.error('Unable to verify completed hostel onboarding:', completedLookupError);
        return NextResponse.json({ error: 'Unable to verify hostel setup status.' }, { status: 500 });
      }
      if (completedOnboarding?.status === 'COMPLETED') {
        const emailSent = await completeOnboardingDraft(admin, user.id, payment.onboardingId, user.email || '', pendingSubscription.billing_mode);
        return NextResponse.json({ success: true, hostelId: pendingSubscription.hostel_id, emailSent });
      }
    }

    if (
      !['CREATED', 'TRIALING'].includes(pendingSubscription.status) ||
      (payment.mode === 'AUTO_PAY' && pendingSubscription.plan_id !== planId) ||
      (payment.mode === 'ONE_TIME' && pendingSubscription.plan_id !== 'one_time')
    ) {
      return NextResponse.json({ error: 'This subscription checkout is no longer available.' }, { status: 409 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    let authorizedTrialStart: number | null = null;
    let razorpayCustomerId: string | null = null;
    let paymentMethod: string | null = null;
    let paidThrough: string;
    if (payment.mode === 'AUTO_PAY') {
      const expectedTrialStart = pendingSubscription.trial_ends_at
        ? Math.floor(new Date(pendingSubscription.trial_ends_at).getTime() / 1000)
        : null;
      let subscriptionStatus: string | null = null;
      let paymentStatus: string | null = null;
      let actualTrialStart: number | null = null;
      let subscriptionMatches = false;
      let paymentMatches = false;
      let trialStartMatches = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const [verifiedSubscription, verifiedPayment] = await Promise.all([
          razorpay.subscriptions.fetch(payment.subscriptionId),
          razorpay.payments.fetch(payment.paymentId),
        ]);
        subscriptionStatus = verifiedSubscription.status;
        paymentStatus = verifiedPayment.status;
        actualTrialStart = verifiedSubscription.start_at || null;
        trialStartMatches = !!verifiedSubscription.start_at &&
          expectedTrialStart !== null &&
          Math.abs(verifiedSubscription.start_at - expectedTrialStart) <= 300;
        subscriptionMatches = verifiedSubscription.plan_id === planId &&
          verifiedSubscription.notes?.owner_id === user.id &&
          verifiedSubscription.notes?.onboarding_id === payment.onboardingId &&
          ['authenticated', 'active'].includes(verifiedSubscription.status);
        paymentMatches = verifiedPayment.subscription_id === payment.subscriptionId &&
          ['authorized', 'captured'].includes(verifiedPayment.status);
        if (subscriptionMatches && paymentMatches && trialStartMatches) {
          authorizedTrialStart = verifiedSubscription.start_at;
          razorpayCustomerId = verifiedSubscription.customer_id || null;
          paymentMethod = verifiedSubscription.payment_method || null;
          break;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }

      if (authorizedTrialStart === null) {
        console.error('Razorpay subscription authorization verification failed:', {
          subscriptionStatus,
          paymentStatus,
          subscriptionMatches,
          paymentMatches,
          trialStartMatches,
          expectedTrialStart,
          actualTrialStart,
        });
        return NextResponse.json({
          error: 'Razorpay has not confirmed this authorization yet. Your hostel details are saved; retry hostel setup shortly. If this continues, contact support.',
        }, { status: 402 });
      }
      paidThrough = new Date(authorizedTrialStart * 1000).toISOString();
    } else {
      const [order, initialPayment] = await Promise.all([
        razorpay.orders.fetch(payment.orderId),
        razorpay.payments.fetch(payment.paymentId),
      ]);
      if (
        order.amount !== HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE ||
        order.currency !== 'INR' ||
        order.notes?.category !== 'hostel_subscription' ||
        order.notes?.billing_mode !== 'ONE_TIME' ||
        order.notes?.owner_id !== user.id ||
        order.notes?.hostel_id !== pendingSubscription.hostel_id ||
        order.notes?.onboarding_id !== payment.onboardingId ||
        initialPayment.order_id !== payment.orderId ||
        initialPayment.amount !== order.amount ||
        initialPayment.currency !== 'INR' ||
        !['authorized', 'captured'].includes(initialPayment.status)
      ) {
        return NextResponse.json({ error: 'The one-time payment could not be verified.' }, { status: 402 });
      }
      const verifiedPayment = initialPayment.status === 'authorized'
        ? await razorpay.payments.capture(payment.paymentId, order.amount, 'INR')
        : initialPayment;
      const capturedPayment = verifiedPayment.status === 'captured'
        ? verifiedPayment
        : await razorpay.payments.fetch(payment.paymentId);
      if (capturedPayment.status !== 'captured') {
        return NextResponse.json({ error: 'Razorpay has not confirmed the one-time payment. Your hostel details are saved; try again shortly.' }, { status: 402 });
      }
      paymentMethod = capturedPayment.method || null;
      paidThrough = new Date(Date.now() + HOSTEL_SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    }

    claimedSubscriptionPreviousStatus = pendingSubscription.status;
    const { data: claimedSubscription, error: claimError } = await admin
      .from('owner_subscriptions')
      .update({ status: 'PROVISIONING' })
      .eq('id', pendingSubscription.id)
      .in('status', ['CREATED', 'TRIALING'])
      .select('id')
      .maybeSingle();
    if (claimError || !claimedSubscription) {
      if (claimError) console.error('Unable to reserve the subscription for hostel setup:', claimError);
      return NextResponse.json({ error: 'This subscription is already being used to complete a hostel setup.' }, { status: 409 });
    }
    claimedSubscriptionId = claimedSubscription.id;

    const { data: savedHostel, error: savedHostelError } = await admin
      .from('hostels')
      .select('id')
      .eq('owner_id', user.id)
      .eq('onboarding_id', payment.onboardingId)
      .maybeSingle();
    if (savedHostelError) {
      console.error('Unable to look up pending hostel workspace:', savedHostelError);
      throw new Error('Unable to load the saved hostel workspace.');
    }

    let newHostel = savedHostel;
    if (!newHostel) {
      const { data: createdHostel, error: hostelError } = await admin
      .from('hostels')
      .insert({
        name: hostel.name,
        city: hostel.city,
        state: hostel.state,
        address: hostel.address,
        phone: hostel.phone ? toIndianMobileE164(hostel.phone) : null,
        email: hostel.email || null,
        gstin: hostel.gstin?.toUpperCase() || null,
        amenities: hostel.amenities,
        food_details: hostel.food_details,
        owner_id: user.id,
        total_floors: totalFloors,
        total_rooms: rooms.length,
        billing_day: 5,
        currency: 'INR',
        voice_ai_provider: 'none',
        onboarding_id: payment.onboardingId,
      })
      .select('id')
      .single();

      if (hostelError || !createdHostel) {
        console.error('Hostel insert error:', hostelError);
        const schemaError = hostelError?.code === '42703' || hostelError?.code === 'PGRST204';
        throw new Error(schemaError
          ? 'The Supabase database is missing hostel contact or onboarding columns. Apply the latest hostel migrations, then try again.'
          : 'Hostel creation failed. Please try again or contact support.');
      }
      newHostel = createdHostel;
      createdHostelId = createdHostel.id;

      const floorsToInsert = Array.from({ length: totalFloors }, (_, index) => ({
        hostel_id: createdHostel.id,
        floor_number: index + 1,
        name: `Floor ${index + 1}`,
      }));
      const { data: insertedFloors, error: floorError } = await admin
        .from('floors')
        .insert(floorsToInsert)
        .select('id, floor_number');

      if (floorError || !insertedFloors) {
        console.error('Floor insert error:', floorError);
        throw new Error('Floor creation failed.');
      }

      const roomsToInsert = rooms.map((room) => {
        const floor = insertedFloors.find((item) => item.floor_number === room.floorNumber);
        if (!floor) throw new Error(`Floor ${room.floorNumber} was not created.`);
        return {
          hostel_id: createdHostel.id,
          floor_id: floor.id,
          room_number: room.roomNumber,
          room_type: room.sharing === 1 ? 'single' : room.sharing === 2 ? 'double' : 'triple',
          capacity: room.sharing,
          monthly_rent: room.rent,
          status: 'vacant',
        };
      });

      const { data: insertedRooms, error: roomError } = await admin
        .from('rooms')
        .insert(roomsToInsert)
        .select('id, room_number, capacity');

      if (roomError || !insertedRooms) {
        console.error('Room insert error:', roomError);
        throw new Error('Room creation failed.');
      }

      const bedsToInsert = insertedRooms.flatMap((room) =>
        Array.from({ length: room.capacity }, (_, index) => ({
          room_id: room.id,
          bed_label: `${room.room_number}-${String.fromCharCode(65 + index)}`,
          status: 'vacant',
        }))
      );

      const { error: bedError } = await admin.from('beds').insert(bedsToInsert);
      if (bedError) {
        console.error('Bed insert error:', bedError);
        throw new Error('Bed creation failed.');
      }
    }
    const hostelForSetup = newHostel;
    if (!hostelForSetup) throw new Error('The saved hostel workspace could not be found.');

    const { data: linkedSubscription, error: subscriptionUpdateError } = await admin
      .from('owner_subscriptions')
      .update({
        hostel_id: hostelForSetup.id,
        status: payment.mode === 'AUTO_PAY' ? 'TRIALING' : 'ACTIVE',
        billing_mode: payment.mode,
        cancel_at_period_end: false,
        cancel_requested_at: null,
        authorized_at: new Date().toISOString(),
        trial_starts_at: payment.mode === 'AUTO_PAY' ? new Date().toISOString() : null,
        trial_ends_at: payment.mode === 'AUTO_PAY' ? paidThrough : null,
        current_period_end: paidThrough,
        razorpay_payment_id: payment.paymentId,
        razorpay_customer_id: razorpayCustomerId,
        payment_method: paymentMethod,
        ...(payment.mode === 'ONE_TIME' ? { razorpay_subscription_id: null } : {}),
      })
      .eq('id', pendingSubscription.id)
      .eq('status', 'PROVISIONING')
      .select('id')
      .maybeSingle();
    if (subscriptionUpdateError || !linkedSubscription) {
      console.error('Unable to link the verified subscription to its hostel:', subscriptionUpdateError);
      throw new Error('The subscription was authorized, but could not be linked to the hostel. Please contact support.');
    }

    let billingHistoryWarning = false;
    if (payment.mode === 'ONE_TIME') {
      const { error: historyError } = await admin
        .from('owner_subscription_payments')
        .upsert({
          owner_subscription_id: linkedSubscription.id,
          hostel_id: hostelForSetup.id,
          hostel_owner_id: user.id,
          razorpay_order_id: payment.orderId,
          razorpay_payment_id: payment.paymentId,
          amount: HOSTEL_SUBSCRIPTION_MONTHLY_PRICE_PAISE / 100,
          currency: 'INR',
          status: 'PAID',
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
        }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });
      if (historyError) {
        console.error('Hostel is active but its initial payment history could not be saved:', historyError);
        billingHistoryWarning = true;
      }
    }

    const emailSent = await completeOnboardingDraft(admin, user.id, payment.onboardingId, user.email || '', payment.mode);
    return NextResponse.json({
      success: true,
      hostelId: hostelForSetup.id,
      message: 'Hostel and inventory generated successfully.',
      emailSent,
      billingHistoryWarning,
    });
  } catch (error) {
    console.error('Hostel setup error:', error);
    if (admin) {
      if (claimedSubscriptionId && admin) {
        const { error: subscriptionRollbackError } = await admin
          .from('owner_subscriptions')
          .update({ status: claimedSubscriptionPreviousStatus || 'CREATED' })
          .eq('id', claimedSubscriptionId)
          .eq('status', 'PROVISIONING');
        if (subscriptionRollbackError) {
          console.error('Failed to release the subscription after incomplete hostel setup:', subscriptionRollbackError);
        }
      }

      if (createdHostelId) {
        const { error: cleanupError } = await admin
          .from('hostels')
          .delete()
          .eq('id', createdHostelId);
        if (cleanupError) {
          console.error('Failed to roll back incomplete hostel setup:', cleanupError);
        }
      }
    }
    const message = error instanceof Error ? error.message : 'Hostel setup failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function completeOnboardingDraft(
  admin: SupabaseClient,
  ownerId: string,
  onboardingId: string,
  ownerEmail: string,
  billingMode: 'AUTO_PAY' | 'ONE_TIME'
) {
  const { data: existing, error: lookupError } = await admin
    .from('owner_hostel_onboarding_drafts')
    .select('hostel_name, last_notified_status')
    .eq('onboarding_id', onboardingId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (lookupError) {
    console.error('Unable to load completed hostel onboarding:', lookupError);
    throw new Error('The hostel was created, but payment status could not be finalized. Please retry from the dashboard.');
  }
  if (!existing) return false;

  const { error: updateError } = await admin
    .from('owner_hostel_onboarding_drafts')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('onboarding_id', onboardingId)
    .eq('owner_id', ownerId);
  if (updateError) {
    console.error('Unable to mark hostel onboarding complete:', updateError);
    throw new Error('The hostel was created, but payment status could not be finalized. Please retry from the dashboard.');
  }
  if (!ownerEmail || existing.last_notified_status === 'COMPLETED') return existing.last_notified_status === 'COMPLETED';

  const hostelName = existing.hostel_name;
  const billingMessage = billingMode === 'AUTO_PAY'
    ? 'Your 30-day free trial has started. Automatic monthly renewal is enabled.'
    : 'Your one-time payment is active for 30 days. Renew manually to continue using the hostel.';
  const email = await sendEmail({
    to: ownerEmail,
    subject: `${hostelName} is ready on HostelHub`,
    body: `Payment was successful and ${hostelName} has been created. ${billingMessage} Sign in to HostelHub and start adding tenants.`,
    html: `<p>Payment was successful and <strong>${escapeHtml(hostelName)}</strong> has been created.</p><p>${escapeHtml(billingMessage)} Sign in to HostelHub and start adding tenants.</p>`,
  });
  if (!email.success) {
    console.error('Unable to send hostel payment success email:', email.error);
    return false;
  }

  const { error: notificationError } = await admin
    .from('owner_hostel_onboarding_drafts')
    .update({ last_notified_status: 'COMPLETED' })
    .eq('onboarding_id', onboardingId)
    .eq('owner_id', ownerId);
  if (notificationError) {
    console.error('Unable to record hostel success email status:', notificationError);
  }
  return true;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}
