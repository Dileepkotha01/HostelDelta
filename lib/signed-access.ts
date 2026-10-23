import { createHmac, timingSafeEqual } from 'crypto';

export type SignedAccessType = 'invoice_pay' | 'tenant_view';

type SignedAccessPayload = {
  typ: SignedAccessType;
  id: string;
  iat?: number;
  exp: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACCESS_TOKEN_TTL_SECONDS: Record<SignedAccessType, number> = {
  invoice_pay: 60 * 60 * 24,
  tenant_view: 60 * 60 * 24 * 7,
};

function getSignedLinkSecret(): string {
  const secret = process.env.SIGNED_LINK_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('SIGNED_LINK_SECRET must be configured with at least 32 bytes of random data.');
  }
  return secret;
}

function toBase64Url(value: Buffer | string): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

function signBody(body: string): string {
  return toBase64Url(createHmac('sha256', getSignedLinkSecret()).update(body).digest());
}

export function createSignedAccessToken(
  type: SignedAccessType,
  id: string,
  expiresInSeconds = ACCESS_TOKEN_TTL_SECONDS[type],
): string {
  if (!UUID_RE.test(id)) {
    throw new Error('Signed access id must be a valid UUID.');
  }
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > ACCESS_TOKEN_TTL_SECONDS[type]
  ) {
    throw new Error('Signed access token lifetime is invalid.');
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SignedAccessPayload = {
    typ: type,
    id: id.toLowerCase(),
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${signBody(body)}`;
}

export function verifySignedAccessToken(
  token: string | null | undefined,
  type: SignedAccessType,
  id: string,
): { ok: true } | { ok: false; error: string } {
  if (!token || typeof token !== 'string' || token.length > 2048) {
    return { ok: false, error: 'A valid access token is required.' };
  }
  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'Invalid resource id.' };
  }

  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return { ok: false, error: 'Malformed access token.' };
  }

  let expected: string;
  try {
    expected = signBody(body);
  } catch {
    return { ok: false, error: 'Signed links are not configured.' };
  }

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return { ok: false, error: 'Invalid access token.' };
  }

  try {
    const payload = JSON.parse(fromBase64Url(body).toString('utf8')) as SignedAccessPayload;
    if (
      payload.typ !== type ||
      typeof payload.id !== 'string' ||
      !Number.isSafeInteger(payload.exp) ||
      (payload.iat !== undefined && !Number.isSafeInteger(payload.iat))
    ) {
      return { ok: false, error: 'Invalid access token payload.' };
    }
    if (payload.id.toLowerCase() !== id.toLowerCase()) {
      return { ok: false, error: 'Access token does not match this resource.' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.exp <= now ||
      payload.exp - now > ACCESS_TOKEN_TTL_SECONDS[type] ||
      (payload.iat !== undefined && (
        payload.iat > now + 60 ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > ACCESS_TOKEN_TTL_SECONDS[type]
      ))
    ) {
      return { ok: false, error: 'This access link has expired.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Malformed access token payload.' };
  }
}

export function getAppBaseUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured.');
  }
  return appUrl.replace(/\/$/, '');
}

export function buildInvoicePayUrl(invoiceId: string, expiresInSeconds?: number): string {
  const token = createSignedAccessToken('invoice_pay', invoiceId, expiresInSeconds);
  return `${getAppBaseUrl()}/tenant/pay/${invoiceId}?t=${encodeURIComponent(token)}`;
}

export function buildTenantViewUrl(tenantId: string, expiresInSeconds?: number): string {
  const token = createSignedAccessToken('tenant_view', tenantId, expiresInSeconds);
  return `${getAppBaseUrl()}/tenant/view/${tenantId}?t=${encodeURIComponent(token)}`;
}
