const CACHE_NAME = 'hostelhub-v2';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never persist authenticated, API, auth, or bearer-link responses in the
  // Cache API. HTTP Cache-Control headers alone do not make a custom service
  // worker's cache policy safe.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/tenant/') ||
    url.pathname.startsWith('/app/') ||
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login' ||
    url.pathname === '/signup'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Middleware can rewrite a public-looking URL such as "/" to a private
  // dashboard on app/admin subdomains. Do not cache generic page responses.
  event.respondWith(fetch(request));
});
