import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { requireEdgeBearer } from '../_shared/auth.ts';
import { createInvoicePayUrl } from '../_shared/signed-link.ts';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const action = body.action || 'detect_overdue';

    if (action === 'detect_overdue') {
      const { data: overdueInvoices, error } = await supabase
        .from('invoices')
        .select('*, tenant:tenants(*), hostel:hostels(*)')
        .in('status', ['pending', 'partial'])
        .lt('due_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      let updated = 0;
      const callsToTrigger: Array<{ tenant: any; invoice: any }> = [];

      for (const inv of overdueInvoices || []) {
        await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .eq('id', inv.id);

        updated++;

        if (inv.tenant && !inv.tenant.pause_ai_calls) {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const amountDue = Number(inv.amount) - Number(inv.amount_paid);

          const { data: existingCall } = await supabase
            .from('ai_call_logs')
            .select('id')
            .eq('tenant_id', inv.tenant_id)
            .in('call_status', ['scheduled', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!existingCall) {
            const signedPaymentLink = await createInvoicePayUrl(inv.id) || inv.payment_link || '';
            if (signedPaymentLink && signedPaymentLink !== inv.payment_link) {
              await supabase
                .from('invoices')
                .update({ payment_link: signedPaymentLink })
                .eq('id', inv.id);
            }
            const { data: callLog } = await supabase.from('ai_call_logs').insert({
              hostel_id: inv.hostel_id,
              tenant_id: inv.tenant_id,
              invoice_id: inv.id,
              call_status: 'scheduled',
              provider: inv.hostel?.voice_ai_provider || 'vapi',
              tenant_name: inv.tenant.full_name,
              amount_due: amountDue,
              days_overdue: daysOverdue,
              payment_link: signedPaymentLink,
            }).select().single();

            if (callLog) {
              callsToTrigger.push({ tenant: inv.tenant, invoice: inv });
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        overdue_detected: updated,
        calls_scheduled: callsToTrigger.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'trigger_call') {
      const callLogId = body.call_log_id;
      if (!callLogId) {
        return new Response(JSON.stringify({ error: 'Missing call_log_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: callLog, error: logError } = await supabase
        .from('ai_call_logs')
        .select('*, tenant:tenants(*), hostel:hostels(*)')
        .eq('id', callLogId)
        .maybeSingle();

      if (logError || !callLog) {
        return new Response(JSON.stringify({ error: 'Call log not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const provider = callLog.provider || callLog.hostel?.voice_ai_provider || 'vapi';
      const aiConfig = callLog.hostel?.voice_ai_config || {};
      let providerResponse: Record<string, unknown> = {};

      if (provider === 'vapi') {
        const apiKey = Deno.env.get('VAPI_API_KEY');
        if (apiKey) {
          await supabase
            .from('ai_call_logs')
            .update({ call_status: 'in_progress' })
            .eq('id', callLogId);
          const vapiResponse = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              assistantId: aiConfig.vapi_assistant_id,
              customer: {
                number: callLog.tenant?.phone,
              },
              variables: {
                tenant_name: callLog.tenant_name,
                amount_due: String(callLog.amount_due),
                days_overdue: String(callLog.days_overdue),
                payment_link: callLog.payment_link || '',
              },
            }),
          });

          if (vapiResponse.ok) {
            providerResponse = await vapiResponse.json();
            await supabase
              .from('ai_call_logs')
              .update({ provider_call_id: (providerResponse as any).id })
              .eq('id', callLogId);
          }
        }
      } else if (provider === 'bland') {
        const apiKey = Deno.env.get('BLAND_API_KEY');
        if (apiKey) {
          await supabase
            .from('ai_call_logs')
            .update({ call_status: 'in_progress' })
            .eq('id', callLogId);
          const blandResponse = await fetch('https://api.bland.ai/v1/calls', {
            method: 'POST',
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone_number: callLog.tenant?.phone,
              pathway_id: aiConfig.bland_pathway_id,
              variables: {
                tenant_name: callLog.tenant_name,
                amount_due: String(callLog.amount_due),
                days_overdue: String(callLog.days_overdue),
                payment_link: callLog.payment_link || '',
              },
            }),
          });

          if (blandResponse.ok) {
            providerResponse = await blandResponse.json();
            await supabase
              .from('ai_call_logs')
              .update({ provider_call_id: (providerResponse as any).call_id })
              .eq('id', callLogId);
          }
        }
      }

      const hasProviderKey = provider === 'vapi'
        ? Boolean(Deno.env.get('VAPI_API_KEY'))
        : Boolean(Deno.env.get('BLAND_API_KEY'));

      return new Response(JSON.stringify({
        success: true,
        demo_mode: !hasProviderKey,
        message: hasProviderKey ? 'Call submitted to provider' : 'No provider key configured; call kept in scheduled mode',
        call_log_id: callLogId,
        provider,
        provider_response: providerResponse,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
