"use client";

/**
 * useWorkflowRuns — client hook for the Workflow Status Surface (P3-07).
 *
 * Responsibilities:
 *   1. Fetch active + recent (last 24 h) workflow runs via GET /api/workflows/runs.
 *   2. Open one SSE stream per ACTIVE run via `useSSE` (src/lib/sse/client.ts).
 *      When an SSE event arrives, the in-memory run record is patched in-place:
 *        - stage_started / stage_progress → update current_stage
 *        - stage_completed               → advance current_stage
 *        - workflow_completed            → set status = "complete", close stream
 *        - workflow_failed               → set status = "failed",   close stream
 *   3. Exposes `activeRuns`, `recentRuns`, loading, error, and refetch.
 *
 * SSE approach:
 *   - A single `MultiRunSSESubscriber` sub-component (rendered inside the panel)
 *     mounts one `useSSE` instance per active run ID. This avoids calling hooks
 *     inside loops (React rules) by rendering a per-run component.
 *   - When a run transitions to a terminal state via SSE, its entry is updated
 *     and moved from activeRuns → recentRuns on the next render cycle.
 *
 * Polling fallback:
 *   - When the browser fires an SSE `error` status, a 30-second interval poll
 *     is activated to refresh the full runs list (graceful degradation per P3-08).
 *
 * Data-fetching: native fetch via listWorkflows (no TanStack Query / SWR).
 * Follows the same pattern as useInboxArtifacts (src/hooks/useInboxArtifacts.ts).
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { listWorkflows, hoursAgo } from "@/lib/api/workflows";
import type { WorkflowRun, WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface WorkflowRunsState {
  runs: WorkflowRun[];
  isLoading: boolean;
  error: string | null;
  /** Track whether at least one SSE stream is in error (triggers poll fallback). */
  sseErrored: boolean;
}

type WorkflowRunsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; runs: WorkflowRun[] }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "APPLY_SSE_EVENT"; runId: string; event: SSEWorkflowEvent }
  | { type: "SSE_ERROR"; runId: string }
  | { type: "SSE_RECOVERED" };

const ACTIVE_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set([
  "pending",
  "running",
]);

function applySSEEvent(run: WorkflowRun, event: SSEWorkflowEvent): WorkflowRun {
  switch (event.type) {
    case "stage_started":
    case "stage_progress": {
      // Stage index is not directly in the event — use the stage name to
      // resolve index against the run's template stage list.
      return { ...run, status: "running" };
    }
    case "stage_completed": {
      const next = (run.current_stage ?? 0) + 1;
      return { ...run, current_stage: next, status: "running" };
    }
    case "workflow_completed": {
      return {
        ...run,
        status: "complete",
        completed_at: event.timestamp,
      };
    }
    case "workflow_failed": {
      return { ...run, status: "failed" };
    }
    default:
      return run;
  }
}

function reducer(
  state: WorkflowRunsState,
  action: WorkflowRunsAction,
): WorkflowRunsState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };

    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        error: null,
        runs: action.runs,
      };

    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };

    case "APPLY_SSE_EVENT": {
      const updated = state.runs.map((r) =>
        r.id === action.runId
          ? applySSEEvent(r, action.event)
          : r,
      );
      return { ...state, runs: updated };
    }

    case "SSE_ERROR":
      return { ...state, sseErrored: true };

    case "SSE_RECOVERED":
      return { ...state, sseErrored: false };

    default:
      return state;
  }
}

const initialState: WorkflowRunsState = {
  runs: [],
  isLoading: false,
  error: null,
  sseErrored: false,
};

// ---------------------------------------------------------------------------
// Public hook result
// ---------------------------------------------------------------------------

export interface UseWorkflowRunsResult {
  /** Runs with status pending | running. */
  activeRuns: WorkflowRun[];
  /** Runs that are complete / failed / abandoned within the last 24 h. */
  recentRuns: WorkflowRun[];
  /** Total active run count (for the top-bar badge). */
  activeCount: number;
  isLoading: boolean;
  error: string | null;
  /** Manually re-fetch the full runs list from the backend. */
  refetch: () => Promise<void>;
  /** Dispatch an SSE event for a specific run (called by RunSSEBridge). */
  applyEvent: (runId: string, event: SSEWorkflowEvent) => void;
  /** Notify the hook that an SSE stream errored (triggers poll fallback). */
  notifySSEError: (runId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000; // 30 s fallback poll when SSE is degraded

export function useWorkflowRuns(): UseWorkflowRunsResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  const fetchRuns = useCallback(async (): Promise<void> => {
    dispatch({ type: "FETCH_START" });
    try {
      const envelope = await listWorkflows({ since: hoursAgo(24) });
      dispatch({ type: "FETCH_SUCCESS", runs: envelope.data ?? [] });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load workflows",
      });
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  // ------------------------------------------------------------------
  // Poll fallback — activated when SSE errors, cleared when SSE recovers
  // ------------------------------------------------------------------

  useEffect(() => {
    if (state.sseErrored) {
      if (pollTimerRef.current === null) {
        pollTimerRef.current = setInterval(() => {
          void fetchRuns();
        }, POLL_INTERVAL_MS);
      }
    } else {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [state.sseErrored, fetchRuns]);

  // ------------------------------------------------------------------
  // Derived views
  // ------------------------------------------------------------------

  const activeRuns = state.runs.filter((r) => ACTIVE_STATUSES.has(r.status));
  const recentRuns = state.runs.filter((r) => !ACTIVE_STATUSES.has(r.status));

  // ------------------------------------------------------------------
  // Callbacks surfaced to SSE bridges
  // ------------------------------------------------------------------

  const applyEvent = useCallback(
    (runId: string, event: SSEWorkflowEvent): void => {
      dispatch({ type: "APPLY_SSE_EVENT", runId, event });
    },
    [],
  );

  const notifySSEError = useCallback((_runId: string): void => {
    dispatch({ type: "SSE_ERROR", runId: _runId });
  }, []);

  return {
    activeRuns,
    recentRuns,
    activeCount: activeRuns.length,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchRuns,
    applyEvent,
    notifySSEError,
  };
}
