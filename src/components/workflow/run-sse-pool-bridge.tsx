"use client";

/**
 * RunSSEPoolBridge — invisible component that subscribes to the SSE pool
 * for a single active workflow run, forwarding events to the parent hook.
 *
 * Replaces RunSSEBridge on the Workflow Status Surface (and any other
 * screen with multiple concurrent active runs) to obey the Stage Tracker
 * manifest §3.3 multiplexing rule:
 *   - One SSE connection per visible run across the app (pool-deduped).
 *   - Debounce mount/unmount 100 ms / 500 ms.
 *   - Max 6 concurrent; oldest demoted to polling on overflow.
 *
 * All other behaviour mirrors RunSSEBridge: renders null, purely a
 * side-effect component (one per run row, keyed by run.id).
 *
 * Phase: DP3-04 (Stage Tracker manifest §4.1 DP3-SSE-POOL).
 */

import type { SSEWorkflowEvent } from "@/lib/sse/types";
import { useSSEPool } from "@/hooks/useSSEPool";

interface RunSSEPoolBridgeProps {
  runId: string;
  /** Only subscribe when the run is active (pending|running). */
  isActive: boolean;
  applyEvent: (runId: string, event: SSEWorkflowEvent) => void;
  notifySSEError: (runId: string) => void;
}

export function RunSSEPoolBridge({
  runId,
  isActive,
  applyEvent,
  notifySSEError,
}: RunSSEPoolBridgeProps) {
  useSSEPool({
    runId,
    enabled: isActive,
    onEvent: (event) => applyEvent(runId, event),
    onError: notifySSEError,
  });

  return null;
}
