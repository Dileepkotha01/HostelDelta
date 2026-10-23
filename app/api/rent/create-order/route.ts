import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { extractBearerToken } from '@/lib/api-auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { verifySignedAccessToken } from '@/lib/signed-access';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeRentCheckout(
  request: Request,
  invoiceId: string,
  signedToken: unknown,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (typeof signedToken === 'string') {
    const access = verifySignedAccessToken(signedToken, 'invoice_pay', invoiceId);
    if (access.ok) return { ok: true };
  }

  const accessToken = extractBearerToken(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'A valid payment access token or resident session is required.' },
        { status: 401 },
      ),
    };
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser(accessToken);
  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 }),
    };
  }

  const { data: invoice, error } = await caller
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) {
    console.error('Failed to authorize resident rent checkout:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to authorize this payment.' }, { status: 500 }),
    };
  }
  if (!invoice) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'You do not have access to this invoice.' }, { status: 403 }),
    };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body: { invoiceId?: unknown; accessToken?: unknown } = await request.json();
    if (typeof body.invoiceId !== 'string' || !UUID_RE.test(body.invoiceId)) {
      return NextResponse.json({ error: 'A valid invoiceId is required.' }, { status: 400 });
    }

    const authorized = await authorizeRentCheckout(request, body.invoiceId, body.accessToken);
    if (!authorized.ok) return authorized.response;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId || !keySecret || !publicKeyId || keyId !== publicKeyId) {
      return NextResponse.json({ error: 'Online rent payments are not configured.' }, { status: 503 });
    }

    const supabase = createSupabaseAdmin();
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, tenant_id, hostel_id, invoice_number, billing_month, billing_year, amount, amount_paid, status')
      .eq('id', body.invoiceId)
      .maybeSingle();

    if (invoiceError) {
      console.error('Failed to load invoice for payment:', invoiceError);
      return NextResponse.json({ error: 'Unable to verify this invoice.' }, { status: 500 });
    }
    if (!invoice || invoice.status === 'paid') {
      return NextResponse.json({ error: 'This invoice is unavailable or already paid.' }, { status: 404 });
    }

    const amountDue = Number(invoice.amount) - Number(invoice.amount_paid || 0);
    if (!Number.isFinite(amountDue) || amountDue <= 0) {
      return NextResponse.json({ error: 'This invoice has no outstanding balance.' }, { status: 409 });
    }

    const { data: pendingTransaction, error: pendingError } = await supabase
      .from('rent_transactions')
      .select('id, razorpay_order_id, total_amount')
      .eq('invoice_id', invoice.id)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (pendingError) {
      console.error('Failed to check existing rent payment attempt:', pendingError);
      return NextResponse.json({ error: 'Unable to check for an existing payment attempt.' }, { status: 500 });
    }
    if (pendingTransaction) {
      const pendingAmount = Number(pendingTransaction.total_amount);
      if (!pendingTransaction.razorpay_order_id || !Number.isFinite(pendingAmount) || pendingAmount > amountDue) {
        return NextResponse.json(
          { error: 'An existing payment attempt needs support before another payment can be started.' },
          { status: 409 },
        );
      }
      return NextResponse.json({
        success: true,
        keyId: publicKeyId,
        orderId: pendingTransaction.razorpay_order_id,
        transactionId: pendingTransaction.id,
        amount: pendingAmount,
        currency: 'INR',
      });
    }

    const { data: hostel, error: hostelError } = await supabase
      .from('hostels')
      .select('id, owner_id')
      .eq('id', invoice.hostel_id)
      .maybeSingle();
    if (hostelError || !hostel) {
      console.error('Failed to verify hostel for invoice:', hostelError);
      return NextResponse.json({ error: 'Unable to verify the invoice hostel.' }, { status: 500 });
    }

    const { data: ownerAccount, error: ownerError } = await supabase
      .from('owner_payment_accounts')
      .select('razorpay_account_id, verification_status, hostel_owner_id')
      .eq('hostel_id', invoice.hostel_id)
      .eq('hostel_owner_id', hostel.owner_id)
      .eq('verification_status', 'ACTIVE')
      .maybeSingle();

    if (ownerError) {
      console.error('Failed to verify hostel payout account:', ownerError);
      return NextResponse.json({ error: 'Unable to verify the hostel payout account.' }, { status: 500 });
    }
    if (!ownerAccount) {
      return NextResponse.json(
        { error: 'The hostel has not completed verified Razorpay payout setup.' },
        { status: 409 },
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, assigned_bed_id')
      .eq('id', invoice.tenant_id)
      .maybeSingle();
    if (tenantError || !tenant) {
      console.error('Failed to verify tenant for invoice:', tenantError);
      return NextResponse.json({ error: 'Unable to verify this invoice tenant.' }, { status: 500 });
    }

    let roomNumber = 'N/A';
    if (tenant.assigned_bed_id) {
      const { data: bed, error: bedError } = await supabase
        .from('beds')
        .select('room:rooms(room_number)')
        .eq('id', tenant.assigned_bed_id)
        .maybeSingle();
      if (bedError) {
        console.error('Failed to load tenant room for payment:', bedError);
        return NextResponse.json({ error: 'Unable to verify the tenant room.' }, { status: 500 });
      }
      const room = bed?.room as { room_number?: string } | null;
      roomNumber = room?.room_number || roomNumber;
    }

    const month = new Date(Date.UTC(invoice.billing_year, invoice.billing_month - 1, 1)).toLocaleString(
      'en',
      { month: 'long', timeZone: 'UTC' },
    );
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const amountInPaise = Math.round(amountDue * 100);
    if (Math.abs(amountDue * 100 - amountInPaise) > 0.001) {
      return NextResponse.json(
        { error: 'Invoice amount must have no more than two decimal places.' },
        { status: 400 },
      );
    }

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `inv_${invoice.id.replace(/-/g, '').slice(0, 32)}`,
      notes: {
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        hostel_id: invoice.hostel_id,
        month,
        year: String(invoice.billing_year),
        category: 'tenant_rent',
      },
      transfers: [
        {
          account: ownerAccount.razorpay_account_id,
          amount: amountInPaise,
          currency: 'INR',
          on_hold: false,
        },
      ],
    });

    const { data: transaction, error: txError } = await supabase
      .from('rent_transactions')
      .insert({
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        hostel_id: invoice.hostel_id,
        room_number: roomNumber,
        rent_month: month,
        rent_year: invoice.billing_year,
        total_amount: amountDue,
        razorpay_order_id: rzpOrder.id,
        status: 'PENDING',
      })
      .select()
      .single();

    if (txError) {
      if (txError.code === '23505') {
        return NextResponse.json(
          { error: 'A payment attempt already exists for this rent period.' },
          { status: 409 },
        );
      }
      console.error('Error inserting rent transaction:', txError);
      return NextResponse.json({ error: 'Unable to record the payment attempt.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      keyId: publicKeyId,
      orderId: rzpOrder.id,
      transactionId: transaction.id,
      amount: amountDue,
      currency: 'INR',
    });
  } catch (error) {
    console.error('Create rent order error:', error);
    return NextResponse.json({ error: 'Unable to create the payment order.' }, { status: 500 });
  }
}
