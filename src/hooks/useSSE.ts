"use client";

/**
 * useSSE — React 19 hook for consuming an SSE workflow stream.
 *
 * Wraps `createSSEConnection` from `@/lib/sse/client` and exposes a
 * React-friendly interface:
 *   { events, status, error, reconnect, close }
 *
 * State updates are batched via a 100 ms debounce (P3-08 visual-batching
 * requirement) before being committed to React state.
 *
 * Lifecycle:
 * - Opens the SSE connection when `url` is truthy and `enabled` is true.
 * - Cleans up (closes connection) on unmount or when `url` / `enabled` changes.
 * - Calling `reconnect()` resets event history and opens a fresh connection
 *   (forwarding the last seen event ID for replay).
 *
 * Usage:
 *   const { events, status, error, reconnect, close } =
 *     useSSE<SSEWorkflowEvent>({ url: `/api/workflows/${runId}/stream` });
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createSSEConnection,
  type SSEConnection,
  type SSEClientError,
} from "@/lib/sse/client";
import { debounce } from "@/lib/sse/debounce";
import type { SSEStatus } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseSSEOptions {
  /**
   * SSE endpoint URL.  Pass `undefined` or empty string to skip connecting
   * (useful when the run_id isn't known yet).
   */
  url: string | undefined;
  /**
   * Seed value for Last-Event-ID replay on first connect.
   * Updated internally as events arrive.
   */
  lastEventId?: string;
  /**
   * Set to false to prevent the hook from opening a connection.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * Visual debounce window in ms.  Default: 100.
   * Set to 0 to disable batching (useful in tests).
   */
  debounceMs?: number;
  /** Override backoff config passed through to createSSEConnection. */
  backoff?: Parameters<typeof createSSEConnection>[0]["backoff"];
}

// ---------------------------------------------------------------------------
// State shape & reducer
// ---------------------------------------------------------------------------

interface SSEState<TEvent> {
  events: TEvent[];
  status: SSEStatus;
  error: SSEClientError | null;
}

type SSEAction<TEvent> =
  | { type: "STATUS_CHANGE"; status: SSEStatus }
  | { type: "EVENTS_FLUSH"; batch: TEvent[] }
  | { type: "ERROR"; error: SSEClientError }
  | { type: "RESET" };

function makeInitialState<TEvent>(): SSEState<TEvent> {
  return { events: [], status: "idle", error: null };
}

function reducer<TEvent>(
  state: SSEState<TEvent>,
  action: SSEAction<TEvent>,
): SSEState<TEvent> {
  switch (action.type) {
    case "STATUS_CHANGE":
      return { ...state, status: action.status };
    case "EVENTS_FLUSH":
      return {
        ...state,
        events: [...state.events, ...action.batch],
      };
    case "ERROR":
      return { ...state, error: action.error, status: "error" };
    case "RESET":
      return makeInitialState<TEvent>();
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSSEResult<TEvent> {
  /** Accumulated events received since last reset/reconnect. */
  events: TEvent[];
  /** Current connection status. */
  status: SSEStatus;
  /** Last error, if any. */
  error: SSEClientError | null;
  /**
   * Close the current connection and open a fresh one (forwarding last
   * event ID for replay).  Clears the event history.
   */
  reconnect: () => void;
  /** Permanently close the connection (no reconnect). */
  close: () => void;
}

export function useSSE<TEvent>(
  options: UseSSEOptions,
): UseSSEResult<TEvent> {
  const {
    url,
    lastEventId: seedEventId,
    enabled = true,
    debounceMs = 100,
    backoff,
  } = options;

  const [state, dispatch] = useReducer(reducer<TEvent>, undefined, makeInitialState<TEvent>);

  // Refs for values we need in callbacks without triggering re-renders
  const connRef = useRef<SSEConnection | null>(null);
  const batchRef = useRef<TEvent[]>([]);
  const lastEventIdRef = useRef<string | undefined>(seedEventId);

  // Stable debounced flush — recreated only when debounceMs changes
  const debouncedFlushRef = useRef<ReturnType<typeof debounce<[]>> | null>(null);

  // Build/rebuild the debounced flush when debounceMs changes
  useEffect(() => {
    const flush = debounce(() => {
      const batch = batchRef.current.splice(0);
      if (batch.length > 0) {
        dispatch({ type: "EVENTS_FLUSH", batch });
      }
    }, debounceMs);
    debouncedFlushRef.current = flush;

    return () => {
      flush.cancel();
    };
  }, [debounceMs]);

  // ------------------------------------------------------------------
  // Core effect: open/close SSE connection when url/enabled changes
  // ------------------------------------------------------------------

  const openConnection = useCallback((): void => {
    if (!url) return;

    connRef.current = createSSEConnection<TEvent>({
      url,
      lastEventId: lastEventIdRef.current,
      backoff,
      onStatusChange(status) {
        dispatch({ type: "STATUS_CHANGE", status });
      },
      onEvent(event) {
        // Track last event ID via the connection getter (updated inside client)
        if (connRef.current?.lastEventId) {
          lastEventIdRef.current = connRef.current.lastEventId;
        }
        batchRef.current.push(event);
        debouncedFlushRef.current?.();
      },
      onError(error) {
        debouncedFlushRef.current?.flush();
        dispatch({ type: "ERROR", error });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- backoff is intentionally stable (object ref)
  }, [url]);

  useEffect(() => {
    if (!url || !enabled) {
      dispatch({ type: "STATUS_CHANGE", status: "idle" });
      return;
    }

    openConnection();

    return () => {
      // Flush any pending batched events before teardown
      debouncedFlushRef.current?.flush();
      connRef.current?.close();
      connRef.current = null;
    };
  }, [url, enabled, openConnection]);

  // ------------------------------------------------------------------
  // Exposed controls
  // ------------------------------------------------------------------

  const reconnect = useCallback((): void => {
    // Preserve lastEventId for replay, reset everything else
    debouncedFlushRef.current?.cancel();
    batchRef.current = [];
    connRef.current?.close();
    connRef.current = null;
    dispatch({ type: "RESET" });

    if (url && enabled) {
      // Slight tick to let React flush the reset before opening
      setTimeout(openConnection, 0);
    }
  }, [url, enabled, openConnection]);

  const close = useCallback((): void => {
    debouncedFlushRef.current?.flush();
    connRef.current?.close();
    connRef.current = null;
    dispatch({ type: "STATUS_CHANGE", status: "closed" });
  }, []);

  return {
    events: state.events,
    status: state.status,
    error: state.error,
    reconnect,
    close,
  };
}
