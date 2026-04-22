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
// Artifact status / workspace / facet
// ---------------------------------------------------------------------------

export type ArtifactStatus = "draft" | "active" | "archived" | "stale";
export type ArtifactWorkspace =
  | "inbox"
  | "library"
  | "research"
  | "blog"
  | "projects";

/**
 * Portal surface facet values accepted by ?facet= query param.
 *
 * Facet is a query concept, not a stored column (OQ-6 resolution):
 *   library / blog / projects → WHERE workspace = <value>
 *   research                  → WHERE research_origin = true
 *
 * Taxonomy-redesign P4-05 / P5-01.
 */
export type ArtifactFacet = "library" | "research" | "blog" | "projects";

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
  /**
   * Whether this artifact was produced by or flagged for the Portal Research
   * workflow. Maps to artifacts.research_origin (BOOLEAN NOT NULL DEFAULT false)
   * in the Postgres overlay — migration 007_taxonomy_redesign.
   *
   * Used by Lens Badges (P5-06) and Research screen pre-filter (P5-03).
   * Taxonomy-redesign P4-03 / P5-01.
   *
   * NOTE: The backend ArtifactCard DTO in core.py does not yet expose this field
   * (the column exists on the ORM model but from_orm_artifact does not map it).
   * Tracked as mismatch MISMATCH-01 — field will be undefined until backend
   * schema is updated to include it in ArtifactCard serialisation.
   */
  research_origin?: boolean | null;
  /**
   * ID of the research workflow run that produced this artifact, if any.
   * Maps to artifacts.research_workflow_id (TEXT, nullable) in the Postgres overlay.
   *
   * Backend column name is `research_workflow_id`; exposed here as `workflow_id`
   * for conciseness per P5-01 task spec. The backend DTO must alias
   * research_workflow_id → workflow_id when this field is added to ArtifactCard.
   * Tracked as mismatch MISMATCH-02.
   *
   * Null for the vast majority of artifacts (non-research-workflow products).
   * Taxonomy-redesign P4-03 / P5-01.
   */
  workflow_id?: string | null;
  /**
   * Total number of derivatives compiled from this source artifact.
   * Present on rollup responses (view=source_rollup); absent on flat list
   * responses — undefined/null when not in rollup context.
   * Source: RollupArtifactItem (library-source-rollup-v1 FE-01 / FE-03).
   */
  derivative_count?: number | null;
  /**
   * Preview of up to 5 derivative artifacts for quick display.
   * Present on rollup responses (view=source_rollup); absent on flat list
   * responses — undefined/null when not in rollup context.
   * Source: RollupArtifactItem (library-source-rollup-v1 FE-01 / FE-03).
   */
  derivatives_preview?: DerivativePreview[] | null;
  /**
   * Most recent non-terminal workflow run associated with this artifact, if any.
   * Projected by GET /api/artifacts when a pending|running run exists.
   *
   * Used by ArtifactCard to conditionally render StageTrackerCompact per
   * Stage Tracker manifest §2.1–2.2 (DP1-02 #1, DP1-06 #9 gap fill).
   *
   * Null/absent when no active run exists — card renders without tracker.
   * Tracked as MISMATCH-03: backend does not yet project this field; wired
   * ahead of backend change so cards hydrate automatically when it ships.
   */
  active_run?: {
    id: string;
    status: WorkflowRunStatus;
    current_stage?: number | null;
    template_id?: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Source rollup types (library-source-rollup-v1 FE-01)
// ---------------------------------------------------------------------------

/**
 * A single derivative artifact returned by
 * GET /api/artifacts/{source_id}/derivatives.
 *
 * Mirrors the backend DerivativeArtifactItem DTO (library-source-rollup-v1
 * Phase 1 API). Ordered by artifact_type, then updated_at desc.
 *
 * DETAIL-01 (Phase 3).
 */
export interface DerivativeItem {
  id: string;
  artifact_type: string;
  title: string | null;
  updated_at: string | null;
  fidelity?: LensFidelity | null;
  freshness?: LensFreshness | null;
  verification_state?: LensVerificationState | null;
}

/**
 * A brief preview of a derivative artifact, included on RollupArtifactItem.
 * Up to 5 items are returned by the backend per source artifact.
 */
export interface DerivativePreview {
  id: string;
  artifact_type: string;
  title: string | null;
}

/**
 * An ArtifactCard extended with derivative rollup fields.
 *
 * Returned by GET /api/artifacts?workspace=library&view=source_rollup.
 * derivative_count and derivatives_preview are not meaningful (0/[]) when
 * rollup_lens=orphans — the endpoint still includes the fields for shape
 * consistency.
 *
 * Optional/nullable so existing flat-list code paths that cast ArtifactCard
 * objects remain type-safe. Library rollup code paths should prefer
 * RollupArtifactItem directly.
 */
export interface RollupArtifactItem extends ArtifactCard {
  /** Total number of derivatives compiled from this source artifact. */
  derivative_count?: number | null;
  /** Preview of up to 5 derivative artifacts for quick display. */
  derivatives_preview?: DerivativePreview[] | null;
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
