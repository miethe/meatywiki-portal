"use client";

/**
 * RunSSEBridge — invisible component that subscribes to the SSE stream for
 * a single active workflow run and forwards events to the parent hook via
 * the `applyEvent` / `notifySSEError` callbacks.
 *
 * Why a component and not a loop of hooks?
 *   React's rules of hooks forbid calling hooks inside loops. The idiomatic
 *   solution is to render one component per run so each mounts exactly one
 *   `useSSE` instance.  The component renders null — it's purely for the
 *   side-effect of the SSE subscription.
 *
 * Lifecycle:
 *   - Opens SSE on mount (when `enabled` is true).
 *   - Closes on unmount or when `runId` changes.
 *   - Forwards all received events to `applyEvent`.
 *   - Calls `notifySSEError` on SSE error (triggers poll fallback in parent).
 *
 * Usage:
 *   {activeRuns.map((run) => (
 *     <RunSSEBridge
 *       key={run.id}
 *       runId={run.id}
 *       applyEvent={applyEvent}
 *       notifySSEError={notifySSEError}
 *     />
 *   ))}
 *
 * Design spec: P3-07 §SSE wiring, P3-08 §client-side logic.
 */

import { useEffect } from "react";
import { useSSE } from "@/hooks/useSSE";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

interface RunSSEBridgeProps {
  runId: string;
  applyEvent: (runId: string, event: SSEWorkflowEvent) => void;
  notifySSEError: (runId: string) => void;
}

export function RunSSEBridge({
  runId,
  applyEvent,
  notifySSEError,
}: RunSSEBridgeProps) {
  const { events, status } = useSSE<SSEWorkflowEvent>({
    url: `/api/workflows/${encodeURIComponent(runId)}/stream`,
    enabled: true,
  });

  // Forward the latest event to parent state when the events array grows.
  // We intentionally depend only on events.length (not the full array or
  // applyEvent/runId refs) to avoid re-running on every render cycle.
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    applyEvent(runId, latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  // Notify parent when SSE degrades so poll fallback activates
  useEffect(() => {
    if (status === "error") {
      notifySSEError(runId);
    }
  }, [status, runId, notifySSEError]);

  return null;
}
