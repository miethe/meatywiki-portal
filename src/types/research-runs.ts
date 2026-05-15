/**
 * Research Runs types — ActiveResearchRuns widget (P5-01).
 *
 * Mirrors the backend contract for the external_research_v1 workflow:
 *
 *   GET  /api/workflows/runs?template_id=external_research_v1
 *        → ServiceModeEnvelope<WorkflowRun>   (defined in artifact.ts)
 *
 *   GET  /api/workflows/{run_id}
 *        → SingleEnvelope<WorkflowRunDetail>  (defined in workflows/research.ts)
 *
 *   PATCH /api/workflows/{run_id}/external-research/task
 *        → ExternalResearchTaskRow            (defined in workflows/research.ts)
 *        body: PatchTaskStatusBody
 *
 *   POST  /api/workflows/{run_id}/external-research/result
 *        → UploadResultResponse               (defined in workflows/research.ts)
 *        body: UploadResultJsonBody | multipart
 *
 * CONTRACT NOTE (P5-01 verification):
 *   The progress-file task descriptions referenced these URL patterns:
 *     GET /api/workflows?template_id=external_research_v1
 *     GET /api/workflows/{id}/tasks
 *     PATCH /api/workflows/{id}/task/{task_id}
 *     POST /api/workflows/{id}/result
 *   The actual FastAPI router (meatywiki/portal/api/workflows.py) uses:
 *     GET /api/workflows/runs?template_id=external_research_v1
 *     GET /api/workflows/{run_id}          (returns full detail incl. events)
 *     PATCH /api/workflows/{run_id}/external-research/task
 *     POST  /api/workflows/{run_id}/external-research/result
 *   All types in this file and in src/types/workflows/research.ts already
 *   reflect the real backend paths. No backend contract change is required.
 *
 * All types are HTTP-only serialisation mirrors. No Python imports.
 * P5-01 (audit-wave-2-phase-5).
 */

// ---------------------------------------------------------------------------
// Re-export shared types for widget consumers
// ---------------------------------------------------------------------------

export type {
  WorkflowRun,
  WorkflowRunStatus,
  ServiceModeEnvelope,
  SingleEnvelope,
} from "@/types/artifact";

export type {
  ExternalResearchTaskRow,
  ExternalResearchTaskStatus,
  PatchTaskStatusBody,
  UploadResultJsonBody,
  UploadResultResponse,
  ValidationReport,
  WorkflowRunDetail,
  StageDuration,
  ArtifactRefDTO,
} from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// ResearchRun — enriched view used by the ActiveResearchRuns widget
// ---------------------------------------------------------------------------

/**
 * A research run as rendered by the ActiveResearchRuns widget.
 *
 * Built from a WorkflowRun (list response) optionally merged with
 * ExternalResearchTaskRow (task detail). The widget polls the list endpoint
 * and lazily fetches task rows for status badge enrichment.
 *
 * topic and research_question surface in the run card header.
 * They are stored in workflow_runs.metadata by the backend at create-run time;
 * the frontend reads them from WorkflowRun.metadata when present.
 */
export interface ResearchRun {
  /** ULID of the workflow_runs row. */
  run_id: string;
  /** Always "external_research_v1" for runs shown in this widget. */
  template_id: string;
  /** Current run status. */
  status: import("@/types/artifact").WorkflowRunStatus;
  /** ISO-8601 creation timestamp. */
  created_at: string;
  /** ISO-8601 completion timestamp, or null when still in progress. */
  completed_at: string | null;
  /**
   * Human-readable research topic.
   * Sourced from WorkflowRun.metadata.topic when available.
   */
  topic: string | null;
  /**
   * Primary research question.
   * Sourced from WorkflowRun.metadata.research_question when available.
   */
  research_question: string | null;
  /**
   * External research task row, enriched from PATCH response or task detail.
   * Null until the widget fetches it separately.
   */
  task: import("@/types/workflows/research").ExternalResearchTaskRow | null;
}

// ---------------------------------------------------------------------------
// Polling state types
// ---------------------------------------------------------------------------

/** Polling states for the ActiveResearchRuns widget. */
export type PollingStatus = "idle" | "fetching" | "backoff" | "error";

/** Exponential backoff configuration for error handling. */
export interface BackoffConfig {
  /** Base interval in ms (normal polling cadence). Default: 5000. */
  baseIntervalMs: number;
  /** Maximum backoff interval in ms. Default: 30000. */
  maxIntervalMs: number;
  /** Multiplier applied on each consecutive error. Default: 2. */
  factor: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  baseIntervalMs: 5_000,
  maxIntervalMs: 30_000,
  factor: 2,
};

// ---------------------------------------------------------------------------
// API helper — extracting topic / research_question from metadata
// ---------------------------------------------------------------------------

/**
 * Extract ResearchRun view fields from a raw WorkflowRun list item.
 *
 * The backend stores ExternalResearchParams fields in workflow_runs.metadata
 * at create-run time (meatywiki/portal/services/external_research.py).
 * We surface topic and research_question here; all other params are opaque.
 */
export function toResearchRun(
  run: import("@/types/artifact").WorkflowRun,
): ResearchRun {
  const meta = run.metadata ?? {};
  return {
    run_id: run.id,
    template_id: run.template_id,
    status: run.status,
    created_at: run.created_at ?? new Date().toISOString(),
    completed_at: run.completed_at ?? null,
    topic: typeof meta["topic"] === "string" ? meta["topic"] : null,
    research_question:
      typeof meta["research_question"] === "string"
        ? meta["research_question"]
        : null,
    task: null,
  };
}
