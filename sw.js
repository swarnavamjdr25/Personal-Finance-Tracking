const CACHE_NAME = "finance-pwa-v5";

const CORE_FILES = [
  "/",
  "/manifest.json"
];

const ICON_FILES = [
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_FILES);
      await Promise.allSettled(
        ICON_FILES.map(url =>
          cache.add(url).catch(err => console.warn("[SW] Icon cache failed:", url, err))
        )
      );
      console.log("[SW] All files cached successfully");
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: clear old caches ───────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log("[SW] Removing old cache:", k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH: Cache-first with offline fallback ──────────────────────────────────
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  // Safari PWA fix: let navigation to root pass through directly
  if (event.request.mode === "navigate" && new URL(event.request.url).pathname === "/") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type === "opaque" ||
          networkResponse.redirected
        ) {
          return networkResponse;
        }

        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return networkResponse;

      }).catch(() => {
        if (event.request.destination === "document") {
          return caches.match("/");
        }
      });
    })
  );
});