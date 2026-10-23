import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken } from '@/lib/api-auth';
import { buildInvoicePayUrl } from '@/lib/signed-access';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Payment links are not configured.' }, { status: 503 });
  }

  try {
    const body: { invoiceId?: unknown } = await request.json();
    if (typeof body.invoiceId !== 'string' || !UUID_RE.test(body.invoiceId)) {
      return NextResponse.json({ error: 'A valid invoiceId is required.' }, { status: 400 });
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
      return NextResponse.json({ error: 'The session is invalid or expired.' }, { status: 401 });
    }

    const { data: invoice, error: accessError } = await caller
      .from('invoices')
      .select('id, hostel_id, status')
      .eq('id', body.invoiceId)
      .maybeSingle();
    if (accessError) {
      console.error('Failed to authorize payment link request:', accessError);
      return NextResponse.json({ error: 'Unable to authorize this request.' }, { status: 500 });
    }
    if (!invoice) {
      return NextResponse.json({ error: 'You do not have access to this invoice.' }, { status: 403 });
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 409 });
    }

    let paymentUrl: string;
    try {
      paymentUrl = buildInvoicePayUrl(invoice.id);
    } catch (error) {
      console.error('Unable to sign rent payment link:', error);
      return NextResponse.json({ error: 'Signed payment links are not configured.' }, { status: 503 });
    }

    const admin = createSupabaseAdmin();
    const { error: updateError } = await admin
      .from('invoices')
      .update({ payment_link: paymentUrl })
      .eq('id', invoice.id);
    if (updateError) {
      console.error('Failed to persist payment link:', updateError);
      return NextResponse.json({ error: 'Unable to store the payment link.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    console.error('Payment link error:', error);
    return NextResponse.json({ error: 'Unable to create the payment link.' }, { status: 500 });
  }
}
