"use client";

/**
 * useCreateWorkflow — TanStack Query mutation for POST /api/workflows.
 *
 * On success, invalidates the "workflow-runs" query so the Status Surface
 * refreshes to show the new run.
 *
 * Traces FR-1.5-06 / P1.5-2-03.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkflow } from "@/lib/api/workflow-templates";
import type { CreateWorkflowRequest, CreateWorkflowResponse } from "@/lib/api/workflow-templates";

export interface UseCreateWorkflowResult {
  mutate: (req: CreateWorkflowRequest) => void;
  mutateAsync: (req: CreateWorkflowRequest) => Promise<CreateWorkflowResponse>;
  isPending: boolean;
  error: string | null;
  reset: () => void;
}

export function useCreateWorkflow(): UseCreateWorkflowResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => {
      // Invalidate workflow runs so the Status Surface refreshes.
      void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? mutation.error instanceof Error
        ? mutation.error.message
        : String(mutation.error)
      : null,
    reset: mutation.reset,
  };
}
