"use client";

/**
 * useSSEPool — React hook wrapping the SSEConnectionPool singleton.
 *
 * Subscribes to SSE events for a single run_id via the pool, obeying the
 * Stage Tracker manifest §3.3 multiplexing rule (one connection per visible run,
 * debounced mount/unmount, refcounted subscribers).
 *
 * Usage:
 *   const { latestEvent, isError } = useSSEPool({
 *     runId: "wf-source-ingest-20260421-001",
 *     enabled: isActive,
 *     onEvent: (event) => applyEvent(runId, event),
 *     onError: () => notifySSEError(runId),
 *   });
 *
 * Phase: DP3-04 (Stage Tracker manifest §4.1 DP3-SSE-POOL).
 */

import { useEffect, useRef } from "react";
import { ssePool, type SSEPoolEventCallback, type SSEPoolErrorCallback } from "@/lib/sse/pool";

export interface UseSSEPoolOptions {
  runId: string;
  /** Whether to subscribe. Set false for non-active (static/terminal) runs. */
  enabled: boolean;
  onEvent: SSEPoolEventCallback;
  onError: SSEPoolErrorCallback;
}

/**
 * Subscribe to pool-managed SSE events for a run.
 *
 * Subscribes on mount (when enabled=true), unsubscribes on unmount.
 * Pool handles deduplication and browser-limit safeguard.
 */
export function useSSEPool({ runId, enabled, onEvent, onError }: UseSSEPoolOptions): void {
  // Stable callback refs so pool subscriber identity doesn't change on re-render
  const onEventRef = useRef<SSEPoolEventCallback>(onEvent);
  const onErrorRef = useRef<SSEPoolErrorCallback>(onError);

  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = ssePool.subscribe(
      runId,
      (event) => onEventRef.current(event),
      (id) => onErrorRef.current(id),
    );

    return unsubscribe;
  }, [runId, enabled]);
}
