"use client";

/**
 * useCompileEvents — React hook for streaming compile-stage events via SSE.
 *
 * Endpoint: GET /api/artifacts/{artifactId}/compile/events
 * Contract: docs/api/compile-events-contract.md (in sibling meatywiki repo)
 *
 * Design decisions:
 * - Delegates to the existing `useSSE` hook (which wraps `createSSEConnection`
 *   from @/lib/sse/client). The SSE client uses native EventSource. Auth in
 *   this app is via HttpOnly cookie, so no Authorization header is required
 *   on the client — EventSource works fine.
 * - Events are deduped by the `id` field (UUID from the SSE frame `id:` line,
 *   which the backend sets as a UUIDv4 PK). The SSE client's auto-replay on
 *   reconnect means duplicates can arrive; we filter them in this hook.
 * - Terminal detection: stage === "terminal" with status "completed" or "failed".
 * - On terminal: sets `terminal` state; stream stays open (FE may unsubscribe
 *   via `enabled=false`).
 * - Reconnect: uses Last-Event-ID forwarded by `useSSE`/`createSSEConnection`
 *   (passed as `?lastEventId=<id>` query param, accepted by backend).
 *
 * Usage:
 *   const { events, latest, terminal, isStreaming, reconnect } =
 *     useCompileEvents({ artifactId, enabled: isCompiling });
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import { getApiBase } from "@/lib/api/config";
import type {
  WorkflowStageEventDTO,
  CompileTerminalState,
} from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseCompileEventsOptions {
  /** The artifact whose compile stream to subscribe to. */
  artifactId: string;
  /**
   * Set to false to prevent opening the connection (e.g. before compile POST
   * has been sent, or after terminal event was received and caller is done).
   */
  enabled: boolean;
  /**
   * Optional seed Last-Event-ID — enables replay from a prior session.
   */
  lastEventId?: string;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UseCompileEventsResult {
  /** Deduplicated ordered list of all received stage events. */
  events: WorkflowStageEventDTO[];
  /** The most recently received event; null if none received yet. */
  latest: WorkflowStageEventDTO | null;
  /**
   * Set once a terminal event (`stage="terminal"`) is received.
   * Null while the pipeline is still running.
   */
  terminal: CompileTerminalState | null;
  /** True while the SSE connection is open and pipeline is running. */
  isStreaming: boolean;
  /**
   * Reset event history and re-open the SSE connection.
   * Useful if the user triggers a fresh compile after a failure.
   */
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompileEvents({
  artifactId,
  enabled,
  lastEventId,
}: UseCompileEventsOptions): UseCompileEventsResult {
  const apiBase = getApiBase();
  const url = enabled
    ? `${apiBase}/artifacts/${artifactId}/compile/events`
    : undefined;

  // Delegate SSE lifecycle to the existing hook (no extra reconnect logic needed
  // — createSSEConnection handles exponential back-off up to 10 retries).
  const { events: rawEvents, status, reconnect: rawReconnect } = useSSE<WorkflowStageEventDTO>({
    url,
    enabled,
    lastEventId,
    // Disable debounce in tests (tests set debounceMs=0 explicitly if needed)
    debounceMs: 100,
  });

  // ---------------------------------------------------------------------------
  // Dedup: maintain a Set of seen event IDs to filter replay duplicates.
  // We use a ref (not state) so dedup is instant and doesn't cause re-renders.
  // ---------------------------------------------------------------------------
  const seenIdsRef = useRef<Set<string>>(new Set<string>());

  // Reset seenIds when the enabled flag goes from false→true (fresh compile).
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      seenIdsRef.current = new Set<string>();
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  // Deduplicated + ordered events (rawEvents come in order from useSSE).
  const events = useMemo<WorkflowStageEventDTO[]>(() => {
    const seen = new Set<string>();
    const result: WorkflowStageEventDTO[] = [];
    for (const e of rawEvents) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        result.push(e);
      }
    }
    return result;
  }, [rawEvents]);

  // ---------------------------------------------------------------------------
  // Terminal detection
  // ---------------------------------------------------------------------------
  const terminal = useMemo<CompileTerminalState | null>(() => {
    for (const e of events) {
      if (e.stage === "terminal") {
        if (e.status === "completed") {
          return { status: "success" };
        }
        if (e.status === "failed") {
          const errPayload = e.payload as {
            error_code?: string;
            error_message?: string;
          };
          return {
            status: "error",
            error: {
              code: errPayload.error_code ?? "UNKNOWN",
              message: errPayload.error_message ?? "Compilation failed",
            },
          };
        }
      }
    }
    return null;
  }, [events]);

  const latest = events.length > 0 ? events[events.length - 1] : null;

  const isStreaming =
    enabled && (status === "open" || status === "connecting" || status === "reconnecting");

  const reconnect = useCallback(() => {
    seenIdsRef.current = new Set<string>();
    rawReconnect();
  }, [rawReconnect]);

  return { events, latest, terminal, isStreaming, reconnect };
}
