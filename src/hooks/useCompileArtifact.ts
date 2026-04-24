"use client";

/**
 * useCompileArtifact — hook for triggering artifact compilation.
 *
 * Calls POST /api/artifacts/:id/compile and surfaces loading/error state.
 *
 * FE-03 scope:
 *   - compile() fires a single POST; sets isCompiling during the flight
 *   - 202 Accepted → calls onSuccess(), clears error
 *   - 404 / 409 / other error → extracts message, calls onError(msg)
 *   - isCompiling is reset to false in all terminal branches
 *
 * FE-04 note: the hook intentionally does NOT wire SSE progress tracking —
 * that upgrade (bind runId from 202 body to useSSE) is deferred to FE-04
 * where the inbox list also needs compile triggering. SSE pattern mirrors
 * quick-add-modal.tsx.
 *
 * Usage:
 *   const { compile, isCompiling, error } = useCompileArtifact({
 *     artifactId: artifact.id,
 *     onSuccess: () => refetch(),
 *   });
 */

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCompileArtifactOptions {
  artifactId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UseCompileArtifactResult {
  compile: () => Promise<void>;
  isCompiling: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helper: extract a human-readable error message from an unknown thrown value
// ---------------------------------------------------------------------------

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // Try to get a message from the response body
    const body = err.body;
    if (body && typeof body === "object") {
      const detail = (body as Record<string, unknown>)["detail"];
      if (typeof detail === "string") return detail;
      const message = (body as Record<string, unknown>)["message"];
      if (typeof message === "string") return message;
    }
    if (err.status === 404) return "Artifact not found.";
    if (err.status === 409) return "A compile job is already running for this artifact.";
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred. Please try again.";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompileArtifact({
  artifactId,
  onSuccess,
  onError,
}: UseCompileArtifactOptions): UseCompileArtifactResult {
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compile = useCallback(async (): Promise<void> => {
    if (!artifactId || isCompiling) return;

    setIsCompiling(true);
    setError(null);

    try {
      await api.post(`/api/artifacts/${artifactId}/compile`, {});
      setIsCompiling(false);
      onSuccess?.();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setIsCompiling(false);
      setError(msg);
      onError?.(msg);
    }
  }, [artifactId, isCompiling, onSuccess, onError]);

  return { compile, isCompiling, error };
}
