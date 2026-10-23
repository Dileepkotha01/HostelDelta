export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function requireEdgeBearer(
  req: Request,
  envNames = ['CRON_SECRET', 'EDGE_FUNCTION_SECRET'],
): Response | null {
  const authorization = req.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const expected =
    envNames.map((name) => Deno.env.get(name) || '').find((value) => value.length > 0) || '';

  if (!expected) {
    return new Response(JSON.stringify({ error: 'Function authentication is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!supplied || !timingSafeEqualString(supplied, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

export function timingSafeHexEqual(supplied: string, expectedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(supplied) || supplied.length !== expectedHex.length) {
    return false;
  }
  return timingSafeEqualString(supplied.toLowerCase(), expectedHex.toLowerCase());
}
