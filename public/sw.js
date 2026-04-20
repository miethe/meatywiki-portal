/**
 * MeatyWiki Portal — Service Worker (skeleton)
 *
 * Version: meatywiki-portal-v1 (bump this string to force cache busting on
 * next deploy, which triggers the install → activate cycle and deletes old
 * caches).
 *
 * Strategy: cache-first for static assets (JS/CSS/images/fonts);
 * network-first for API routes (/api/*).
 *
 * P4-01: skeleton only.
 *   - install / activate / fetch lifecycle wired.
 *   - Offline queue message stub included for P4-02 (IndexedDB queue).
 *   - No queue logic implemented here yet — queue lives in the page context
 *     (OfflineQueueManager) and will communicate with the SW via postMessage
 *     for Background Sync registration.
 *
 * P4-02 TODO: implement 'SYNC_QUEUE' message handler and Background Sync
 *   registration ('intake-queue' tag) when that task lands.
 *
 * Target gzipped size: <10 KB (currently well under; no heavy deps).
 */

"use strict";

const CACHE_NAME = "meatywiki-portal-v1";

/**
 * Static assets to pre-cache on install.
 * Next.js hashes asset filenames; we only pre-cache the shell routes here.
 * Individual JS/CSS chunks are cached on first fetch via the fetch handler.
 */
const PRECACHE_URLS = ["/", "/offline"];

// ---------------------------------------------------------------------------
// Install — open cache and pre-cache shell routes
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate — delete stale caches from previous versions
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch — cache-first for static assets; network-first for /api/*
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests in the cache layer.
  // Non-GET requests (POST intake, etc.) are handled by the page directly;
  // the offline queue (P4-02) intercepts them before they reach the SW.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for API routes — fresh data is always preferred.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for everything else (Next.js static assets, pages).
  event.respondWith(cacheFirst(request));
});

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/**
 * cache-first: serve from cache if available; fall back to network and store.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // If we have no cached version and the network fails, return a minimal
    // offline indicator. The /offline page itself should be pre-cached above.
    const offlineFallback = await caches.match("/offline");
    if (offlineFallback) return offlineFallback;
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

/**
 * network-first: try network; fall back to cache on failure.
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", message: "No network connection" }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Message handler — stub for P4-02 offline queue sync
// ---------------------------------------------------------------------------

/**
 * Message events from the page context are dispatched here.
 *
 * P4-02 will add:
 *   case 'SYNC_QUEUE': register Background Sync tag 'intake-queue'
 *
 * DO NOT implement queue logic in the SW directly; the queue is owned by
 * OfflineQueueManager (IndexedDB, page context). The SW only triggers sync.
 */
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  switch (data.type) {
    case "SKIP_WAITING":
      // Allow the waiting SW to activate immediately when the page requests it
      // (e.g. after a "New version available — refresh" prompt).
      self.skipWaiting();
      break;

    // TODO (P4-02): case 'SYNC_QUEUE': register Background Sync
    //   self.registration.sync.register('intake-queue').catch(() => {});
    //   break;

    default:
      // Unknown message types are silently ignored for forward compatibility.
      break;
  }
});

// ---------------------------------------------------------------------------
// Background Sync — stub for P4-02
// ---------------------------------------------------------------------------

/**
 * P4-02 will implement this handler to dequeue and replay offline intake
 * requests from IndexedDB when connectivity is restored.
 *
 * self.addEventListener('sync', (event) => {
 *   if (event.tag === 'intake-queue') {
 *     event.waitUntil(replayOfflineQueue());
 *   }
 * });
 */
