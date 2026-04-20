"use client";

/**
 * useOfflineQueue — React hook for offline intake queue state.
 *
 * Returns:
 *   queuedCount   — number of pending records in offline_queue
 *   failedCount   — number of exhausted records in failed_queue
 *   isOnline      — current network connectivity state
 *   retryFailed() — drain the failed_queue back into offline_queue for a
 *                   second-chance replay (clears failed store, re-enqueues)
 *
 * Subscribes to:
 *   - window 'online' / 'offline' events → updates isOnline
 *   - window 'offline-queue-change' custom event → re-fetches counts
 *     (dispatched by OfflineQueueManager after every mutation)
 *
 * Feature flag: when NEXT_PUBLIC_PORTAL_ENABLE_PWA !== "1" the hook
 * returns zero counts and a no-op retryFailed so callers need no guards.
 *
 * Traces FR-1.5-17.
 */

import { useState, useEffect, useCallback } from "react";
import { OfflineQueueManager } from "@/lib/pwa/offline-queue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineQueueState {
  queuedCount: number;
  failedCount: number;
  isOnline: boolean;
  retryFailed: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Feature flag — evaluated at call time (not module load) so tests can
// mutate process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA between test cases.
// ---------------------------------------------------------------------------

function isPwaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA === "1";
}

// ---------------------------------------------------------------------------
// useOfflineQueue
// ---------------------------------------------------------------------------

export function useOfflineQueue(): OfflineQueueState {
  const pwaEnabled = isPwaEnabled();

  const [queuedCount, setQueuedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(
    // Safe default for SSR: assume online.
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  // Re-fetch counts from IndexedDB.
  const refreshCounts = useCallback(async () => {
    if (!pwaEnabled) return;
    try {
      const { queued, failed } = await OfflineQueueManager.count();
      setQueuedCount(queued);
      setFailedCount(failed);
    } catch (err) {
      console.warn("[useOfflineQueue] Failed to read queue counts:", err);
    }
  }, [pwaEnabled]);

  useEffect(() => {
    if (!pwaEnabled) return;

    // Initial load.
    void refreshCounts();

    // Network state handlers.
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Queue mutation handler.
    const handleQueueChange = () => void refreshCounts();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-change", handleQueueChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-change", handleQueueChange);
    };
  }, [refreshCounts, pwaEnabled]);

  /**
   * retryFailed — move all records from failed_queue back to offline_queue
   * and trigger a drain.
   *
   * Implementation: reads failed records, re-enqueues each one with retries
   * reset to 0, clears failed_queue, then drains.
   */
  const retryFailed = useCallback(async () => {
    if (!pwaEnabled) return;
    try {
      const failedItems = await OfflineQueueManager.listFailed();
      if (failedItems.length === 0) return;

      // Re-enqueue each failed item with reset retry counter.
      for (const item of failedItems) {
        await OfflineQueueManager.enqueue({
          endpoint: item.endpoint,
          method: item.method,
          headers: item.headers,
          bodyJson: item.bodyJson,
          bodyBlob: item.bodyBlob,
          contentType: item.contentType,
        });
      }

      // Clear failed_queue.
      await _clearFailedQueue();

      // Now drain the re-enqueued items.
      await OfflineQueueManager.drain();

      await refreshCounts();
    } catch (err) {
      console.error("[useOfflineQueue] retryFailed error:", err);
    }
  }, [pwaEnabled, refreshCounts]);

  return { queuedCount, failedCount, isOnline, retryFailed };
}

// ---------------------------------------------------------------------------
// _clearFailedQueue — internal helper (not exported)
// ---------------------------------------------------------------------------

/**
 * Clear all records from failed_queue.
 * Used by retryFailed after re-enqueuing items.
 */
async function _clearFailedQueue(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("meatywiki-portal-offline", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("failed_queue", "readwrite");
      const clearReq = tx.objectStore("failed_queue").clear();
      clearReq.onsuccess = () => {
        db.close();
        resolve();
      };
      clearReq.onerror = () => {
        db.close();
        reject(clearReq.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}
