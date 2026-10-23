import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TenantPaymentClient } from './TenantPaymentClient';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { verifySignedAccessToken } from '@/lib/signed-access';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: 'Rent payment | Kupera',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function TenantPayPage({
  params,
  searchParams,
}: {
  params: { invoiceId: string };
  searchParams: { t?: string };
}) {
  if (!UUID_RE.test(params.invoiceId)) {
    return notFound();
  }

  const access = verifySignedAccessToken(searchParams.t, 'invoice_pay', params.invoiceId);
  if (!access.ok) {
    return notFound();
  }

  const supabase = createSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, hostel_id, tenant_id, billing_month, billing_year, amount, amount_paid, status, tenant:tenants(full_name, email, phone), hostel:hostels(name)',
    )
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return notFound();
  }

  return <TenantPaymentClient invoice={invoice} accessToken={searchParams.t!} />;
}
