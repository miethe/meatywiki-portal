/**
 * Workflow Viewer types — Screen B (P1.5-2-02, FR-1.5-07).
 *
 * These types mirror the backend WorkflowEventDTO and WorkflowRunDTO shapes
 * from meatywiki/portal/services/workflow_query.py.
 * No Python imports — HTTP only.
 */

// ---------------------------------------------------------------------------
// WorkflowEvent — mirrors WorkflowEventDTO
// ---------------------------------------------------------------------------

export interface WorkflowEvent {
  id: string;
  run_id: string;
  /** Stage name (e.g. "ingest_start", "classify", "compile"). */
  stage: string | null;
  /** Event type string (e.g. "stage_started", "stage_completed", "workflow_completed"). */
  event_type: string;
  /** Payload with inputs, outputs, artifact lineage, etc. */
  event_payload: WorkflowEventPayload | null;
  created_at: string;
}

export interface WorkflowEventPayload {
  inputs?: Record<string, unknown> | null;
  outputs?: Record<string, unknown> | null;
  artifact_id?: string | null;
  artifact_ids?: string[] | null;
  /** Duration in seconds, computed client-side from event timestamps. */
  duration_s?: number | null;
  error?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Derived timeline stage (client-computed)
// ---------------------------------------------------------------------------

export type TimelineStageStatus = "success" | "error" | "in_progress" | "pending";

/** Client-derived stage row built from a pair of consecutive WorkflowEvents. */
export interface TimelineStage {
  /** Stage name key from the event. */
  name: string;
  /** Human-readable label. */
  label: string;
  status: TimelineStageStatus;
  /** ISO timestamp of first event for this stage. */
  startedAt: string | null;
  /** ISO timestamp of completion event, if any. */
  completedAt: string | null;
  /** Duration in seconds (computed from start + complete timestamps). */
  durationS: number | null;
  /** The raw events that belong to this stage. */
  events: WorkflowEvent[];
}

// ---------------------------------------------------------------------------
// Re-run request — POST /api/workflows
// ---------------------------------------------------------------------------

export interface ReRunRequest {
  template_id: string;
  sources?: string[];
}
