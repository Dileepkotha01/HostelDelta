import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { buildTenantViewUrl } from '@/lib/signed-access';

const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => htmlEscapes[character]);

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Tenant email service is not configured.' }, { status: 503 });
  }

  try {
    const body: { tenantId?: unknown } = await request.json();
    if (typeof body.tenantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.tenantId)) {
      return NextResponse.json({ error: 'A valid tenantId is required.' }, { status: 400 });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      console.error('Failed to verify onboarding email caller:', profileError);
      return NextResponse.json({ error: 'Unable to verify this account.' }, { status: 500 });
    }
    if (
      !callerProfile?.active ||
      !['super_admin', 'hostel_owner', 'caretaker'].includes(callerProfile.role)
    ) {
      return NextResponse.json({ error: 'Only active hostel staff can send onboarding emails.' }, { status: 403 });
    }

    const { data: accessibleTenant, error: accessError } = await callerClient
      .from('tenants')
      .select('id, hostel_id')
      .eq('id', body.tenantId)
      .maybeSingle();
    if (accessError) {
      console.error('Failed to authorize onboarding email request:', accessError);
      return NextResponse.json({ error: 'Unable to authorize this request.' }, { status: 500 });
    }
    if (!accessibleTenant) {
      return NextResponse.json({ error: 'You do not have access to this tenant.' }, { status: 403 });
    }

    const { data: accessibleHostel, error: hostelAccessError } = await callerClient
      .from('hostels')
      .select('id')
      .eq('id', accessibleTenant.hostel_id)
      .maybeSingle();
    if (hostelAccessError) {
      console.error('Failed to authorize hostel email request:', hostelAccessError);
      return NextResponse.json({ error: 'Unable to authorize this request.' }, { status: 500 });
    }
    if (!accessibleHostel) {
      return NextResponse.json({ error: 'Only hostel staff can send onboarding emails.' }, { status: 403 });
    }

    const admin = createSupabaseAdmin();
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, hostel_id, full_name, phone, email, monthly_rent, security_deposit, rent_due_day, agreement_start, assigned_bed_id')
      .eq('id', accessibleTenant.id)
      .maybeSingle();
    if (tenantError || !tenant) {
      console.error('Failed to load tenant for onboarding email:', tenantError);
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }
    if (!tenant.email) {
      return NextResponse.json({ error: 'Tenant does not have an email address.' }, { status: 400 });
    }

    const { data: hostel, error: hostelError } = await admin
      .from('hostels')
      .select('name, address, phone')
      .eq('id', tenant.hostel_id)
      .single();
    if (hostelError || !hostel) {
      console.error('Failed to load hostel for onboarding email:', hostelError);
      return NextResponse.json({ error: 'Hostel details are unavailable.' }, { status: 500 });
    }

    let roomDisplay = 'Allocated Bed';
    let roomType = 'Standard';
    if (tenant.assigned_bed_id) {
      const { data: bed, error: bedError } = await admin
        .from('beds')
        .select('bed_label, room:rooms(room_number, room_type)')
        .eq('id', tenant.assigned_bed_id)
        .maybeSingle();
      if (bedError) {
        console.error('Failed to load room for onboarding email:', bedError);
        return NextResponse.json({ error: 'Room allocation details are unavailable.' }, { status: 500 });
      }
      const room = bed?.room as { room_number?: string; room_type?: string } | null;
      if (room?.room_number) {
        roomDisplay = `Room #${room.room_number} (Bed ${bed?.bed_label || 'A'})`;
        roomType = room.room_type || roomType;
      }
    }

    let portalUrl: string;
    try {
      portalUrl = buildTenantViewUrl(tenant.id);
    } catch (error) {
      console.error('Unable to sign tenant portal URL:', error);
      return NextResponse.json({ error: 'Signed resident links are not configured.' }, { status: 503 });
    }

    const hostelName = escapeHtml(hostel.name);
    const hostelAddress = escapeHtml(hostel.address || 'Hostel Campus');
    const fullName = escapeHtml(tenant.full_name);
    const phone = escapeHtml(tenant.phone);
    const safeRoomDisplay = escapeHtml(roomDisplay);
    const safeRoomType = escapeHtml(roomType);
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to ${hostelName}</title></head>
<body style="font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a">
  <main style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:32px">
    <h1>Welcome to ${hostelName}</h1>
    <p>Hello ${fullName}, your onboarding is confirmed.</p>
    <h2>Accommodation</h2>
    <p>Assigned bed: ${safeRoomDisplay}</p><p>Room type: ${safeRoomType}</p>
    <p>Primary phone: ${phone}</p><p>Hostel address: ${hostelAddress}</p>
    <h2>Rent and billing</h2>
    <p>Monthly rent: ₹${Number(tenant.monthly_rent || 0).toLocaleString('en-IN')}</p>
    <p>Security deposit: ₹${Number(tenant.security_deposit || 0).toLocaleString('en-IN')}</p>
    <p>Rent due date: Day ${tenant.rent_due_day || 1} of every month</p>
    <p><a href="${portalUrl}">View resident profile and rent history</a></p>
    <p>For updates, please contact your hostel manager.</p>
  </main>
</body></html>`;

    const sendResult = await sendEmail({
      to: tenant.email,
      hostelName: hostel.name,
      subject: `[${hostel.name}] Welcome! Your resident details and rent schedule`,
      body: `Hello ${tenant.full_name}, your onboarding at ${hostel.name} is confirmed. View your resident profile: ${portalUrl}`,
      html: htmlContent,
    });

    if (!sendResult.success) {
      console.error('Onboarding email provider rejected the message:', sendResult.error);
      return NextResponse.json({ error: 'The onboarding email could not be sent.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
