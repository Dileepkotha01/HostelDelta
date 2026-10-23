import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  const nextResponse = () => addSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
  const rewriteResponse = (destination: URL) => addSecurityHeaders(
    NextResponse.rewrite(destination, { request: { headers: requestHeaders } }),
    nonce,
  );
  // Never derive production redirect destinations from request host headers.
  // Only accept the configured root domain and its known portal subdomains.
  const hostname = url.hostname.toLowerCase();
  const isLocalhost =
    process.env.NODE_ENV !== 'production' &&
    (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.localhost'));
  const rootDomain = isLocalhost
    ? hostname.replace(/^(?:app|admin|www)\./, '')
    : getConfiguredRootDomain();
  const trustedHostnames = new Set([
    rootDomain,
    `www.${rootDomain}`,
    `app.${rootDomain}`,
    `admin.${rootDomain}`,
  ]);
  if (!isLocalhost && (!rootDomain || !trustedHostnames.has(hostname))) {
    return addSecurityHeaders(
      NextResponse.json({ error: 'Unrecognized host.' }, { status: 421 }),
      nonce,
    );
  }
  const redirectProtocol = isLocalhost ? url.protocol : 'https:';
  const localPort = isLocalhost && url.port ? `:${url.port}` : '';
  const appOrigin = `${redirectProtocol}//app.${rootDomain}${localPort}`;
  const adminOrigin = `${redirectProtocol}//admin.${rootDomain}${localPort}`;

  // ── Subdomain Detection ──────────────────────────────────────────────────
  // Works for: kupera.in, app.kupera.in, admin.kupera.in,
  //            localhost:3000, app.localhost:3000, admin.localhost:3000
  const isAdminSubdomain = hostname.startsWith('admin.');
  const isAppSubdomain = hostname.startsWith('app.');
  const isRootDomain = !isAdminSubdomain && !isAppSubdomain;

  // ── Skip internal Next.js paths & static assets ───────────────────────────
  const isInternal =
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.');

  if (url.pathname.startsWith('/api/')) {
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
        return addPrivateResponseHeaders(
          addSecurityHeaders(NextResponse.json({ error: 'Invalid request size.' }, { status: 400 }), nonce),
        );
      }
      if (contentLength > 2 * 1024 * 1024) {
        return addPrivateResponseHeaders(
          addSecurityHeaders(NextResponse.json({ error: 'Request body is too large.' }, { status: 413 }), nonce),
        );
      }
    }
  }

  if (isInternal) {
    const response = nextResponse();
    return url.pathname.startsWith('/api/') ? addPrivateResponseHeaders(response) : response;
  }

  // ── ADMIN SUBDOMAIN (admin.kupera.in) ─────────────────────────────────────
  if (isAdminSubdomain) {
    if (url.pathname.startsWith('/auth/callback')) {
      return addPrivateResponseHeaders(nextResponse());
    }
    // Root → Super Admin Login
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/admin/login';
      return addPrivateResponseHeaders(rewriteResponse(url));
    }
    // Shared or public tenant view routes shouldn't be blocked if accessed
    if (url.pathname.startsWith('/tenant/')) {
      return addTenantPrivacyHeaders(nextResponse());
    }
    // Ensure admin pages map cleanly
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return addPrivateResponseHeaders(rewriteResponse(url));
    }
    return addPrivateResponseHeaders(nextResponse());
  }

  // ── APP SUBDOMAIN (app.kupera.in) — Hostel Manager Portal ────────────────
  if (isAppSubdomain) {
    // Root → Hostel Manager Dashboard
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/app/dashboard';
      return addPrivateResponseHeaders(rewriteResponse(url));
    }
    // Allow login and signup on app subdomain
    if (url.pathname.startsWith('/tenant/')) {
      return addTenantPrivacyHeaders(nextResponse());
    }
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/signup') || url.pathname.startsWith('/auth/callback')) {
      return addPrivateResponseHeaders(nextResponse());
    }
    // Block admin routes on app subdomain
    if (url.pathname.startsWith('/admin')) {
      url.pathname = '/app/dashboard';
      return addPrivateResponseHeaders(rewriteResponse(url));
    }
    // Prefix routes without /app to /app/* (e.g. /dashboard -> /app/dashboard)
    if (!url.pathname.startsWith('/app')) {
      url.pathname = `/app${url.pathname}`;
      return addPrivateResponseHeaders(rewriteResponse(url));
    }
    return addPrivateResponseHeaders(nextResponse());
  }

  // ── ROOT DOMAIN (kupera.in or localhost:3000) ─────────────────────────────
  if (isRootDomain) {
    // On localhost, allow direct testing of all portals
    if (isLocalhost) {
      if (url.pathname === '/' || url.pathname === '') {
        url.pathname = '/marketing';
        return rewriteResponse(url);
      }
      if (url.pathname.startsWith('/tenant/')) {
        return addTenantPrivacyHeaders(nextResponse());
      }
      if (
        url.pathname.startsWith('/app') ||
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/auth/callback') ||
        url.pathname === '/login' ||
        url.pathname === '/signup'
      ) {
        return addPrivateResponseHeaders(nextResponse());
      }
      return nextResponse();
    }

    // In production root domain (kupera.in):
    // Public tenant read-only view and pay links must work smoothly
    if (url.pathname.startsWith('/tenant/')) {
      return addTenantPrivacyHeaders(nextResponse());
    }

    if (url.pathname === '/login' || url.pathname === '/signup') {
      return addSecurityHeaders(NextResponse.redirect(new URL(url.pathname, appOrigin)), nonce);
    }
    if (url.pathname === '/admin/login') {
      return addSecurityHeaders(NextResponse.redirect(new URL('/', adminOrigin)), nonce);
    }

    // Allow shared auth routes if visited directly
    if (
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/signup') ||
      url.pathname.startsWith('/auth/callback') ||
      url.pathname.startsWith('/marketing')
    ) {
      return url.pathname.startsWith('/auth/callback')
        ? addPrivateResponseHeaders(nextResponse())
        : nextResponse();
    }

    // Redirect or rewrite internal /admin or /app paths on root domain to their dedicated subdomains
    if (url.pathname.startsWith('/admin')) {
      const adminPath = url.pathname === '/admin' ? '/' : url.pathname.slice('/admin'.length);
      return addSecurityHeaders(NextResponse.redirect(new URL(adminPath, adminOrigin)), nonce);
    }
    if (url.pathname.startsWith('/app')) {
      const appPath = url.pathname === '/app' ? '/' : url.pathname.slice('/app'.length);
      return addSecurityHeaders(NextResponse.redirect(new URL(appPath, appOrigin)), nonce);
    }

    // Root domain homepage / → Kupera Marketing Landing Page
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/marketing';
      return rewriteResponse(url);
    }

    return nextResponse();
  }

  return nextResponse();
}

/** Attach strict enterprise security headers */
function addSecurityHeaders(response: NextResponse, nonce: string) {
  // Prevent clickjacking (aligned with next.config.js)
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Enforce HTTPS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  // Restrict browser features and sensors
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  return response;
}

function buildContentSecurityPolicy(nonce: string): string {
  const supabaseOrigin = getSupabaseOrigin();
  const supabaseWebSocketOrigin = supabaseOrigin
    ? supabaseOrigin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
    : '';
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    'https://checkout.razorpay.com',
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${[supabaseOrigin, supabaseWebSocketOrigin].filter(Boolean).join(' ')} https://api.razorpay.com https://lumberjack.razorpay.com`,
    "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function getSupabaseOrigin(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return '';
  try {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') return '';
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function getConfiguredRootDomain(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_MARKETING_URL;
  if (!configuredUrl) return '';
  try {
    const parsed = new URL(configuredUrl);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') return '';
    return parsed.hostname.toLowerCase().replace(/^(?:app|admin|www)\./, '');
  } catch {
    return '';
  }
}

function addTenantPrivacyHeaders(response: NextResponse) {
  addPrivateResponseHeaders(response);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

function addPrivateResponseHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
};
