import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.hostname;
  const hostname = hostHeader.split(',')[0].trim().replace(/:\d+$/, '').toLowerCase();
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');
  const rootDomain = hostname.replace(/^(?:app|admin|www)\./, '');
  const appOrigin = `${url.protocol}//app.${rootDomain}`;
  const adminOrigin = `${url.protocol}//admin.${rootDomain}`;

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

  if (isInternal) return addSecurityHeaders(NextResponse.next());

  // ── ADMIN SUBDOMAIN (admin.kupera.in) ─────────────────────────────────────
  if (isAdminSubdomain) {
    if (url.pathname.startsWith('/auth/callback')) {
      return addSecurityHeaders(NextResponse.next());
    }
    // Root → Super Admin Login
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/admin/login';
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
    // Shared or public tenant view routes shouldn't be blocked if accessed
    if (url.pathname.startsWith('/tenant/')) {
      return addSecurityHeaders(NextResponse.next());
    }
    // Ensure admin pages map cleanly
    if (!url.pathname.startsWith('/admin')) {
      url.pathname = `/admin${url.pathname}`;
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ── APP SUBDOMAIN (app.kupera.in) — Hostel Manager Portal ────────────────
  if (isAppSubdomain) {
    // Root → Hostel Manager Dashboard
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/app/dashboard';
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
    // Allow login and signup on app subdomain
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/signup') || url.pathname.startsWith('/auth/callback') || url.pathname.startsWith('/tenant/')) {
      return addSecurityHeaders(NextResponse.next());
    }
    // Block admin routes on app subdomain
    if (url.pathname.startsWith('/admin')) {
      url.pathname = '/app/dashboard';
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
    // Prefix routes without /app to /app/* (e.g. /dashboard -> /app/dashboard)
    if (!url.pathname.startsWith('/app')) {
      url.pathname = `/app${url.pathname}`;
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // ── ROOT DOMAIN (kupera.in or localhost:3000) ─────────────────────────────
  if (isRootDomain) {
    // On localhost, allow direct testing of all portals
    if (isLocalhost) {
      if (url.pathname === '/' || url.pathname === '') {
        url.pathname = '/marketing';
        return addSecurityHeaders(NextResponse.rewrite(url));
      }
      return addSecurityHeaders(NextResponse.next());
    }

    // In production root domain (kupera.in):
    // Public tenant read-only view and pay links must work smoothly
    if (url.pathname.startsWith('/tenant/')) {
      return addSecurityHeaders(NextResponse.next());
    }

    if (url.pathname === '/login' || url.pathname === '/signup') {
      return addSecurityHeaders(NextResponse.redirect(new URL(url.pathname, appOrigin)));
    }
    if (url.pathname === '/admin/login') {
      return addSecurityHeaders(NextResponse.redirect(new URL('/', adminOrigin)));
    }

    // Allow shared auth routes if visited directly
    if (
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/signup') ||
      url.pathname.startsWith('/auth/callback') ||
      url.pathname.startsWith('/marketing')
    ) {
      return addSecurityHeaders(NextResponse.next());
    }

    // Redirect or rewrite internal /admin or /app paths on root domain to their dedicated subdomains
    if (url.pathname.startsWith('/admin')) {
      const adminPath = url.pathname === '/admin' ? '/' : url.pathname.slice('/admin'.length);
      return addSecurityHeaders(NextResponse.redirect(new URL(adminPath, adminOrigin)));
    }
    if (url.pathname.startsWith('/app')) {
      const appPath = url.pathname === '/app' ? '/' : url.pathname.slice('/app'.length);
      return addSecurityHeaders(NextResponse.redirect(new URL(appPath, appOrigin)));
    }

    // Root domain homepage / → Kupera Marketing Landing Page
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/marketing';
      return addSecurityHeaders(NextResponse.rewrite(url));
    }

    return addSecurityHeaders(NextResponse.next());
  }

  return addSecurityHeaders(NextResponse.next());
}

/** Attach strict enterprise security headers */
function addSecurityHeaders(response: NextResponse) {
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
  // Basic XSS / data exfiltration guardrails for HTML responses
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://checkout.razorpay.com/v1/checkout.js",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
};
