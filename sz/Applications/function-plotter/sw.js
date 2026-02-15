const CACHE = 'function-plotter-v1';
const ASSETS = [
  './index.html',
  './styles.css',
  './controller.js',
  './icon.svg',
  './manifest.webmanifest',
  '../sz-app-bootstrap.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, cloned));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
