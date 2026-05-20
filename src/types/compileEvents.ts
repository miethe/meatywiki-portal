/**
 * Compile-events domain types — aligned with the compile-events-contract.md.
 *
 * WorkflowStageEventDTO mirrors WorkflowEventResponseItem from the backend's
 * src/meatywiki/portal/api/schemas/processing.py.
 *
 * The SSE endpoint emits `event: workflow_stage_event` frames carrying
 * JSON-serialised WorkflowStageEventDTO objects. The terminal event uses
 * `stage="terminal"` with `status="completed"` or `status="failed"`.
 */

// ---------------------------------------------------------------------------
// Stage enum (canonical names — see contract §3)
// ---------------------------------------------------------------------------

export type CompileStage =
  | "classify"
  | "extract"
  | "compile"
  | "file_back"
  | "lint"
  | "terminal"
  | string; // opaque forward-compat

// ---------------------------------------------------------------------------
// Status enum (contract §4)
// ---------------------------------------------------------------------------

export type CompileEventStatus = "started" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Main DTO
// ---------------------------------------------------------------------------

export interface WorkflowStageEventDTO {
  /** Correlation UUID — used as SSE frame `id:` for dedup and Last-Event-ID. */
  id: string;
  /** 30-char art_<ULID> prefix; null for bulk/CLI events. */
  artifact_id: string | null;
  /** Correlates to workflow_runs.id. Nullable. */
  run_id: string | null;
  /** Always "compile" for compile pipeline events. */
  workflow: string;
  /** Canonical stage name (classify / extract / compile / file_back / lint / terminal). */
  stage: CompileStage;
  /** Transition status. */
  status: CompileEventStatus;
  /** UTC ISO 8601 timestamp. */
  created_at: string;
  /** Arbitrary stage-specific metadata. */
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Terminal event shape (same DTO; discriminated by stage === "terminal")
// ---------------------------------------------------------------------------

export interface CompileTerminalState {
  status: "success" | "error";
  error?: {
    code: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Activity endpoint response (contract §6)
// ---------------------------------------------------------------------------

export interface ActivityResponse {
  items: WorkflowStageEventDTO[];
  /** ISO 8601 of the oldest item on current page; null = last page. */
  next_cursor: string | null;
}

// ---------------------------------------------------------------------------
// Inbox with processed array (contract §7)
// ---------------------------------------------------------------------------

export interface ProcessedItemDTO {
  /** Artifact that has moved out of inbox within the past 24 h. */
  id: string;
  workspace: string;
  type: string;
  subtype?: string | null;
  title: string;
  status: string;
  created?: string | null;
  updated?: string | null;
  file_path: string;
  /** ISO 8601 of the terminal compile event that moved it out. */
  compiled_at?: string | null;
}

export interface InboxWithProcessedEnvelope<T> {
  items: T[];
  processed: ProcessedItemDTO[];
  cursor: string | null;
  etag?: string | null;
}
