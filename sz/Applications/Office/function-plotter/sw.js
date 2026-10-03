// Network first: online users always get the current version, the cache
// only answers when the network does not. The new cache name retires the
// old cache-first copy that kept serving outdated files.
const CACHE = 'function-plotter-v2';
const ASSETS = [
  './index.html',
  './styles.css',
  './controller.js',
  './icon.svg',
  './manifest.webmanifest',
  '../../sz-app-bootstrap.js'
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
    fetch(request).then((response) => {
      if (response.ok) {
        const cloned = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, cloned));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
