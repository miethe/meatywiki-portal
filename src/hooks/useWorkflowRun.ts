"use client";

import { useCallback, useEffect, useReducer } from "react";
import { fetchWorkflowRun } from "@/lib/api/workflow-viewer";
import type { WorkflowRun } from "@/types/artifact";

interface WorkflowRunState {
  run: WorkflowRun | null;
  isLoading: boolean;
}

type WorkflowRunAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; run: WorkflowRun | null };

function reducer(state: WorkflowRunState, action: WorkflowRunAction): WorkflowRunState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true };
    case "FETCH_SUCCESS":
      return { run: action.run, isLoading: false };
    default:
      return state;
  }
}

export interface UseWorkflowRunResult {
  run: WorkflowRun | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useWorkflowRun(runId: string): UseWorkflowRunResult {
  const [state, dispatch] = useReducer(reducer, {
    run: null,
    isLoading: false,
  });

  const fetch = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    const run = await fetchWorkflowRun(runId);
    dispatch({ type: "FETCH_SUCCESS", run });
  }, [runId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    run: state.run,
    isLoading: state.isLoading,
    refetch: fetch,
  };
}
