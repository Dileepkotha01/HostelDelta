import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const roleSchema = z.object({
  role: z.enum(['super_admin', 'hostel_owner', 'caretaker', 'tenant']),
});

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Role management is not configured.' }, { status: 503 });
  }

  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.userId)) {
      return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 });
    }

    const bodyResult = roleSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 });
    }
    if (user.id === params.userId) {
      return NextResponse.json({ error: 'You cannot change your own administrator role.' }, { status: 409 });
    }

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (callerProfileError) {
      console.error('Failed to verify role-management caller:', callerProfileError);
      return NextResponse.json({ error: 'Unable to verify your administrator access.' }, { status: 500 });
    }
    if (callerProfile?.role !== 'super_admin' || !callerProfile.active) {
      return NextResponse.json({ error: 'Active super-admin access is required.' }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { error: updateError } = await admin.rpc('set_profile_role', {
      p_target_user_id: params.userId,
      p_role: bodyResult.data.role,
      p_actor_user_id: user.id,
    });
    if (updateError) {
      console.error('Failed to update profile role:', updateError);
      return NextResponse.json({ error: 'The profile role could not be updated.' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role management request failed:', error);
    return NextResponse.json({ error: 'Role management failed.' }, { status: 500 });
  }
}
