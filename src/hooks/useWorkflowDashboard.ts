"use client";

/**
 * useWorkflowDashboard — data hook for Workflow OS Screen C (Ops Dashboard).
 *
 * Fetches GET /api/workflows/dashboard on mount; re-fetches every 30 seconds
 * while any runs are in-progress (live polling). Manual refetch also exposed.
 *
 * Bulk actions (cancel / retry) are dispatched via POST /api/workflows/runs/bulk-action.
 * After a successful bulk action the dashboard is immediately re-fetched.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  fetchWorkflowDashboard,
  postBulkAction,
  type WorkflowDashboardResponse,
  type BulkAction,
  type BulkActionResult,
} from "@/lib/api/workflow-dashboard";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface DashboardState {
  data: WorkflowDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  /** IDs of runs currently being bulk-actioned (shows per-row spinner). */
  pendingRunIds: Set<string>;
  /** Last bulk action result for toast/banner display. */
  lastActionResult: BulkActionResult | null;
}

type DashboardAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; data: WorkflowDashboardResponse }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "BULK_START"; runIds: string[] }
  | { type: "BULK_DONE"; result: BulkActionResult }
  | { type: "BULK_ERROR"; error: string }
  | { type: "CLEAR_ACTION_RESULT" };

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };

    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        error: null,
        data: action.data,
      };

    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };

    case "BULK_START": {
      const next = new Set(state.pendingRunIds);
      action.runIds.forEach((id) => next.add(id));
      return { ...state, pendingRunIds: next };
    }

    case "BULK_DONE": {
      // Clear pending flags for processed + failed runs
      const next = new Set(state.pendingRunIds);
      action.result.processed.forEach((id) => next.delete(id));
      action.result.failed.forEach(({ run_id }) => next.delete(run_id));
      return { ...state, pendingRunIds: next, lastActionResult: action.result };
    }

    case "BULK_ERROR": {
      return { ...state, pendingRunIds: new Set(), error: action.error };
    }

    case "CLEAR_ACTION_RESULT":
      return { ...state, lastActionResult: null };

    default:
      return state;
  }
}

const initialState: DashboardState = {
  data: null,
  isLoading: false,
  error: null,
  pendingRunIds: new Set(),
  lastActionResult: null,
};

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

export interface UseWorkflowDashboardResult {
  data: WorkflowDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  pendingRunIds: Set<string>;
  lastActionResult: BulkActionResult | null;
  refetch: () => Promise<void>;
  bulkAction: (action: BulkAction, runIds: string[], reason?: string) => Promise<void>;
  clearActionResult: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const LIVE_POLL_INTERVAL_MS = 30_000;

export function useWorkflowDashboard(): UseWorkflowDashboardResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    dispatch({ type: "FETCH_START" });
    try {
      const data = await fetchWorkflowDashboard();
      dispatch({ type: "FETCH_SUCCESS", data });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load dashboard",
      });
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Live polling: active while any runs are in-progress
  useEffect(() => {
    const hasActive = (state.data?.in_progress_queue.length ?? 0) > 0;

    if (hasActive) {
      if (pollRef.current === null) {
        pollRef.current = setInterval(() => void fetchData(), LIVE_POLL_INTERVAL_MS);
      }
    } else {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state.data?.in_progress_queue.length, fetchData]);

  const bulkAction = useCallback(
    async (action: BulkAction, runIds: string[], reason?: string): Promise<void> => {
      if (runIds.length === 0) return;
      dispatch({ type: "BULK_START", runIds });
      try {
        const result = await postBulkAction({ action, run_ids: runIds, reason });
        dispatch({ type: "BULK_DONE", result });
        // Refresh dashboard after action
        await fetchData();
      } catch (err) {
        dispatch({
          type: "BULK_ERROR",
          error: err instanceof Error ? err.message : "Bulk action failed",
        });
      }
    },
    [fetchData],
  );

  const clearActionResult = useCallback((): void => {
    dispatch({ type: "CLEAR_ACTION_RESULT" });
  }, []);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    pendingRunIds: state.pendingRunIds,
    lastActionResult: state.lastActionResult,
    refetch: fetchData,
    bulkAction,
    clearActionResult,
  };
}
