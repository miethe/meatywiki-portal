/**
 * SSE event type discriminated union.
 *
 * Mirrors the backend P2-04 / P2-05 contract:
 *   WorkflowEvent { run_id, stage, timestamp, status, metadata }
 *
 * Each variant is keyed by `type` (= stage value on the wire).
 * The backend emits these as JSON in the `data:` field of each SSE event.
 *
 * Wire format per SSE event:
 *   id: <event_id>
 *   event: <type>          (optional — server may omit; `type` field inside data is authoritative)
 *   data: <JSON>
 *
 * Assumptions documented here (P3-08 scope):
 * - `event_id` is a numeric or UUID string; used for Last-Event-ID replay (P2-05).
 * - `run_id` is a URL-safe short ID (e.g., nanoid); matches the `run_id` from POST /api/intake/* → 202.
 * - `stage` maps 1:1 to the discriminant `type` field in each variant.
 * - `metadata` is stage-specific and optional on some events.
 * - Terminal events: `workflow_completed` and `workflow_failed` signal stream end.
 */

// ---------------------------------------------------------------------------
// Base fields shared by all events
// ---------------------------------------------------------------------------

export interface SSEEventBase {
  /** Unique sequential or UUID event ID (for Last-Event-ID replay). */
  event_id: string;
  /** Workflow run this event belongs to. */
  run_id: string;
  /** ISO-8601 server timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Individual event variants
// ---------------------------------------------------------------------------

export interface StageStartedEvent extends SSEEventBase {
  type: "stage_started";
  stage: string;
  metadata?: {
    label?: string;
    [key: string]: unknown;
  };
}

export interface StageProgressEvent extends SSEEventBase {
  type: "stage_progress";
  stage: string;
  /** 0–100 integer percentage, if the backend provides it. */
  progress?: number;
  metadata?: {
    message?: string;
    [key: string]: unknown;
  };
}

export interface StageCompletedEvent extends SSEEventBase {
  type: "stage_completed";
  stage: string;
  metadata?: {
    artifact_id?: string;
    summary_chars?: number;
    artifact_count?: number;
    compiled_words?: number;
    [key: string]: unknown;
  };
}

export interface WorkflowCompletedEvent extends SSEEventBase {
  type: "workflow_completed";
  /** Final artifact ID, if the workflow produced one. */
  artifact_id?: string;
  metadata?: {
    [key: string]: unknown;
  };
}

export interface WorkflowFailedEvent extends SSEEventBase {
  type: "workflow_failed";
  /** Human-readable error message. */
  error: string;
  /** Stage at which the failure occurred, if known. */
  failed_stage?: string;
  metadata?: {
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type SSEWorkflowEvent =
  | StageStartedEvent
  | StageProgressEvent
  | StageCompletedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent;

/** Terminal event types — when received, the stream can be closed. */
export const TERMINAL_EVENT_TYPES = new Set<SSEWorkflowEvent["type"]>([
  "workflow_completed",
  "workflow_failed",
]);

/** Connection status for use by consumers (hook, UI). */
export type SSEStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error";
