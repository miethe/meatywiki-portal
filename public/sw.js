/**
 * MeatyWiki Portal — Service Worker
 *
 * Version: meatywiki-portal-v1 (bump this string to force cache busting on
 * next deploy, which triggers the install → activate cycle and deletes old
 * caches).
 *
 * Strategy: cache-first for static assets (JS/CSS/images/fonts);
 * network-first for API routes (/api/*).
 *
 * P4-01: skeleton wired (install / activate / fetch / message stubs).
 * P4-02: Background Sync handler added.
 *   Architecture decision: SW does NOT implement the drain loop itself.
 *   The offline queue lives entirely in the page context (OfflineQueueManager,
 *   IndexedDB). The SW's role on a 'sync' event is to wake active page clients
 *   and ask them to drain via postMessage('DRAIN_QUEUE'). This avoids
 *   duplicating IndexedDB schema/logic in SW scope and keeps the SW small
 *   (<10 KB gzipped target). If no clients are open, the SW no-ops; the next
 *   page open will drain on mount via the window.online check in
 *   OfflineQueueSync.
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
// Message handler — P4-02
// ---------------------------------------------------------------------------

/**
 * Message events from the page context.
 *
 * SKIP_WAITING: allow a waiting SW to activate immediately (version update).
 *
 * Note: SYNC_QUEUE registration is now handled automatically by the page
 * (OfflineQueueSync component) on the window 'online' event, so no explicit
 * message from the page is required for Background Sync registration.
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

    default:
      // Unknown message types are silently ignored for forward compatibility.
      break;
  }
});

// ---------------------------------------------------------------------------
// Background Sync — P4-02
// ---------------------------------------------------------------------------

/**
 * Background Sync handler for tag 'sync-intake-queue'.
 *
 * Design: drain logic lives in the page (OfflineQueueManager). The SW wakes
 * active clients and asks them to drain via postMessage. If no clients are
 * open, the sync is a no-op — the queue will drain when the tab reopens.
 *
 * Why client-side drain (not SW-side):
 *   - OfflineQueueManager schema is defined once in the page bundle.
 *   - Avoids duplicating IndexedDB access logic in SW scope.
 *   - Keeps SW size under the 10 KB gzip budget.
 *   - SW lacks direct access to the bearer token; the page handles auth via
 *     HttpOnly cookies automatically on each fetch.
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-intake-queue") {
    event.waitUntil(notifyClientsTodrain());
  }
});

/**
 * Post DRAIN_QUEUE to all active window clients so they run
 * OfflineQueueManager.drain() in their page context.
 */
async function notifyClientsTodrain() {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  if (clientList.length === 0) {
    // No active clients — queue will drain on next page open.
    console.info("[SW] sync-intake-queue: no active clients; skipping drain signal.");
    return;
  }

  for (const client of clientList) {
    client.postMessage({ type: "DRAIN_QUEUE" });
  }
  console.info("[SW] sync-intake-queue: DRAIN_QUEUE sent to", clientList.length, "client(s).");
}
