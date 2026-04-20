"use client";

/**
 * useWorkflowTemplates — TanStack Query hook for listing workflow templates.
 *
 * Fetches GET /api/workflow-templates and caches results with a 5-minute
 * stale time (templates are rarely updated).
 *
 * Traces FR-1.5-06 / P1.5-2-03.
 */

import { useQuery } from "@tanstack/react-query";
import { listWorkflowTemplates } from "@/lib/api/workflow-templates";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

export interface UseWorkflowTemplatesResult {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  error: string | null;
}

export function useWorkflowTemplates(): UseWorkflowTemplatesResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: () => listWorkflowTemplates(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    templates: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}
