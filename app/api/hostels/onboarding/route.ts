import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isValidIndianMobileNumber, toIndianMobileE164 } from '@/lib/indian-mobile';

const roomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(30),
  sharing: z.string().max(10),
  customSharing: z.string().max(10),
  rent: z.string().max(20),
});

const draftSchema = z.object({
  basic: z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().max(500),
    city: z.string().trim().min(1).max(120),
    state: z.string().max(120),
    phone: z.string().max(30).refine((value) => value === '' || isValidIndianMobileNumber(value)),
    email: z.union([z.string().trim().email().max(254), z.literal('')]),
    gstin: z.string().trim().max(15).refine((value) => value === '' || /^[0-9A-Z]{15}$/i.test(value)),
    amenities: z.record(z.boolean()),
    food: z.object({
      mess_available: z.boolean(),
      breakfast: z.boolean(),
      lunch: z.boolean(),
      dinner: z.boolean(),
      veg_only: z.boolean(),
      non_veg: z.boolean(),
      food_notes: z.string().max(2000),
    }),
  }),
  totalFloors: z.number().int().min(1).max(20),
  defaultSharing: z.string().max(10),
  defaultRent: z.string().max(20),
  floors: z.array(z.object({
    floorNumber: z.number().int().min(1).max(20),
    label: z.string().max(50),
    roomCount: z.number().int().min(0).max(50),
    rooms: z.array(roomSchema).max(50),
  })).min(1).max(20),
}).refine((draft) =>
  draft.floors.length === draft.totalFloors &&
  draft.floors.reduce((count, floor) => count + floor.rooms.length, 0) > 0 &&
  draft.floors.reduce((count, floor) => count + floor.rooms.length, 0) <= 500 &&
  draft.floors.every((floor) => floor.rooms.length === floor.roomCount) &&
  new Set(draft.floors.map((floor) => floor.floorNumber)).size === draft.floors.length
);

const requestSchema = z.object({
  onboardingId: z.string().uuid(),
  draft: draftSchema.optional(),
  event: z.enum(['PROCESSING', 'PAYMENT_FAILED']).optional(),
});

async function getOwner(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) };
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await caller.auth.getUser(accessToken);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 }) };
  }
  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error('Unable to verify hostel onboarding owner:', profileError);
    return { error: NextResponse.json({ error: 'Unable to verify this account for hostel setup.' }, { status: 500 }) };
  }
  if (profile.role !== 'hostel_owner' || !profile.active) {
    return { error: NextResponse.json({ error: 'Only active hostel owners can save a hostel setup.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const ownerResult = await getOwner(request);
  if ('error' in ownerResult) return ownerResult.error;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('owner_hostel_onboarding_drafts')
    .select('onboarding_id, hostel_name, draft, status')
    .eq('owner_id', ownerResult.user.id)
    .neq('status', 'COMPLETED')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Unable to load pending hostel onboarding:', error);
    return NextResponse.json({ error: 'Unable to load pending hostel setup.' }, { status: 500 });
  }
  const onboardingIds = (data || []).map((item) => item.onboarding_id);
  const { data: subscriptionData, error: subscriptionError } = onboardingIds.length
    ? await admin
      .from('owner_subscriptions')
      .select('onboarding_id, billing_mode')
      .eq('hostel_owner_id', ownerResult.user.id)
      .in('onboarding_id', onboardingIds)
    : { data: [], error: null };
  if (subscriptionError) {
    console.error('Unable to load pending hostel billing methods:', subscriptionError);
    return NextResponse.json({ error: 'Unable to load pending hostel payment options.' }, { status: 500 });
  }
  const billingModeByOnboarding = new Map(
    (subscriptionData || []).map((item) => [item.onboarding_id, item.billing_mode])
  );
  return NextResponse.json({
    onboardings: (data || []).map((item) => ({
      ...item,
      billingMode: billingModeByOnboarding.get(item.onboarding_id) || 'ONE_TIME',
    })),
  });
}

export async function POST(request: Request) {
  const ownerResult = await getOwner(request);
  if ('error' in ownerResult) return ownerResult.error;

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Hostel onboarding details are invalid.' }, { status: 400 });
    }
    const { onboardingId, draft, event } = parsed.data;
    const admin = createSupabaseAdmin();

    const { data: previous, error: lookupError } = await admin
      .from('owner_hostel_onboarding_drafts')
      .select('owner_id, status, last_notified_status')
      .eq('onboarding_id', onboardingId)
      .maybeSingle();
    if (lookupError) {
      console.error('Unable to verify pending hostel onboarding:', lookupError);
      return NextResponse.json({ error: 'Unable to save hostel setup.' }, { status: 500 });
    }
    if (previous && previous.owner_id !== ownerResult.user.id) {
      return NextResponse.json({ error: 'This hostel setup does not belong to this account.' }, { status: 403 });
    }
    if (previous?.status === 'COMPLETED') {
      return NextResponse.json({ error: 'This hostel setup is already complete.' }, { status: 409 });
    }

    if (draft) {
      const { data: saved, error: saveError } = await admin
        .from('owner_hostel_onboarding_drafts')
        .upsert({
          onboarding_id: onboardingId,
          owner_id: ownerResult.user.id,
          hostel_name: draft.basic.name,
          draft,
          status: event || previous?.status || 'PENDING_PAYMENT',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'onboarding_id' })
        .select('onboarding_id')
        .single();
      if (saveError || !saved) {
        console.error('Unable to persist hostel onboarding details:', saveError);
        return NextResponse.json({ error: 'Unable to save your hostel details. Please try again.' }, { status: 500 });
      }
      try {
        await ensurePendingHostel(admin, ownerResult.user.id, onboardingId, draft);
      } catch (error) {
        console.error('Unable to prepare pending hostel workspace:', error);
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unable to prepare the saved hostel workspace.',
        }, { status: 500 });
      }
    } else if (event) {
      const { error: updateError } = await admin
        .from('owner_hostel_onboarding_drafts')
        .update({ status: event, updated_at: new Date().toISOString() })
        .eq('onboarding_id', onboardingId)
        .eq('owner_id', ownerResult.user.id);
      if (updateError) {
        console.error('Unable to update hostel payment status:', updateError);
        return NextResponse.json({ error: 'Unable to update payment status.' }, { status: 500 });
      }
    }

    const notifyStatus = event;
    const shouldNotify = !!notifyStatus && previous?.last_notified_status !== notifyStatus;
    let emailSent: boolean | null = null;
    if (shouldNotify && ownerResult.user.email) {
      const failed = notifyStatus === 'PAYMENT_FAILED';
      const hostelName = draft?.basic.name;
      const result = await sendEmail({
        to: ownerResult.user.email,
        subject: failed ? `Payment failed for ${hostelName || 'your hostel'}` : `Complete payment for ${hostelName || 'your hostel'}`,
        body: failed
          ? `The subscription authorization for ${hostelName || 'your hostel'} did not complete. Your hostel details are saved. Sign in to your HostelHub dashboard and choose “Continue payment” to retry.`
          : `Payment for ${hostelName || 'your hostel'} has not been completed yet. Your hostel details are saved. Sign in to your HostelHub dashboard and choose “Continue payment” whenever you are ready.`,
        html: `<p>${failed ? 'The subscription authorization did not complete.' : 'Your subscription checkout is awaiting authorization.'}</p><p>Your hostel details for <strong>${escapeHtml(hostelName || 'your hostel')}</strong> are saved. Sign in to your HostelHub dashboard and choose <strong>Continue payment</strong> to continue without entering the details again.</p>`,
      });
      emailSent = result.success;
      if (result.success) {
        const { error: notificationError } = await admin
          .from('owner_hostel_onboarding_drafts')
          .update({ last_notified_status: notifyStatus })
          .eq('onboarding_id', onboardingId)
          .eq('owner_id', ownerResult.user.id);
        if (notificationError) console.error('Unable to record hostel payment email status:', notificationError);
      } else {
        console.error('Unable to send hostel payment status email:', result.error);
      }
    }

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    console.error('Hostel onboarding persistence error:', error);
    return NextResponse.json({ error: 'Unable to save hostel onboarding.' }, { status: 500 });
  }
}

async function ensurePendingHostel(
  admin: ReturnType<typeof createSupabaseAdmin>,
  ownerId: string,
  onboardingId: string,
  draft: z.infer<typeof draftSchema>
) {
  const { data: existing, error: lookupError } = await admin
    .from('hostels')
    .select('id')
    .eq('onboarding_id', onboardingId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (lookupError) throw new Error('Unable to check the saved hostel workspace.');
  if (existing) return;

  const food = draft.basic.food;
  const foodDetails = food.mess_available
    ? `Mess: Yes | ${[food.breakfast && 'Breakfast', food.lunch && 'Lunch', food.dinner && 'Dinner'].filter(Boolean).join(', ')} | ${food.veg_only ? 'Veg Only' : food.non_veg ? 'Veg & Non-Veg' : ''} | ${food.food_notes}`
    : food.food_notes || 'No mess';
  const rooms = draft.floors.flatMap((floor) => floor.rooms.map((room) => {
    const sharing = room.sharing === 'custom' ? Number.parseInt(room.customSharing, 10) : Number.parseInt(room.sharing, 10);
    const rent = Number.parseFloat(room.rent);
    if (!Number.isInteger(sharing) || sharing < 1 || sharing > 10 || !Number.isFinite(rent) || rent <= 0 || rent > 10000000) {
      throw new Error(`Room ${room.roomNumber} has invalid sharing or rent details.`);
    }
    return { floorNumber: floor.floorNumber, roomNumber: room.roomNumber, sharing, rent };
  }));
  if (!rooms.length || rooms.length > 500 || rooms.some((room) => room.floorNumber > draft.totalFloors)) {
    throw new Error('The saved room inventory is invalid. Reopen the hostel setup and review the rooms.');
  }
  if (new Set(rooms.map((room) => room.roomNumber.toLowerCase())).size !== rooms.length) {
    throw new Error('Room numbers must be unique.');
  }

  const { data: hostel, error: hostelError } = await admin
    .from('hostels')
    .insert({
      name: draft.basic.name,
      address: draft.basic.address,
      city: draft.basic.city,
      state: draft.basic.state,
      phone: draft.basic.phone ? toIndianMobileE164(draft.basic.phone) : null,
      email: draft.basic.email || null,
      gstin: draft.basic.gstin.toUpperCase() || null,
      amenities: draft.basic.amenities,
      food_details: foodDetails,
      owner_id: ownerId,
      total_floors: draft.totalFloors,
      total_rooms: rooms.length,
      billing_day: 5,
      currency: 'INR',
      voice_ai_provider: 'none',
      onboarding_id: onboardingId,
    })
    .select('id')
    .single();
  if (hostelError || !hostel) {
    console.error('Unable to create pending hostel workspace:', hostelError);
    throw new Error('Unable to create the saved hostel workspace.');
  }

  try {
    const floorsToInsert = Array.from({ length: draft.totalFloors }, (_, index) => ({
      hostel_id: hostel.id,
      floor_number: index + 1,
      name: `Floor ${index + 1}`,
    }));
    const { data: floors, error: floorError } = await admin
      .from('floors')
      .insert(floorsToInsert)
      .select('id, floor_number');
    if (floorError || !floors) throw new Error('Floor creation failed.');

    const roomRows = rooms.map((room) => {
      const floor = floors.find((item) => item.floor_number === room.floorNumber);
      if (!floor) throw new Error(`Floor ${room.floorNumber} was not created.`);
      return {
        hostel_id: hostel.id,
        floor_id: floor.id,
        room_number: room.roomNumber,
        room_type: room.sharing === 1 ? 'single' : room.sharing === 2 ? 'double' : 'triple',
        capacity: room.sharing,
        monthly_rent: room.rent,
        status: 'vacant',
      };
    });
    const { data: insertedRooms, error: roomsError } = await admin
      .from('rooms')
      .insert(roomRows)
      .select('id, room_number, capacity');
    if (roomsError || !insertedRooms) throw new Error('Room creation failed.');

    const beds = insertedRooms.flatMap((room) =>
      Array.from({ length: room.capacity }, (_, index) => ({
        room_id: room.id,
        bed_label: `${room.room_number}-${String.fromCharCode(65 + index)}`,
        status: 'vacant',
      }))
    );
    const { error: bedsError } = await admin.from('beds').insert(beds);
    if (bedsError) throw new Error('Bed creation failed.');
  } catch (error) {
    const { error: cleanupError } = await admin.from('hostels').delete().eq('id', hostel.id);
    if (cleanupError) console.error('Unable to clean up incomplete pending hostel workspace:', cleanupError);
    throw error;
  }
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
