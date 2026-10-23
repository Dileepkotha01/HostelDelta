type Portal = 'app' | 'admin';

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

export function getMarketingUrl(path = '/') {
  const { hostname, origin, protocol } = window.location;
  if (isLocalHostname(hostname)) return `${origin}${path}`;

  const configuredOrigin = process.env.NEXT_PUBLIC_MARKETING_URL;
  if (configuredOrigin) return `${configuredOrigin.replace(/\/$/, '')}${path}`;

  const rootDomain = hostname.replace(/^(?:app|admin|www)\./, '');
  return `${protocol}//${rootDomain}${path}`;
}

export function getPortalUrl(portal: Portal, path = '/') {
  const { hostname, origin, protocol } = window.location;
  if (isLocalHostname(hostname)) {
    const localPath = portal === 'admin' && path === '/' ? '/admin/login' : path;
    return `${origin}${localPath}`;
  }

  const configuredOrigin = portal === 'app'
    ? process.env.NEXT_PUBLIC_APP_SUBDOMAIN
    : process.env.NEXT_PUBLIC_ADMIN_SUBDOMAIN;
  if (configuredOrigin) return `${configuredOrigin.replace(/\/$/, '')}${path}`;

  const rootDomain = hostname.replace(/^(?:app|admin|www)\./, '');
  return `${protocol}//${portal}.${rootDomain}${path}`;
}
