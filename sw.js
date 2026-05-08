const CACHE_NAME = 'fintrack-v2';

// ─── Dynamically build the correct base URL (works on GitHub Pages & localhost) ─
const BASE_URL = self.location.pathname.replace('/sw.js', '');

const ASSETS_TO_CACHE = [
  BASE_URL + '/',
  BASE_URL + '/Personal_finance_tracking.html',
  BASE_URL + '/manifest.json',
  BASE_URL + '/icons/icon-192.png',
  BASE_URL + '/icons/icon-512.png'
];

// ─── INSTALL: cache all core assets one by one (won't fail if one is missing) ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell...');
      // addAll fails entirely if one file 404s — so we cache individually
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: wipe old caches ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH: Cache-First with network fallback ───────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', event.request.url);
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then(networkResponse => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type === 'opaque'
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
            console.log('[SW] Newly cached:', event.request.url);
          });

          return networkResponse;
        })
        .catch(() => {
          console.warn('[SW] Offline & not cached:', event.request.url);
          // Fallback to main HTML for any document request
          if (event.request.destination === 'document') {
            return caches.match(BASE_URL + '/Personal_finance_tracking.html');
          }
        });
    })
  );
});