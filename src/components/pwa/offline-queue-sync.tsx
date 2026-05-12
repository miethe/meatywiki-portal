"use client";

/**
 * OfflineQueueSync — handles sync-on-reconnect for the offline intake queue,
 * and surfaces eviction warnings when the queue reaches its 100-item cap.
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
 * Eviction toast:
 *   When OfflineQueueManager.enqueue() evicts the oldest item (FIFO cap of 100),
 *   it dispatches a 'offline-queue-eviction' CustomEvent on window. This
 *   component subscribes, renders a fixed-position warning banner, and
 *   auto-dismisses it after 5 seconds.
 *
 * Flow:
 *   a. window 'online' fires.
 *   b. If Background Sync API available: register 'sync-intake-queue' tag
 *      via SW registration.sync. The SW receives the 'sync' event and posts
 *      'DRAIN_QUEUE' to all active clients. This component listens and drains.
 *   c. Fallback (Background Sync not available or SW not ready):
 *      call OfflineQueueManager.drain() directly.
 *
 * Feature flag: only active when NEXT_PUBLIC_PORTAL_ENABLE_PWA=1.
 *
 * Traces FR-1.5-17, FR-1.5-18. M-05: eviction toast (P2-03).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
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

// ---------------------------------------------------------------------------
// Eviction toast state
// ---------------------------------------------------------------------------

let evictionToastSeq = 0;

/** Visible warning banner shown when the offline queue evicts an item. */
function EvictionToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        maxWidth: "22rem",
        padding: "0.875rem 1rem",
        borderRadius: "0.5rem",
        background: "#78350f",
        color: "#fef3c7",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        fontSize: "0.875rem",
        lineHeight: "1.4",
      }}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="currentColor"
        style={{ flexShrink: 0, marginTop: "0.1rem" }}
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <div style={{ flex: 1 }}>
        <strong style={{ display: "block", marginBottom: "0.2rem" }}>
          Offline queue full
        </strong>
        Oldest queued item discarded to make room. Reconnect to sync the rest.
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
          opacity: 0.75,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OfflineQueueSync
// ---------------------------------------------------------------------------

export function OfflineQueueSync(): React.ReactElement | null {
  const [showEvictionToast, setShowEvictionToast] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(() => {
    // Bump seq to reset the auto-dismiss timer if eviction fires again quickly.
    evictionToastSeq++;
    setShowEvictionToast(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setShowEvictionToast(false), 5000);
  }, []);

  const dismissToast = useCallback(() => {
    setShowEvictionToast(false);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

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

    /**
     * Handler for 'offline-queue-eviction' CustomEvent dispatched by
     * OfflineQueueManager.enqueue() when the 100-item FIFO cap is hit.
     */
    const handleEviction = (): void => {
      showToast();
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
    window.addEventListener("offline-queue-eviction", handleEviction);
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline-queue-eviction", handleEviction);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [showToast]);

  if (!showEvictionToast) return null;

  return <EvictionToast key={evictionToastSeq} onDismiss={dismissToast} />;
}
