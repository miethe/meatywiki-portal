"use client";

/**
 * useFieldOptions — TanStack Query hooks for the six field-options routes.
 *
 * One hook per field type; all share staleTime=30_000 ms (30 s). The options
 * data changes infrequently (new projects/tags are added by engine reconcile
 * cycles, not by the user in real-time), so 30 s is an appropriate balance
 * between freshness and request frequency.
 *
 * Hooks exposed:
 *   useProjectOptions      — ProjectOption[] from GET /api/field-options/projects
 *   useTagOptions          — TagOption[]     from GET /api/field-options/tags
 *   useArtifactTypeOptions — string[]        from GET /api/field-options/artifact-types
 *   useStatusOptions       — string[]        from GET /api/field-options/statuses
 *   useWorkspaceOptions    — string[]        from GET /api/field-options/workspaces
 *   useEdgeTypeOptions     — string[]        from GET /api/field-options/edge-types
 *
 * Pattern: mirrors useArtifactEdges (src/hooks/useArtifactEdges.ts).
 * Portal v2.6 Phase 2 (P2-04 data layer).
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchProjectOptions,
  fetchTagOptions,
  fetchArtifactTypeOptions,
  fetchStatusOptions,
  fetchWorkspaceOptions,
  fetchEdgeTypeOptions,
  type ProjectOption,
  type TagOption,
} from "@/lib/api/field-options";

// ---------------------------------------------------------------------------
// Shared stale time
// ---------------------------------------------------------------------------

const FIELD_OPTIONS_STALE_TIME = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Stable query-key factories (for external cache invalidation)
// ---------------------------------------------------------------------------

export const fieldOptionsQueryKeys = {
  projects: () => ["field-options", "projects"] as const,
  tags: () => ["field-options", "tags"] as const,
  artifactTypes: () => ["field-options", "artifact-types"] as const,
  statuses: () => ["field-options", "statuses"] as const,
  workspaces: () => ["field-options", "workspaces"] as const,
  edgeTypes: () => ["field-options", "edge-types"] as const,
} as const;

// ---------------------------------------------------------------------------
// Result shape (shared convenience type — mirrors the shape exposed by
// useArtifactEdges so callers can destructure consistently)
// ---------------------------------------------------------------------------

export interface UseFieldOptionsResult<T> {
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: UseQueryResult<T[]>["refetch"];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all project options for project pickers.
 *
 * Returns ProjectOption[] (id, name, artifact_count).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useProjectOptions(): UseFieldOptionsResult<ProjectOption> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.projects(),
    queryFn: fetchProjectOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetch all tag options with per-tag counts.
 *
 * Returns TagOption[] (name, count).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useTagOptions(): UseFieldOptionsResult<TagOption> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.tags(),
    queryFn: fetchTagOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetch all artifact type enum values.
 *
 * Returns string[] of valid artifact type identifiers
 * (e.g. "concept", "entity", "evidence", "synthesis", ...).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useArtifactTypeOptions(): UseFieldOptionsResult<string> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.artifactTypes(),
    queryFn: fetchArtifactTypeOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetch all artifact status enum values.
 *
 * Returns string[] of valid status identifiers
 * (e.g. "draft", "active", "archived", "published", ...).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useStatusOptions(): UseFieldOptionsResult<string> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.statuses(),
    queryFn: fetchStatusOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetch all workspace enum values.
 *
 * Returns string[] of valid workspace identifiers
 * (e.g. "inbox", "library", "blog", "projects", "research", ...).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useWorkspaceOptions(): UseFieldOptionsResult<string> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.workspaces(),
    queryFn: fetchWorkspaceOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Fetch all edge-type enum values.
 *
 * Returns string[] of valid edge type identifiers
 * (e.g. "derived_from", "supports", "relates_to", "supersedes",
 *  "contradicts", "contains", "references", "generated_by", ...).
 * Query is always enabled; data is fresh for 30 s.
 */
export function useEdgeTypeOptions(): UseFieldOptionsResult<string> {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: fieldOptionsQueryKeys.edgeTypes(),
    queryFn: fetchEdgeTypeOptions,
    staleTime: FIELD_OPTIONS_STALE_TIME,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
