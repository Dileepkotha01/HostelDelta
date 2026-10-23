import { createClient, type User } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export type CallerProfile = {
  id: string;
  role: string;
  active: boolean;
  hostel_id: string | null;
};

export function extractBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export function timingSafeSecretEqual(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function requireCronSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected || Buffer.byteLength(expected, 'utf8') < 32) {
    return NextResponse.json({ error: 'CRON_SECRET must contain at least 32 bytes of random data.' }, { status: 503 });
  }
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!supplied || !timingSafeSecretEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<
  | { ok: true; user: User; accessToken: string; profile: CallerProfile }
  | { ok: false; response: NextResponse }
> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 }),
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

  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('id, role, active, hostel_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to verify this account.' }, { status: 500 }),
    };
  }

  if (!profile.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'This account is inactive.' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user,
    accessToken,
    profile: profile as CallerProfile,
  };
}

export function isBillingStatusActive(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  periodEndsAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!status) return false;
  const trialEnded = !!trialEndsAt && new Date(trialEndsAt).getTime() <= nowMs;
  const periodEnded = !!periodEndsAt && new Date(periodEndsAt).getTime() <= nowMs;

  if (status === 'ACTIVE') return !!periodEndsAt && !periodEnded;
  if (status === 'TRIALING') return !!trialEndsAt && !trialEnded;
  if (status === 'CANCELLED') return !!periodEndsAt && !periodEnded;
  return false;
}
