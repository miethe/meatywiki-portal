/**
 * Field-options API — typed wrappers for the six GET /api/field-options/* routes.
 *
 * These endpoints back typeahead and multi-select pickers in the Portal v2.6
 * Relational UX surfaces (inline editing, merge dialogs, edge management).
 *
 * Routes:
 *   GET /api/field-options/projects       → ProjectOption[]
 *   GET /api/field-options/tags           → TagOption[]
 *   GET /api/field-options/artifact-types → string[]
 *   GET /api/field-options/statuses       → string[]
 *   GET /api/field-options/workspaces     → string[]
 *   GET /api/field-options/edge-types     → string[]
 *
 * Used by: useFieldOptions hooks (src/hooks/useFieldOptions.ts).
 *
 * Portal v2.6 Phase 2 (P2-04 data layer).
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/**
 * A project option entry returned by GET /api/field-options/projects.
 *
 * ``artifact_count`` is the number of artifacts currently linked to this
 * project; used to surface helpful context in project pickers.
 */
export interface ProjectOption {
  id: string;
  name: string;
  artifact_count: number;
}

/**
 * A tag option entry returned by GET /api/field-options/tags.
 *
 * ``count`` is the number of artifacts carrying this tag in the overlay;
 * used to sort/rank tags by relevance in tag pickers.
 */
export interface TagOption {
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

/**
 * Fetch all available project options for pickers.
 *
 * Backend: GET /api/field-options/projects
 * Response: ProjectOption[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchProjectOptions(): Promise<ProjectOption[]> {
  return apiFetch<ProjectOption[]>("/field-options/projects", { method: "GET" });
}

/**
 * Fetch all tag options with per-tag artifact counts.
 *
 * Backend: GET /api/field-options/tags
 * Response: TagOption[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchTagOptions(): Promise<TagOption[]> {
  return apiFetch<TagOption[]>("/field-options/tags", { method: "GET" });
}

/**
 * Fetch all artifact type enum values.
 *
 * Backend: GET /api/field-options/artifact-types
 * Response: string[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchArtifactTypeOptions(): Promise<string[]> {
  return apiFetch<string[]>("/field-options/artifact-types", { method: "GET" });
}

/**
 * Fetch all artifact status enum values.
 *
 * Backend: GET /api/field-options/statuses
 * Response: string[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchStatusOptions(): Promise<string[]> {
  return apiFetch<string[]>("/field-options/statuses", { method: "GET" });
}

/**
 * Fetch all workspace enum values.
 *
 * Backend: GET /api/field-options/workspaces
 * Response: string[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchWorkspaceOptions(): Promise<string[]> {
  return apiFetch<string[]>("/field-options/workspaces", { method: "GET" });
}

/**
 * Fetch all edge-type enum values.
 *
 * Backend: GET /api/field-options/edge-types
 * Response: string[]
 *
 * Throws ApiError on non-2xx responses.
 */
export async function fetchEdgeTypeOptions(): Promise<string[]> {
  return apiFetch<string[]>("/field-options/edge-types", { method: "GET" });
}
