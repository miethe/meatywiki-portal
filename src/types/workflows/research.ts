/**
 * External Research Workflow types — portal-v2.1 Research Workflow Realignment.
 *
 * Mirrors the backend DTOs in:
 *   meatywiki/portal/api/workflows.py
 *   meatywiki/portal/services/external_research.py
 *   meatywiki/portal/templates.py (ExternalResearchParams)
 *
 * Covered endpoints:
 *   POST /api/workflows/external-research           → CreateExternalResearchBody / CreateRunResponse
 *   GET  /api/workflows?template_id=external_research_v1 → uses ServiceModeEnvelope<WorkflowRun>
 *   PATCH /api/workflows/{id}/external-research/task → PatchTaskStatusBody / ExternalResearchTaskRow
 *   POST /api/workflows/{id}/external-research/result → UploadResultBody / UploadResultResponse
 *   GET  /api/workflows/{id}                        → uses SingleEnvelope<WorkflowRunDetail>
 *
 * All types are serialisation mirrors only — no Python imports, HTTP only.
 * datetime → string (ISO-8601), optional Pydantic fields → `field?: Type`.
 *
 * P4-01 (audit-wave-2-phase-4).
 */

// ---------------------------------------------------------------------------
// Re-export shared envelope types from artifact.ts for convenience
// ---------------------------------------------------------------------------

export type { ServiceModeEnvelope, SingleEnvelope, WorkflowRun, ArtifactRef } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Enums — mirrors meatywiki/portal/templates.py
// ---------------------------------------------------------------------------

/**
 * Preferred venue for an external research run.
 * Mirrors: RoutePreference (StrEnum)
 */
export type RoutePreference =
  | "auto"
  | "chatgpt"
  | "perplexity"
  | "gemini"
  | "notebooklm"
  | "internal_synthesis"
  | "custom_manual";

/**
 * Expected output artifact type produced by the research run.
 * Mirrors: DesiredOutput (StrEnum)
 */
export type DesiredOutput = "briefing" | "topic_note" | "blog" | "prd";

/**
 * Controls how the generated prompt instructs the venue to handle citations.
 * Mirrors: CitationStrictness (StrEnum)
 */
export type CitationStrictness = "advisory" | "strict";

/**
 * State machine values for an external research task row.
 * Mirrors: ExternalResearchTaskStatus (db.models)
 *
 * Allowed forward transitions:
 *   created → exported → waiting_external → result_uploaded
 *     → synthesizing → review_pending → complete
 *   created → cancelled
 *   waiting_external → cancelled
 */
export type ExternalResearchTaskStatus =
  | "created"
  | "exported"
  | "waiting_external"
  | "result_uploaded"
  | "synthesizing"
  | "review_pending"
  | "complete"
  | "cancelled";

// ---------------------------------------------------------------------------
// POST /api/workflows/external-research — request body
// Mirrors: ExternalResearchParams (templates.py)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/workflows/external-research.
 *
 * `topic` and `research_question` are required (min_length=1).
 * All other fields have backend defaults and are optional here.
 */
export interface CreateExternalResearchBody {
  /** Short, human-readable research topic. Required; must be non-empty. */
  topic: string;
  /** The primary question the research run is intended to answer. Required; must be non-empty. */
  research_question: string;
  /** Zero or more project slug strings to associate with a workspace project. */
  project?: string[];
  /** Domain-hint strings used by the routing analyser to score venue suitability. */
  domain?: string[];
  /** ULIDs of corpus artifacts to include in the research package. */
  selected_artifact_ids?: string[];
  /** Explicit venue override; "auto" lets the routing analyser choose. Default: "auto". */
  route_preference?: RoutePreference;
  /** Target artifact type that should be produced after the research run completes. Default: "briefing". */
  desired_output?: DesiredOutput;
  /** Free-form freshness signal for the venue (e.g. "current", "last 6 months"). Default: "current". */
  freshness_window?: string;
  /** Controls how the generated prompt instructs the venue to handle citations. Default: "advisory". */
  citation_strictness?: CitationStrictness;
  /**
   * When true (default), the portal creates a context_pack artifact in the vault
   * and links it to the research run and corpus artifacts.
   * A non-empty corpus is also required; empty corpus → package_artifact_id: null.
   */
  save_prompt_package?: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/workflows/external-research — response (201 Created)
// Mirrors: CreateRunResponse (external_research.py)
// ---------------------------------------------------------------------------

/**
 * Response from POST /api/workflows/external-research (HTTP 201).
 *
 * status is always "created" on initial creation (ExternalResearchTaskStatus.CREATED).
 * package_artifact_id is null when save_prompt_package=false or corpus is empty.
 */
export interface CreateRunResponse {
  /** ULID of the created workflow_runs row. */
  run_id: string;
  /** ULID of the created external_research_tasks row (prefixed "ert_"). */
  task_id: string;
  /** ULID of the created context_pack package artifact, or null. */
  package_artifact_id: string | null;
  /** Initial task status — always "created". */
  status: ExternalResearchTaskStatus;
}

// ---------------------------------------------------------------------------
// GET /api/workflows?template_id=external_research_v1
// Uses existing ServiceModeEnvelope<WorkflowRun> from artifact.ts.
// The WorkflowRun interface already covers all fields returned.
// No new types needed for this endpoint — import WorkflowRun from artifact.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PATCH /api/workflows/{id}/external-research/task — request body
// Mirrors: PatchTaskStatusRequest (workflows.py)
// ---------------------------------------------------------------------------

/**
 * Request body for PATCH /api/workflows/{run_id}/external-research/task.
 *
 * status must be a valid ExternalResearchTaskStatus and an allowed transition
 * from the current status; otherwise 422 is returned.
 * Repeated PATCH with the same target status is idempotent (no-op).
 */
export interface PatchTaskStatusBody {
  /** Target task status. Must be an allowed transition from the current status. */
  status: ExternalResearchTaskStatus;
  /** Optional operator notes to persist with the transition. */
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// PATCH /api/workflows/{id}/external-research/task — response (200 OK)
// Mirrors: ExternalResearchTaskRow (external_research.py)
// ---------------------------------------------------------------------------

/**
 * Serialised view of an external_research_tasks DB row.
 * Returned after a successful state transition or idempotent no-op.
 *
 * All timestamp fields are ISO-8601 strings when set.
 */
export interface ExternalResearchTaskRow {
  /** "ert_" ULID primary key. */
  task_id: string;
  /** FK to workflow_runs.id. */
  run_id: string;
  /** Current task status string. */
  status: ExternalResearchTaskStatus;
  /** Optional operator notes attached to the last transition. */
  notes: string | null;
  /** ISO-8601 timestamp of first export, or null. */
  exported_at: string | null;
  /** ISO-8601 timestamp when external work began, or null. */
  started_at: string | null;
  /** ISO-8601 timestamp when the task reached a terminal state, or null. */
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/workflows/{id}/external-research/result — request body
// Mirrors: UploadResultRequest (external_research.py)
// ---------------------------------------------------------------------------

/**
 * JSON body for POST /api/workflows/{run_id}/external-research/result.
 *
 * Alternatively, the route accepts a multipart/form-data upload (file=).
 * When sending JSON, supply content, content_type, and optionally filename.
 */
export interface UploadResultJsonBody {
  /** Raw result text (markdown, plain text, or stringified JSON export). Required; non-empty. */
  content: string;
  /** MIME type hint. Default: "text/plain". */
  content_type?: string;
  /** Original filename, if the content originated from a file. */
  filename?: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/workflows/{id}/external-research/result — response (200 OK)
// Mirrors: UploadResultResponse + ValidationReport (external_research.py)
// ---------------------------------------------------------------------------

/**
 * Advisory citation/source validation report included in upload response.
 * Mirrors: ValidationReport (external_research.py)
 *
 * Non-empty warnings do NOT block the upload unless citation_strictness=strict.
 */
export interface ValidationReport {
  /**
   * "advisory_pass" when warnings are present but non-blocking;
   * "strict_fail" when citation_strictness=strict and no citations detected.
   */
  status: "advisory_pass" | "strict_fail";
  /** Zero or more human-readable warning strings. */
  warnings: string[];
}

/**
 * Response from POST /api/workflows/{run_id}/external-research/result (HTTP 200).
 * Mirrors: UploadResultResponse (external_research.py)
 *
 * next_stage values:
 *   "synthesizing" — normal path; task transitions to result_uploaded
 *   "complete"     — internal_synthesis handoff path; external_research_v1 run completes immediately
 *
 * warning is present when a duplicate upload was detected (existing_artifact_id also set).
 */
export interface UploadResultResponse {
  /** ULID of the created raw_import / external_research_result artifact. */
  result_artifact_id: string;
  /** Advisory validation report. */
  validation: ValidationReport;
  /** Suggested next stage slug. */
  next_stage: "synthesizing" | "complete";
  /** Optional duplicate-upload warning message. */
  warning?: string | null;
  /** The already-existing result artifact ID; present when warning is set. */
  existing_artifact_id?: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/workflows/{id} — response envelope
// Mirrors: WorkflowRunEnvelope → SingletonEnvelope<WorkflowRunDetailDTO>
// The full WorkflowRunDetail shape (including events, stage_durations) is
// defined in workflow-viewer.ts and artifact.ts. No new types are needed
// for the envelope itself — import SingleEnvelope from artifact.ts.
// ---------------------------------------------------------------------------

/**
 * Per-stage timing computed from stage_started / stage_completed event pairs.
 * Mirrors: StageDuration (workflow_query.py)
 *
 * All timestamps are ISO-8601 strings when present.
 */
export interface StageDuration {
  /** UTC timestamp of the stage_started event, or null if not recorded. */
  started_at: string | null;
  /** UTC timestamp of the stage_completed or stage_degraded event, or null. */
  completed_at: string | null;
  /** Elapsed milliseconds between start and completion, or null if either timestamp is absent. */
  duration_ms: number | null;
}

/**
 * Minimal artifact reference used in workflow run detail responses.
 * Mirrors: ArtifactRefDTO (workflow_query.py)
 */
export interface ArtifactRefDTO {
  artifact_id: string;
  title: string;
}

/**
 * Enriched single workflow run detail.
 * Mirrors: WorkflowRunDetailDTO (workflow_query.py)
 *
 * Returned inside SingleEnvelope<WorkflowRunDetail> from GET /api/workflows/{id}.
 * Extends the flat WorkflowRun shape with inline events, resolved artifact refs,
 * and per-stage timing.
 */
export interface WorkflowRunDetail {
  /** ULID primary key. */
  run_id: string;
  /** Template slug (e.g. "external_research_v1"). */
  template_id: string;
  /** Current run status string. */
  status: string;
  /** ISO-8601 creation timestamp. */
  created_at: string;
  /** ISO-8601 completion timestamp, or null. */
  completed_at: string | null;
  /** Linked artifact ID, or null. */
  artifact_id: string | null;
  /** All workflow_events for this run ordered by created_at ASC. */
  events: import("@/types/workflow-viewer").WorkflowEvent[];
  /** Resolved artifact refs for inputs to this run. */
  source_artifacts: ArtifactRefDTO[];
  /** Resolved artifact refs for artifacts produced by this run. */
  created_artifacts: ArtifactRefDTO[];
  /** Per-stage timing keyed by stage name. */
  stage_durations: Record<string, StageDuration>;
}

// ---------------------------------------------------------------------------
// Routing analysis types (POST /api/workflows/external-research/routing-analysis)
// Mirrors: RoutingAnalysisRequest + RouteCard + RoutingAnalysisResponse
// ---------------------------------------------------------------------------

/**
 * Input for POST /api/workflows/external-research/routing-analysis.
 * Mirrors: RoutingAnalysisRequest (external_research.py)
 */
export interface RoutingAnalysisRequest {
  /** Research topic string. Required; must be non-empty. */
  topic: string;
  /** Primary question the research run should answer. Required; must be non-empty. */
  research_question: string;
  /** ULIDs of corpus artifacts to factor into venue scoring. */
  corpus_artifact_ids?: string[];
  /** Explicit venue override; "auto" triggers scoring. Default: "auto". */
  route_preference?: RoutePreference;
  /** Arbitrary key/value constraint hints (e.g. freshness_window). */
  constraints?: Record<string, unknown>;
}

/**
 * Single venue route card returned by the routing analysis.
 * Mirrors: RouteCard (external_research.py)
 */
export interface RouteCard {
  /** Venue identifier slug (e.g. "chatgpt", "perplexity", "internal_synthesis"). */
  route: RoutePreference;
  /** Suitability score in [0.0, 1.0]. */
  score: number;
  /** Human-readable explanation for this venue's score. */
  rationale: string;
  /** Short preview of the generated prompt for this venue. */
  prompt_preview: string;
  /** Description of the expected output format / artifact type. */
  expected_output: string;
}

/**
 * Response from POST /api/workflows/external-research/routing-analysis.
 * Mirrors: RoutingAnalysisResponse (external_research.py)
 *
 * route_cards are ordered by descending score.
 * Always contains at least one card (internal_synthesis minimum when corpus is empty).
 */
export interface RoutingAnalysisResponse {
  route_cards: RouteCard[];
}

// ---------------------------------------------------------------------------
// Prompt package types (GET /api/workflows/{id}/external-research/prompt-package)
// Mirrors: PromptPackageResponse (external_research.py)
// ---------------------------------------------------------------------------

/**
 * Response from GET /api/workflows/{run_id}/external-research/prompt-package.
 * Mirrors: PromptPackageResponse (external_research.py)
 *
 * content is a JSON-encoded string when format=json, or formatted markdown
 * when format=markdown. exported_at is set after the first call.
 */
export interface PromptPackageResponse {
  /** ULID of the parent workflow run. */
  run_id: string;
  /** Requested format: "json" or "markdown". */
  format: "json" | "markdown";
  /** Prompt bundle content as a string. */
  content: string;
  /** ULID of the vault package artifact, or null if the vault write failed at create-run time. */
  package_artifact_id: string | null;
  /** ISO-8601 timestamp set after the first export. Null if never exported. */
  exported_at: string | null;
}
