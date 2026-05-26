"use client";

/**
 * useProjectDirectories — React hook for managing project directory records.
 *
 * Fetches GET /api/project-directories/ on mount and exposes typed mutators
 * (create, update, delete) that optimistically update the local list and
 * surface errors for the caller.
 *
 * Patterns followed:
 *   - Uses the project's `api` typed fetch wrapper from @/lib/api/client
 *   - useState + useEffect for data fetching (consistent with SettingsConfigClient)
 *   - No TanStack Query dependency — keeps the hook consistent with the
 *     simpler settings-page pattern
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-01.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listProjectDirs,
  createProjectDir,
  updateProjectDir,
  deleteProjectDir,
} from "@/lib/api/project-directories";
import type {
  ProjectDirRead,
  ProjectDirCreateRequest,
  ProjectDirUpdateRequest,
} from "@/lib/api/project-directories";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseProjectDirectoriesResult {
  /** Ordered list of registered project directories. */
  dirs: ProjectDirRead[];
  /** True while the initial list fetch is in flight. */
  isLoading: boolean;
  /** Non-null when the list fetch (or most recent mutation) failed. */
  error: string | null;
  /** Reload the list from the backend. */
  refresh: () => Promise<void>;
  /** Register a new project directory. Throws on API error. */
  create: (body: ProjectDirCreateRequest) => Promise<ProjectDirRead>;
  /** Partially update an existing record. Throws on API error. */
  update: (projectId: string, body: ProjectDirUpdateRequest) => Promise<ProjectDirRead>;
  /** Remove a project directory. Throws on API error. */
  remove: (projectId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Error extraction helper (mirrors settings-config-client pattern)
// ---------------------------------------------------------------------------

function extractMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (
      typeof err.body === "object" &&
      err.body !== null &&
      "detail" in err.body
    ) {
      return String((err.body as { detail: unknown }).detail);
    }
    return `Error ${err.status}`;
  }
  return err instanceof Error ? err.message : "Request failed";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectDirectories(): UseProjectDirectoriesResult {
  const [dirs, setDirs] = useState<ProjectDirRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listProjectDirs();
      setDirs(data);
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (body: ProjectDirCreateRequest): Promise<ProjectDirRead> => {
      const created = await createProjectDir(body);
      setDirs((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const update = useCallback(
    async (
      projectId: string,
      body: ProjectDirUpdateRequest,
    ): Promise<ProjectDirRead> => {
      const updated = await updateProjectDir(projectId, body);
      setDirs((prev) =>
        prev.map((d) => (d.project_id === projectId ? updated : d)),
      );
      return updated;
    },
    [],
  );

  const remove = useCallback(async (projectId: string): Promise<void> => {
    await deleteProjectDir(projectId);
    setDirs((prev) => prev.filter((d) => d.project_id !== projectId));
  }, []);

  return { dirs, isLoading, error, refresh, create, update, remove };
}
