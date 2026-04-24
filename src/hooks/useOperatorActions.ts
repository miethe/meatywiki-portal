"use client";

/**
 * useOperatorActions — pause / resume / cancel a workflow run.
 *
 * Wraps the three operator-action endpoints:
 *   POST /api/workflows/:run_id/pause
 *   POST /api/workflows/:run_id/resume
 *   POST /api/workflows/:run_id/cancel
 *
 * Each action sets `isPending` for the duration of the request and surfaces
 * an error string on failure. On success, `onSuccess` is called (callers use
 * it to trigger a refetch of the run state / audit log).
 *
 * P7-03 — Screen B operator actions.
 */

import { useCallback, useReducer } from "react";
import { pauseWorkflow, resumeWorkflow, cancelWorkflow } from "@/lib/api/workflow-viewer";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface OperatorState {
  isPending: boolean;
  error: string | null;
}

type OperatorAction =
  | { type: "START" }
  | { type: "SUCCESS" }
  | { type: "ERROR"; error: string };

function reducer(state: OperatorState, action: OperatorAction): OperatorState {
  switch (action.type) {
    case "START":
      return { isPending: true, error: null };
    case "SUCCESS":
      return { isPending: false, error: null };
    case "ERROR":
      return { isPending: false, error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseOperatorActionsResult {
  isPending: boolean;
  error: string | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
}

export function useOperatorActions(
  runId: string,
  onSuccess: () => void,
): UseOperatorActionsResult {
  const [state, dispatch] = useReducer(reducer, {
    isPending: false,
    error: null,
  });

  const execute = useCallback(
    async (fn: (id: string) => Promise<unknown>) => {
      dispatch({ type: "START" });
      try {
        await fn(runId);
        dispatch({ type: "SUCCESS" });
        onSuccess();
      } catch (err) {
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Action failed — please try again.",
        });
      }
    },
    [runId, onSuccess],
  );

  const pause = useCallback(() => execute(pauseWorkflow), [execute]);
  const resume = useCallback(() => execute(resumeWorkflow), [execute]);
  const cancel = useCallback(() => execute(cancelWorkflow), [execute]);

  return { isPending: state.isPending, error: state.error, pause, resume, cancel };
}
