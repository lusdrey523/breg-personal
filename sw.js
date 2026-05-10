const CACHE_NAME = 'breg-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

/* INSTALL */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

/* ACTIVATE */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(n => n !== CACHE_NAME)
          .map(n => caches.delete(n))
      )
    )
  );
});

/* FETCH */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request).then(net => {
        const clone = net.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return net;
      });
    })
  );
});
