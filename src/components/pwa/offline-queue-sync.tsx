"use client";

/**
 * OfflineQueueSync — handles sync-on-reconnect for the offline intake queue.
 *
 * Design decision: CLIENT-SIDE DRAIN (not SW-side drain).
 *
 * Approach chosen: The client registers a Background Sync tag with the Service
 * Worker when reconnecting, but the actual drain logic runs in the page context
 * (OfflineQueueManager.drain()), not inside the SW. The SW acts as a wakeup
 * mechanism only — it posts a 'DRAIN_QUEUE' message back to the page, which
 * the page handles by calling drain().
 *
 * Rationale:
 *   1. IndexedDB access from SW context requires careful versioning — keeping
 *      the drain logic in the page context avoids duplicating the schema.
 *   2. Background Sync fires even when the tab is closed (on supported browsers),
 *      but in that case there's no active page to receive the message. The SW
 *      falls back to a no-op (no page client). On the next open, reconnect
 *      triggers the window.online handler below, which drains directly.
 *   3. This architecture minimises SW code size (target <10 KB gzipped).
 *
 * Flow:
 *   a. window 'online' fires.
 *   b. If Background Sync API available: register 'sync-intake-queue' tag
 *      via SW registration.sync. The SW receives the 'sync' event and posts
 *      'DRAIN_QUEUE' to all active clients. This component listens and drains.
 *   c. Fallback (Background Sync not available or SW not ready):
 *      call OfflineQueueManager.drain() directly.
 *
 * Renders nothing — side-effect only.
 *
 * Feature flag: only active when NEXT_PUBLIC_PORTAL_ENABLE_PWA=1.
 *
 * Traces FR-1.5-17, FR-1.5-18.
 */

import { useEffect } from "react";
import { OfflineQueueManager } from "@/lib/pwa/offline-queue";

const PWA_ENABLED = process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA === "1";

/** Attempt Background Sync registration. Returns true if registered. */
async function tryBackgroundSync(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const reg = await navigator.serviceWorker?.ready.catch(() => null);
  if (!reg) return false;

  // Background Sync API — not universally supported (e.g. Firefox, iOS Safari).
  // We use a type assertion because lib.dom.d.ts may not include SyncManager.
  const syncManager = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
  if (!syncManager?.register) return false;

  try {
    await syncManager.register("sync-intake-queue");
    console.info("[OfflineQueueSync] Background Sync registered: sync-intake-queue");
    return true;
  } catch (err) {
    console.warn("[OfflineQueueSync] Background Sync registration failed:", err);
    return false;
  }
}

/** Drain the queue directly from the page context. */
async function drainDirect(): Promise<void> {
  try {
    const result = await OfflineQueueManager.drain();
    if (result.replayed > 0 || result.failed > 0) {
      console.info("[OfflineQueueSync] Direct drain complete:", result);
    }
  } catch (err) {
    console.error("[OfflineQueueSync] Drain failed:", err);
  }
}

export function OfflineQueueSync(): null {
  useEffect(() => {
    if (!PWA_ENABLED) return;

    /**
     * Handler for window 'online' event.
     * Tries Background Sync first; falls back to direct drain.
     */
    const handleOnline = async (): Promise<void> => {
      console.info("[OfflineQueueSync] Network reconnected — syncing queue.");

      const { queued } = await OfflineQueueManager.count();
      if (queued === 0) return; // Nothing to sync.

      const usedBackgroundSync = await tryBackgroundSync();
      if (!usedBackgroundSync) {
        // Background Sync unavailable or SW not ready — drain directly.
        await drainDirect();
      }
      // If Background Sync was registered, the SW 'sync' event fires and posts
      // 'DRAIN_QUEUE' to this page. We listen for that message below.
    };

    /**
     * Handler for SW → page 'DRAIN_QUEUE' postMessage.
     * Fires when the SW's 'sync' event triggers and notifies us to drain.
     */
    const handleSwMessage = (event: MessageEvent): void => {
      if (!event.data || typeof event.data !== "object") return;
      if ((event.data as { type?: string }).type === "DRAIN_QUEUE") {
        console.info("[OfflineQueueSync] SW requested drain via postMessage.");
        void drainDirect();
      }
    };

    // Also drain on mount if we're online and queue has items (handles the
    // "opened tab while offline, then came online" case).
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void OfflineQueueManager.count().then(({ queued }) => {
        if (queued > 0) void drainDirect();
      });
    }

    const onlineHandler = () => void handleOnline();

    window.addEventListener("online", onlineHandler);
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("online", onlineHandler);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, []);

  return null;
}
