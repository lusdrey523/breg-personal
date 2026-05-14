/**
 * BREG Personal — sw.js
 * Service Worker con estrategia cache-first para offline real.
 * Versionado para invalidar cache en updates.
 */

const CACHE_NAME = 'breg-personal-v2';

const ASSETS_CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './finance.js',
  './ui.js',
  './charts.js',
  './theme.js',
  './manifest.json',
];

const ASSETS_FONTS = [
  'https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Exo+2:wght@300;400;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap',
];

/* ── INSTALL: pre-cachear assets core ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_CORE))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpiar caches viejos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: cache-first para assets, network-first para datos ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET
  if (request.method !== 'GET') return;

  // No interceptar chrome-extension u otros esquemas
  if (!url.protocol.startsWith('http')) return;

  // Fuentes de Google: stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Assets propios: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

/* ── Estrategias ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    return caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache    = await caches.open(CACHE_NAME);
  const cached   = await cache.match(request);
  const fetchProm = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || fetchProm;
}
