"use client";

/**
 * useCreateHandoff — TanStack Query mutation for POST /api/artifacts/:id/handoff-to.
 *
 * On success, invalidates the ["artifacts", id, "handoffs"] query so any
 * HandoffsPanel mounted for this artifact refreshes automatically.
 *
 * Error handling: ApiError with status 400 + error.code === "target_not_found"
 * is mapped to the human-readable string "Target artifact not found". All
 * other errors surface their raw message.
 *
 * Bundle E / P4-03.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createHandoff } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type { CreateHandoffBody, HandoffEdgeCreated } from "@/lib/api/artifacts";

export interface UseCreateHandoffResult {
  mutate: (body: CreateHandoffBody) => void;
  mutateAsync: (body: CreateHandoffBody) => Promise<HandoffEdgeCreated>;
  isPending: boolean;
  /**
   * Human-readable error string, or null when idle / successful.
   * "target_not_found" 400 errors are mapped to "Target artifact not found".
   */
  error: string | null;
  reset: () => void;
}

export function useCreateHandoff(artifactId: string): UseCreateHandoffResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: CreateHandoffBody) => createHandoff(artifactId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["artifacts", artifactId, "handoffs"],
      });
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    if (
      mutation.error instanceof ApiError &&
      mutation.error.status === 400 &&
      (mutation.error.body as { error?: { code?: string } } | null)?.error?.code ===
        "target_not_found"
    ) {
      errorMessage = "Target artifact not found";
    } else if (mutation.error instanceof Error) {
      errorMessage = mutation.error.message;
    } else {
      errorMessage = String(mutation.error);
    }
  }

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: errorMessage,
    reset: mutation.reset,
  };
}
