"use client";

/**
 * PwaProviders — client-side host for lazy-loaded PWA side-effect shells.
 *
 * Why this wrapper exists (P4-04 perf tuning):
 *   `next/dynamic` with `ssr: false` is only permitted inside Client Components.
 *   The root `layout.tsx` is a Server Component, so we move the dynamic()
 *   calls here instead.
 *
 * Both inner components render null — they are pure side-effect shells:
 *   - ServiceWorkerRegister: registers /sw.js (when NEXT_PUBLIC_PORTAL_ENABLE_PWA=1)
 *   - OfflineQueueSync: listens for window.online, drains the IndexedDB queue
 *
 * Loading them via dynamic() + ssr:false:
 *   1. Prevents SSR: the server HTML stays clean, no server-side execution of
 *      browser-only APIs (navigator.serviceWorker, window.addEventListener).
 *   2. Defers to a separate lazy chunk: these ~2 KB modules do not block the
 *      critical rendering path on first load.
 *   3. No visible impact: both render null, so no layout shift or flash.
 *
 * Traces FR-1.5-15 (P4-01 SW registration), FR-1.5-17, FR-1.5-18 (P4-02 queue sync).
 * Performance: P4-04 (defer non-critical JS).
 */

import dynamic from "next/dynamic";

const ServiceWorkerRegister = dynamic(
  () =>
    import("@/components/pwa/service-worker-register").then(
      (m) => m.ServiceWorkerRegister,
    ),
  { ssr: false },
);

const OfflineQueueSync = dynamic(
  () =>
    import("@/components/pwa/offline-queue-sync").then(
      (m) => m.OfflineQueueSync,
    ),
  { ssr: false },
);

export function PwaProviders(): React.ReactElement | null {
  return (
    <>
      <ServiceWorkerRegister />
      <OfflineQueueSync />
    </>
  );
}
