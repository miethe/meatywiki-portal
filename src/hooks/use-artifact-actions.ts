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
import { archiveArtifact, deleteArtifact } from "@/lib/api/artifacts";

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
