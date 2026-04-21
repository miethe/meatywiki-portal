/**
 * SSEConnectionPool — shell-level singleton for multiplexed SSE connections.
 *
 * Enforces the Stage Tracker manifest §3.3 multiplexing rule:
 *   - One SSE connection per visible run_id across the entire app.
 *   - Debounce mount/unmount by 100 ms (covers virtualized scroll churn).
 *   - Refcount subscribers; close on last unsubscribe.
 *   - Browser-limit safeguard: max 6 concurrent SSE connections. When exceeded,
 *     the oldest active run demotes to polling (external callers must handle).
 *
 * Usage:
 *   import { ssePool } from "@/lib/sse/pool";
 *
 *   // Subscribe to a run's SSE stream:
 *   const unsubscribe = ssePool.subscribe(runId, onEvent, onError);
 *   // On unmount:
 *   unsubscribe();
 *
 * This pool does NOT replace useSSE/RunSSEBridge directly — it is the
 * deduplication layer called by useSSEPool (../hooks/useSSEPool).
 *
 * Phase: DP3-04 (Stage Tracker manifest §4.1 DP3-SSE-POOL).
 * Scale: single-user only; no distributed state.
 */

import { createSSEConnection, type SSEConnection } from "./client";
import type { SSEWorkflowEvent } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SSEPoolEventCallback = (event: SSEWorkflowEvent) => void;
export type SSEPoolErrorCallback = (runId: string) => void;

interface PoolEntry {
  connection: SSEConnection;
  subscribers: Map<symbol, { onEvent: SSEPoolEventCallback; onError: SSEPoolErrorCallback }>;
  /** Debounce timer for deferred close on last-unsubscribe */
  closeTimer: ReturnType<typeof setTimeout> | undefined;
  /** When this entry was opened — used for oldest-eviction */
  openedAt: number;
  /** Whether this entry has been demoted to poll-only (over browser limit) */
  demoted: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max concurrent SSE connections before oldest is demoted to polling. */
const MAX_CONCURRENT_SSE = 6;

/** Debounce window for mount/unmount in ms (manifest §3.3). */
const DEBOUNCE_MS = 100;

/** Unmount debounce is wider to cover virtualized scroll remount (manifest §3.3). */
const UNMOUNT_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// SSEConnectionPool
// ---------------------------------------------------------------------------

class SSEConnectionPool {
  private readonly entries = new Map<string, PoolEntry>();

  /**
   * Subscribe to SSE events for a run.
   *
   * Opens a new SSE connection if none exists for this run_id (debounced 100 ms).
   * If an entry already exists, the subscriber is added to the existing connection.
   *
   * @returns An unsubscribe function — call on component unmount.
   */
  subscribe(
    runId: string,
    onEvent: SSEPoolEventCallback,
    onError: SSEPoolErrorCallback,
  ): () => void {
    const key = Symbol(runId);

    // Cancel any pending close for this runId
    const existing = this.entries.get(runId);
    if (existing?.closeTimer !== undefined) {
      clearTimeout(existing.closeTimer);
      existing.closeTimer = undefined;
    }

    if (existing) {
      // Add to existing connection's subscriber set
      existing.subscribers.set(key, { onEvent, onError });
    } else {
      // Evict oldest if at browser limit
      if (this.activeCount() >= MAX_CONCURRENT_SSE) {
        this.evictOldest();
      }

      // Open new connection after mount debounce
      const entry: PoolEntry = {
        connection: null as unknown as SSEConnection, // set after debounce
        subscribers: new Map([[key, { onEvent, onError }]]),
        closeTimer: undefined,
        openedAt: Date.now(),
        demoted: false,
      };
      this.entries.set(runId, entry);

      // Debounced open (handles rapid mount/unmount during scroll).
      // Guard on EventSource availability so pool is inert in test environments
      // (jsdom does not provide EventSource).
      entry.closeTimer = setTimeout(() => {
        entry.closeTimer = undefined;
        if (!this.entries.has(runId)) return; // evicted before timer fired
        if (typeof EventSource === "undefined") return; // test / SSR environment

        entry.connection = createSSEConnection<SSEWorkflowEvent>({
          url: `/api/workflows/${encodeURIComponent(runId)}/stream`,
          onEvent: (event) => {
            const e = this.entries.get(runId);
            if (!e) return;
            for (const sub of e.subscribers.values()) {
              sub.onEvent(event);
            }
          },
          onError: () => {
            const e = this.entries.get(runId);
            if (!e) return;
            for (const sub of e.subscribers.values()) {
              sub.onError(runId);
            }
          },
        });
      }, DEBOUNCE_MS);
    }

    // Return unsubscribe function
    return () => {
      const entry = this.entries.get(runId);
      if (!entry) return;

      entry.subscribers.delete(key);

      // If no subscribers remain, close after unmount debounce
      if (entry.subscribers.size === 0) {
        entry.closeTimer = setTimeout(() => {
          const e = this.entries.get(runId);
          if (!e || e.subscribers.size > 0) return;
          e.connection?.close();
          this.entries.delete(runId);
        }, UNMOUNT_DEBOUNCE_MS);
      }
    };
  }

  /**
   * Close all connections (e.g., on route change away from dashboard).
   */
  closeAll(): void {
    for (const [runId, entry] of this.entries) {
      if (entry.closeTimer !== undefined) {
        clearTimeout(entry.closeTimer);
      }
      entry.connection?.close();
      this.entries.delete(runId);
    }
  }

  /**
   * Number of currently active (non-demoted) SSE connections.
   */
  private activeCount(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.demoted) count++;
    }
    return count;
  }

  /**
   * Demote the oldest active entry to polling (callers receive an onError
   * notification which triggers their poll-fallback path).
   */
  private evictOldest(): void {
    let oldest: [string, PoolEntry] | undefined;
    for (const pair of this.entries) {
      if (pair[1].demoted) continue;
      if (!oldest || pair[1].openedAt < oldest[1].openedAt) {
        oldest = pair;
      }
    }
    if (!oldest) return;

    const [runId, entry] = oldest;
    entry.demoted = true;
    entry.connection?.close();
    // Notify subscribers so they can fall back to polling
    for (const sub of entry.subscribers.values()) {
      sub.onError(runId);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * Shell-level SSE connection pool singleton.
 * Import and use from any client component or hook that needs multiplexed SSE.
 */
export const ssePool = new SSEConnectionPool();
