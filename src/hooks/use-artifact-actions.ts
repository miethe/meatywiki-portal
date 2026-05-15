"use client";

/**
 * use-artifact-actions — React Query mutation hooks for artifact-level actions.
 *
 * Provides useArchiveArtifact and useDeleteArtifact, each of which invalidates
 * the shared ["artifacts"] and ["library"] query keys on success so all
 * dependent views (Library, Inbox, Detail) update automatically.
 *
 * Used by:
 *   - Library page (meatballs menu on ArtifactCard)
 *   - ArtifactDetailClient (rail actions: "Promote to Archive", "Delete")
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveArtifact,
  deleteArtifact,
  linkArtifact,
  requestReview,
} from "@/lib/api/artifacts";
import type { LinkArtifactRequest, RequestReviewRequest } from "@/lib/api/artifacts";

export function useArchiveArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveArtifact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useDeleteArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArtifact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

/**
 * Mutation hook for POST /api/artifacts/{id}/link.
 *
 * Creates a directed edge from the given artifact to a target artifact.
 * Invalidates ["artifact", id] so the detail screen's backlinks/graph
 * panels reflect the new edge.
 *
 * audit-wave-2 P2-02/03.
 */
export function useLinkArtifact(artifactId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LinkArtifactRequest) => linkArtifact(artifactId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artifact", artifactId] });
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
    },
  });
}

/**
 * Mutation hook for POST /api/artifacts/{id}/review.
 *
 * Adds the artifact to the portal review queue.
 * No cache invalidation needed — review items are portal-only bookkeeping
 * and don't affect the artifact card or detail response.
 *
 * audit-wave-2 P2-04.
 */
export function useRequestReview(artifactId: string) {
  return useMutation({
    mutationFn: (body: RequestReviewRequest) => requestReview(artifactId, body),
  });
}
