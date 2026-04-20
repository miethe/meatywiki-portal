"use client";

/**
 * useWorkflowTimeline — fetch + derive timeline stages for a single workflow run.
 *
 * Fetches GET /api/workflows/:run_id/timeline and derives client-side
 * TimelineStage objects (with computed durations) from the raw events.
 *
 * Returns:
 *   events      — raw WorkflowEvent[] in chronological order
 *   stages      — derived TimelineStage[] for the timeline panel
 *   isLoading
 *   error
 *   refetch
 *
 * FR-1.5-07 (Screen B — Timeline panel).
 */

import { useCallback, useEffect, useReducer } from "react";
import { fetchWorkflowTimeline } from "@/lib/api/workflow-viewer";
import type { WorkflowEvent, TimelineStage, TimelineStageStatus } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Stage label map — mirrors TEMPLATE_STAGES in lib/workflow/stages.ts
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  ingest_start: "Ingest",
  classify: "Classify",
  extract: "Extract",
  compile: "Compile",
  lint: "Lint",
  complete: "Complete",
  // research_synthesis_v1 specific
  scope: "Scope",
  synthesise: "Synthesise",
  review: "Review",
  result_upload: "Upload",
};

function stageLabel(name: string): string {
  return STAGE_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Stage derivation from raw events
// ---------------------------------------------------------------------------

/**
 * Group events by stage name and derive TimelineStage objects.
 * Duration is computed from the first and last event timestamps per stage.
 */
function deriveTimelineStages(events: WorkflowEvent[]): TimelineStage[] {
  if (events.length === 0) return [];

  // Group by stage name (preserve insertion order for chronological ordering).
  const stageMap = new Map<string, WorkflowEvent[]>();

  for (const ev of events) {
    const key = ev.stage ?? ev.event_type;
    if (!stageMap.has(key)) stageMap.set(key, []);
    stageMap.get(key)!.push(ev);
  }

  return Array.from(stageMap.entries()).map(([name, stageEvents]) => {
    const sorted = [...stageEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const startedAt = sorted[0]?.created_at ?? null;
    const lastEventAt = sorted[sorted.length - 1]?.created_at ?? null;

    const durationS =
      startedAt && lastEventAt && startedAt !== lastEventAt
        ? (new Date(lastEventAt).getTime() - new Date(startedAt).getTime()) / 1000
        : null;

    // Infer status from event types in this stage.
    const types = stageEvents.map((e) => e.event_type);
    let status: TimelineStageStatus = "pending";

    if (types.some((t) => t === "workflow_failed" || t === "stage_failed")) {
      status = "error";
    } else if (
      types.some(
        (t) => t === "stage_completed" || t === "workflow_completed",
      )
    ) {
      status = "success";
    } else if (
      types.some((t) => t === "stage_started" || t === "stage_progress")
    ) {
      status = "in_progress";
    }

    return {
      name,
      label: stageLabel(name),
      status,
      startedAt,
      completedAt: status === "success" ? lastEventAt : null,
      durationS,
      events: sorted,
    } satisfies TimelineStage;
  });
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface TimelineState {
  events: WorkflowEvent[];
  stages: TimelineStage[];
  isLoading: boolean;
  error: string | null;
}

type TimelineAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; events: WorkflowEvent[] }
  | { type: "FETCH_ERROR"; error: string };

function reducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS": {
      const stages = deriveTimelineStages(action.events);
      return { ...state, isLoading: false, error: null, events: action.events, stages };
    }
    case "FETCH_ERROR":
      return { ...state, isLoading: false, error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export interface UseWorkflowTimelineResult {
  events: WorkflowEvent[];
  stages: TimelineStage[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkflowTimeline(runId: string): UseWorkflowTimelineResult {
  const [state, dispatch] = useReducer(reducer, {
    events: [],
    stages: [],
    isLoading: false,
    error: null,
  });

  const fetch = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const events = await fetchWorkflowTimeline(runId);
      dispatch({ type: "FETCH_SUCCESS", events });
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to load timeline",
      });
    }
  }, [runId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    events: state.events,
    stages: state.stages,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetch,
  };
}
