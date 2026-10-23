/**
 * Deprecated: Razorpay webhooks must point at the Next.js route
 * `/api/webhooks/razorpay`, which verifies HMAC with timing-safe compares
 * and finalizes rent via `process_rent_payment`.
 *
 * Keeping this Edge Function live with a divergent ledger path caused
 * double-processing and weaker verification. It now refuses traffic.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-razorpay-signature',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'This Edge Function webhook is retired. Configure Razorpay to POST to /api/webhooks/razorpay on the app origin.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
