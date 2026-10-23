function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256Base64Url(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return toBase64Url(new Uint8Array(digest));
}

export async function createInvoicePayUrl(invoiceId: string, expiresInSeconds = 60 * 60 * 24 * 30): Promise<string | null> {
  const secret =
    Deno.env.get('SIGNED_LINK_SECRET') ||
    Deno.env.get('CRON_SECRET') ||
    Deno.env.get('EDGE_FUNCTION_SECRET') ||
    '';
  const appUrl = (Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || '').replace(/\/$/, '');
  if (!secret || !appUrl) return null;

  const payload = {
    typ: 'invoice_pay',
    id: invoiceId.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256Base64Url(secret, body);
  return `${appUrl}/tenant/pay/${invoiceId}?t=${encodeURIComponent(`${body}.${signature}`)}`;
}
