"use client";

/**
 * useTemplateMutations — TanStack Query mutations for workflow template CRUD.
 *
 * Exposes create, update, and delete mutations.
 * On any mutation success, invalidates the "workflow-templates" query so the
 * list and wizard Step 3 dropdown refresh automatically.
 *
 * Traces FR-1.5-09 / P1.5-2-05.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
} from "@/lib/api/workflow-templates";
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  WorkflowTemplate,
} from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface UseCreateTemplateResult {
  mutateAsync: (req: CreateTemplateRequest) => Promise<WorkflowTemplate>;
  isPending: boolean;
  reset: () => void;
}

export function useCreateTemplate(): UseCreateTemplateResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createWorkflowTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UseUpdateTemplateResult {
  mutateAsync: (args: { id: string; req: UpdateTemplateRequest }) => Promise<WorkflowTemplate>;
  isPending: boolean;
  reset: () => void;
}

export function useUpdateTemplate(): UseUpdateTemplateResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateTemplateRequest }) =>
      updateWorkflowTemplate(id, req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export interface UseDeleteTemplateResult {
  mutateAsync: (id: string) => Promise<void>;
  isPending: boolean;
  reset: () => void;
}

export function useDeleteTemplate(): UseDeleteTemplateResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteWorkflowTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}
