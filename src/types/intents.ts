/**
 * Intent artifact DTOs — aligned with the backend intents API contract.
 *
 * IntentDTO mirrors GET /api/intents and GET /api/intents/{art_id} responses.
 * IntentFrontmatter provides typed access to the known intent frontmatter keys
 * carried in IntentDTO.frontmatter.
 *
 * Backend: src/meatywiki/portal/api/intents.py
 */

// ---------------------------------------------------------------------------
// Layer enum
// ---------------------------------------------------------------------------

export type IntentLayer =
  | "root"
  | "domain"
  | "project"
  | "feature"
  | "cycle"
  | "daily"
  | "session";

// ---------------------------------------------------------------------------
// Intent status enums
// ---------------------------------------------------------------------------

/** Lifecycle status of the intent itself (stored in frontmatter). */
export type IntentStatus = "draft" | "active" | "paused" | "retired";

/** Versioning status — whether this version is current or has been replaced. */
export type IntentVersionStatus = "active" | "superseded";

// ---------------------------------------------------------------------------
// IntentFrontmatter — typed view of IntentDTO.frontmatter
// ---------------------------------------------------------------------------

/**
 * Known intent frontmatter fields carried in IntentDTO.frontmatter.
 *
 * All fields are optional: frontmatter is typed as Record<string, unknown>
 * on the DTO; this interface enables safe narrowing for known keys.
 *
 * Cast usage:
 *   const fm = dto.frontmatter as IntentFrontmatter;
 */
export interface IntentFrontmatter {
  /** Stable semantic identifier (e.g. "intent_billing-engine"). */
  intent_id?: string | null;
  /** Semver string for this intent version (e.g. "1.0.0"). */
  intent_version?: string | null;
  /** Hierarchy layer for this intent. */
  layer?: IntentLayer | null;
  /** Artifact ID of the parent intent. */
  parent_id?: string | null;
  /** Artifact ID of the root intent in this lineage. */
  root_id?: string | null;
  /** Artifact ID(s) this intent supersedes (previous version(s)). */
  supersedes?: string | string[] | null;
  /** Artifact ID that supersedes this intent (set when retired/replaced). */
  superseded_by?: string | null;
  /** Lifecycle status of this intent. */
  intent_status?: IntentStatus | null;
  /** Versioning status — whether this version is current or superseded. */
  status?: IntentVersionStatus | null;
  /** Optional reference to a related project artifact. */
  project_ref?: string | null;
  /** Owner or responsible party (user/team identifier). */
  owner?: string | null;
  /** Scope description for this intent. */
  scope?: string | null;
  /** Planning horizon (e.g. "Q3-2026", "2026", "weekly"). */
  horizon?: string | null;
  /** Freeform tags for categorisation. */
  tags?: string[] | null;
}

// ---------------------------------------------------------------------------
// IntentDTO — primary API response shape
// ---------------------------------------------------------------------------

/**
 * Data transfer object returned by:
 *   GET /api/intents               (inside ServiceModeEnvelope<IntentDTO>)
 *   GET /api/intents/{art_id}      (direct)
 *   GET /api/intents/{art_id}/versions  (inside ServiceModeEnvelope<IntentDTO>)
 */
export interface IntentDTO {
  /** Artifact identifier — intent_<ULID> or art_<ULID>. */
  id: string;
  title: string;
  artifact_type: string;
  subtype: string | null;
  /** Artifact lifecycle status (active | superseded). */
  status: string;
  workspace: string;
  file_path: string;
  /** ISO 8601 timestamp. */
  created_at: string;
  /** ISO 8601 timestamp. */
  updated_at: string;
  /** Full frontmatter snapshot. Cast to IntentFrontmatter for typed access. */
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API parameter interfaces
// ---------------------------------------------------------------------------

export interface ListIntentVersionsParams {
  limit?: number;
  cursor?: string | null;
}

export interface ListIntentsParams {
  limit?: number;
  cursor?: string | null;
}

// ---------------------------------------------------------------------------
// Request body interfaces
// ---------------------------------------------------------------------------

/**
 * Body for POST /api/intents.
 * Required: layer, title.
 */
export interface CreateIntentBody {
  layer: IntentLayer;
  title: string;
  body?: string | null;
  intent_id?: string | null;
  project?: string[];
  project_ref?: string | null;
  parent_id?: string | null;
  root_id?: string | null;
  owner?: string | null;
  scope?: string | null;
  horizon?: string | null;
  tags?: string[];
  intent_status?: IntentStatus;
}

/**
 * Body for POST /api/intents/{art_id}/revise.
 * All fields are optional; omitted fields are left unchanged.
 */
export interface ReviseIntentBody {
  title?: string;
  body?: string | null;
  scope?: string | null;
  horizon?: string | null;
  intent_status?: IntentStatus;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Mutation response
// ---------------------------------------------------------------------------

export interface IntentMutationResponse {
  artifact_id: string;
  message: string;
}
