"use client";

/**
 * useRunHistory — fetch previous runs for the same template.
 *
 * Fetches GET /api/workflows/runs?template_id=X for the run history list panel.
 * Exposes reRun() which POSTs to re-enqueue the workflow.
 *
 * FR-1.5-07 (Screen B — Run History panel).
 */

import { useCallback, useEffect, useReducer } from "react";
import { fetchRunHistory, reRunWorkflow } from "@/lib/api/workflow-viewer";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface RunHistoryState {
  runs: WorkflowRun[];
  isLoading: boolean;
  isReRunning: boolean;
  error: string | null;
  reRunError: string | null;
}

type RunHistoryAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; runs: WorkflowRun[] }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "RERUN_START" }
  | { type: "RERUN_SUCCESS"; newRunId: string }
  | { type: "RERUN_ERROR"; error: string };

function reducer(state: RunHistoryState, action: RunHistoryAction): RunHistoryState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, isLoading: false, runs: action.runs };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "RERUN_START":
      return { ...state, isReRunning: true, reRunError: null };
    case "RERUN_SUCCESS":
      // Prepend a placeholder so UI responds immediately.
      return {
        ...state,
        isReRunning: false,
        runs: [
          {
            id: action.newRunId,
            template_id: state.runs[0]?.template_id ?? "research_synthesis_v1",
            workspace: state.runs[0]?.workspace ?? "research",
            status: "pending",
            current_stage: null,
            started_at: new Date().toISOString(),
            completed_at: null,
            initiator: "portal",
          },
          ...state.runs,
        ],
      };
    case "RERUN_ERROR":
      return { ...state, isReRunning: false, reRunError: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRunHistoryResult {
  runs: WorkflowRun[];
  isLoading: boolean;
  isReRunning: boolean;
  error: string | null;
  reRunError: string | null;
  refetch: () => Promise<void>;
  reRun: () => Promise<void>;
}

export function useRunHistory(templateId: string | null): UseRunHistoryResult {
  const [state, dispatch] = useReducer(reducer, {
    runs: [],
    isLoading: false,
    isReRunning: false,
    error: null,
    reRunError: null,
  });

  const fetch = useCallback(async () => {
    if (!templateId) return;
    dispatch({ type: "FETCH_START" });
    try {
      const envelope = await fetchRunHistory({ template_id: templateId, limit: 20 });
      dispatch({ type: "FETCH_SUCCESS", runs: envelope.data ?? [] });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load run history",
      });
    }
  }, [templateId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const reRun = useCallback(async () => {
    if (!templateId) return;
    dispatch({ type: "RERUN_START" });
    try {
      const result = await reRunWorkflow(templateId);
      dispatch({ type: "RERUN_SUCCESS", newRunId: result.run_id });
    } catch (err) {
      dispatch({
        type: "RERUN_ERROR",
        error: err instanceof Error ? err.message : "Failed to re-run workflow",
      });
    }
  }, [templateId]);

  return {
    runs: state.runs,
    isLoading: state.isLoading,
    isReRunning: state.isReRunning,
    error: state.error,
    reRunError: state.reRunError,
    refetch: fetch,
    reRun,
  };
}
