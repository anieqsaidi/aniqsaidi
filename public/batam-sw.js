const SHELL = 'batam-shell-v2';
const HOME = '/batam/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      const response = await fetch(HOME, { cache: 'reload' });
      if (!response.ok) {
        throw new Error('Unable to cache Batam portal');
      }
      await cache.put(HOME, response.clone());
      const html = await response.text();
      const matches = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);
      const assets = [...matches]
        .map((match) => new URL(match[1], self.location.origin))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
      await Promise.all(
        [...new Set(assets)].map(async (asset) => {
          try {
            await cache.add(asset);
          } catch {
            // One optional asset must not break offline installation.
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('batam-shell-') && key !== SHELL).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/batam')) {
    event.respondWith(fetch(event.request).then((response) => {
      caches.open(SHELL).then((cache) => cache.put(HOME, response.clone()));
      return response;
    }).catch(() => caches.match(HOME)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(SHELL).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
