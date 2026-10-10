// Offline support for the /connect/ QR screen.
// Serves from the cache first (instant, even on bad conference wifi) and refreshes the
// cache in the background. Bump CACHE when the files below change.
const CACHE = 'connect-v1';
const FILES = ['./', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', '/favicon.svg?v=2'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request) || (request.mode === 'navigate' ? await cache.match('./') : undefined);
    const fresh = fetch(request).then(response => {
      if (response.ok) cache.put(request.mode === 'navigate' ? './' : request, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(fresh.catch(() => {}));
      return cached;
    }
    return fresh;
  }));
});
