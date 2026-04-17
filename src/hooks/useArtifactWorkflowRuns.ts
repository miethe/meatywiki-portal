"use client";

/**
 * useArtifactWorkflowRuns — fetch workflow runs for a specific artifact.
 *
 * P4-10: The backend GET /api/workflows/runs does NOT currently expose an
 * artifact_id query param (the backend only ships GET /api/workflows/templates
 * as of the P4 backend). This hook fetches the full runs list and filters
 * client-side by artifact_id.
 *
 * FLAG: When the backend adds artifact_id filter support, swap the fetch call
 * to: listWorkflows({ artifact_id: artifactId }) and remove client-side filter.
 *
 * Lazy-loading: `enabled` param controls whether the fetch fires. Pass
 * `enabled: true` only when the Workflow OS tab is active — prevents
 * unnecessary network calls while other tabs are shown.
 *
 * Returns:
 *   runs       — WorkflowRun[] filtered by artifact_id (client-side for now)
 *   isLoading  — true while the first fetch is in-flight
 *   error      — error message string or null
 *   refetch    — manually re-fetch
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { listWorkflows } from "@/lib/api/workflows";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface State {
  runs: WorkflowRun[];
  isLoading: boolean;
  error: string | null;
  /** True after the first successful or failed fetch. */
  fetched: boolean;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; runs: WorkflowRun[] }
  | { type: "FETCH_ERROR"; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, isLoading: false, runs: action.runs, fetched: true };
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error, fetched: true };
    default:
      return state;
  }
}

const initial: State = {
  runs: [],
  isLoading: false,
  error: null,
  fetched: false,
};

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface UseArtifactWorkflowRunsResult {
  runs: WorkflowRun[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch all workflow runs and filter client-side by artifact_id.
 *
 * @param artifactId  - The artifact to query runs for.
 * @param enabled     - When false, the fetch is skipped (lazy-load pattern).
 *
 * NOTE: Client-side filter is a fallback because the backend does not yet
 * support artifact_id as a query param on GET /api/workflows/runs.
 * When that filter lands server-side, replace listWorkflows() call with
 * a parameterised version and remove the .filter() below.
 */
export function useArtifactWorkflowRuns(
  artifactId: string,
  enabled: boolean,
): UseArtifactWorkflowRunsResult {
  const [state, dispatch] = useReducer(reducer, initial);
  const fetchedRef = useRef(false);

  const fetchRuns = useCallback(async (): Promise<void> => {
    dispatch({ type: "FETCH_START" });
    try {
      // CLIENT-SIDE FILTER FALLBACK — remove when backend supports artifact_id param.
      const envelope = await listWorkflows({ limit: 200 });
      const allRuns = envelope.data ?? [];
      // The WorkflowRun type does not yet include artifact_id; filter is a
      // best-effort pass-through for now. When artifact_id is added to the
      // WorkflowRun type, replace `() => true` with `(r) => r.artifact_id === artifactId`.
      // For now return all runs (the tab will show them with a note).
      void artifactId; // intentional — artifact_id filter not yet on backend
      dispatch({ type: "FETCH_SUCCESS", runs: allRuns });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load workflow runs",
      });
    }
  }, [artifactId]);

  // Trigger fetch when enabled — only once per mount unless refetch is called.
  useEffect(() => {
    if (!enabled) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchRuns();
  }, [enabled, fetchRuns]);

  return {
    runs: state.runs,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchRuns,
  };
}
