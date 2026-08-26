const SHELL = 'batam-shell-v1';
const HOME = '/batam/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add(HOME)));
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
