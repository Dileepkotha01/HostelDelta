import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { requireEdgeBearer } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authError = requireEdgeBearer(req);
  if (authError) {
    Object.entries(corsHeaders).forEach(([key, value]) => authError.headers.set(key, value));
    return authError;
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const today = new Date();
    const month = today.getUTCMonth() + 1;
    const year = today.getUTCFullYear();
    const todayString = today.toISOString().split('T')[0];

    const { data: hostels, error: hostelError } = await supabase.from('hostels').select('id, billing_day');
    if (hostelError) throw hostelError;

    let generated = 0;
    let markedOverdue = 0;

    for (const hostel of hostels || []) {
      const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('id, full_name, monthly_rent, rent_due_day')
        .eq('hostel_id', hostel.id)
        .eq('status', 'active');
      if (tenantError) throw tenantError;

      for (const tenant of tenants || []) {
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('billing_month', month)
          .eq('billing_year', year)
          .maybeSingle();

        if (!existing) {
          const dueDay = Math.min(Math.max(Number(tenant.rent_due_day || hostel.billing_day || 1), 1), 28);
          const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
          const invoiceNumber = `INV-${year}-${String(month).padStart(2, '0')}-${tenant.id.slice(0, 8)}`;
          const { error: insertError } = await supabase.from('invoices').insert({
            hostel_id: hostel.id,
            tenant_id: tenant.id,
            invoice_number: invoiceNumber,
            billing_month: month,
            billing_year: year,
            amount: Number(tenant.monthly_rent || 0),
            amount_paid: 0,
            due_date: dueDate,
            status: 'pending',
          });
          if (insertError) throw insertError;
          generated++;
        }
      }
    }

    const { data: overdue, error: overdueError } = await supabase
      .from('invoices')
      .select('id')
      .in('status', ['pending', 'partial'])
      .lt('due_date', todayString);
    if (overdueError) throw overdueError;

    if ((overdue || []).length > 0) {
      const ids = overdue!.map((invoice) => invoice.id);
      const { error: markError } = await supabase.from('invoices').update({ status: 'overdue' }).in('id', ids);
      if (markError) throw markError;
      markedOverdue = ids.length;
    }

    return new Response(JSON.stringify({ success: true, generated, marked_overdue: markedOverdue }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Billing workflow failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
