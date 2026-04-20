/**
 * Artifact domain types — aligned with backend portal.api.schemas DTOs.
 *
 * ArtifactCard maps to schemas.ArtifactCard (GET /api/artifacts list items).
 * ArtifactDetail maps to schemas.ArtifactDetail (GET /api/artifacts/:id).
 * WorkflowRun maps to db.models.WorkflowRun fields surfaced in SSE/status.
 *
 * All optional fields default to null/undefined to match backend behaviour
 * (backend excludes null fields from serialisation per design spec §6.1).
 *
 * Stitch reference: §3.1 global component contracts, §3.3 frontmatter contract.
 */

// ---------------------------------------------------------------------------
// Lens Badge types (read-only in v1 — design spec §6.1)
// ---------------------------------------------------------------------------

export type LensFidelity = "high" | "medium" | "low";
export type LensFreshness = "current" | "stale" | "outdated";
export type LensVerificationState = "verified" | "disputed" | "unverified";

// ---------------------------------------------------------------------------
// Lens write-path types (Portal v1.5 — P1.5-1-04)
// ---------------------------------------------------------------------------

/** Verification status enum as accepted by PATCH /api/artifacts/:id/lens */
export type LensVerificationStatus = "unverified" | "partial" | "verified";

/** Fidelity enum as accepted by PATCH /api/artifacts/:id/lens */
export type LensFidelityLevel = "speculative" | "contested" | "established";

/**
 * Per-dimension rationale entry from lens_rationale_jsonb.
 * Shape: { rationale?: string, updated_at?: string, updated_by?: string }
 */
export interface LensRationaleEntry {
  rationale?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

/** Full rationale map — keys are dimension names */
export type LensRationaleMap = Record<string, LensRationaleEntry>;

/**
 * Request body for PATCH /api/artifacts/:id/lens.
 * All fields are optional; omitted fields are left unchanged.
 * Numeric dimensions: 0–10. Mirrors backend LensPatchRequest.
 */
export interface LensPatchRequest {
  novelty?: number | null;
  clarity?: number | null;
  significance?: number | null;
  originality?: number | null;
  rigor?: number | null;
  utility?: number | null;
  verification_status?: LensVerificationStatus | null;
  fidelity?: LensFidelityLevel | null;
  rationale?: LensRationaleMap | null;
}

/**
 * Response DTO for PATCH /api/artifacts/:id/lens.
 * Mirrors backend ArtifactMetadataResponse.
 * Returned inside ServiceModeEnvelope<ArtifactMetadataResponse>.
 */
export interface ArtifactMetadataResponse {
  artifact_id: string;
  fidelity_level?: string | null;
  freshness_class?: string | null;
  verification_status?: string | null;
  novelty?: number | null;
  clarity?: number | null;
  significance?: number | null;
  originality?: number | null;
  rigor?: number | null;
  utility?: number | null;
  lens_rationale_jsonb: LensRationaleMap;
}

export interface ArtifactMetadataCard {
  /** lens_fidelity from ArtifactMetadata row */
  fidelity?: LensFidelity | null;
  /** freshness_class from ArtifactMetadata row */
  freshness?: LensFreshness | null;
  /** verification_status from ArtifactMetadata row */
  verification_state?: LensVerificationState | null;
  /**
   * reusability_tier from ArtifactMetadata row — addendum v1.1.0 field.
   * Free-form string; rendered only in the LensBadgeSet detail variant.
   * Not surfaced in the current backend API schemas (portal v1); kept optional.
   */
  reusability_tier?: string | null;
  /**
   * sensitivity_profile from ArtifactMetadata row — addendum v1.1.0 field.
   * Free-form string; rendered only in the LensBadgeSet detail variant.
   * Not surfaced in the current backend API schemas (portal v1); kept optional.
   */
  sensitivity_profile?: string | null;
}

// ---------------------------------------------------------------------------
// Artifact status / workspace
// ---------------------------------------------------------------------------

export type ArtifactStatus = "draft" | "active" | "archived" | "stale";
export type ArtifactWorkspace =
  | "inbox"
  | "library"
  | "research"
  | "blog"
  | "projects";

// ---------------------------------------------------------------------------
// ArtifactCard — list-view projection (GET /api/artifacts)
// ---------------------------------------------------------------------------

export interface ArtifactCard {
  id: string;
  workspace: ArtifactWorkspace;
  type: string; // artifact_type — raw_note | concept | entity | topic | synthesis | …
  subtype?: string | null;
  title: string;
  status: ArtifactStatus;
  schema_version?: string | null;
  /** ISO 8601 string from timestamptz */
  created?: string | null;
  /** ISO 8601 string from timestamptz */
  updated?: string | null;
  file_path: string;
  metadata?: ArtifactMetadataCard | null;
  /** Brief excerpt for card preview — backend may include via summary field */
  preview?: string | null;
  /** Active workflow run for this artifact, if any */
  workflow_status?: WorkflowRunStatus | null;
}

// ---------------------------------------------------------------------------
// ArtifactDetail — single-artifact view (GET /api/artifacts/:id)
// ---------------------------------------------------------------------------

export interface ArtifactDetail extends ArtifactCard {
  summary?: string | null;
  slug?: string | null;
  content_hash?: string | null;
  /** Full frontmatter snapshot (JSON) */
  frontmatter_jsonb?: Record<string, unknown> | null;
  /**
   * Raw source content (markdown/text from vault file).
   * Present when backend exposes raw_content on the detail endpoint.
   * May be null if not yet populated by reconciler.
   */
  raw_content?: string | null;
  /**
   * Compiled wiki HTML or markdown output.
   * Present when backend exposes compiled_content on the detail endpoint.
   * May be null if the artifact has not been compiled yet.
   */
  compiled_content?: string | null;
  /**
   * Draft / synthesis content (synthesis artifacts, draft stage).
   * May be null for most artifact types.
   */
  draft_content?: string | null;
  /**
   * Directed edges from this artifact to related artifacts.
   * Present when backend includes artifact_edges in the detail response.
   */
  artifact_edges?: ArtifactEdge[] | null;
}

// ---------------------------------------------------------------------------
// Workflow run types (design spec §4 workflow_runs table)
// ---------------------------------------------------------------------------

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "complete"
  | "failed"
  | "abandoned";

export type WorkflowTemplateId =
  | "source_ingest_v1"
  | "research_synthesis_v1"
  | "lint_scope_v1"
  | "compile_v1";

export interface WorkflowRun {
  id: string; // wf-{slug}-{YYYYMMDD}-{seq}
  template_id: WorkflowTemplateId;
  workspace: ArtifactWorkspace;
  status: WorkflowRunStatus;
  current_stage?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  initiator: "portal" | "cli" | "reconciler";
}

// ---------------------------------------------------------------------------
// Handoff chain edge types (artifact_edges, design spec §4)
// ---------------------------------------------------------------------------

export type ArtifactEdgeType =
  | "derived_from"
  | "supports"
  | "relates_to"
  | "supersedes"
  | "contradicts"
  | "contains"
  | "generated_by"
  | "handoff_from"
  | "handoff_to";

export interface ArtifactEdge {
  from_artifact_id: string;
  to_artifact_id: string;
  edge_type: ArtifactEdgeType;
  confidence?: number | null;
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// API envelope types (design spec §5)
// ---------------------------------------------------------------------------

export interface ServiceModeEnvelope<T> {
  data: T[];
  cursor?: string | null;
  etag?: string | null;
}

export interface SingleEnvelope<T> {
  data: T;
  etag?: string | null;
}
