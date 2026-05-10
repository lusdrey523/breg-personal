/**
 * BREG Personal – Service Worker
 * Estrategia: Cache-First con Network Fallback
 * Version: 1.0.0
 */

const CACHE_NAME = 'breg-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── Install: pre-cache todos los assets estáticos ──────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando BREG v1.0.0');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-cacheando assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches antiguas ─────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando nueva versión');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Eliminando cache obsoleta:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET al mismo origen
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Retornar desde cache inmediatamente
        return cachedResponse;
      }

      // Si no está en cache, intentar red y luego guardar
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback – retornar index.html para navegación
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Mensaje desde la app (ej: forzar actualización) ───────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
