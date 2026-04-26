/**
 * useArtifactFieldSave — extracted save handler for inline-edit fields on the
 * Artifact Detail screen (P2-07 extraction).
 *
 * Encapsulates the optimistic-update + rollback + toast logic that was
 * previously inlined inside ArtifactDetailClient.handleFieldSave.  Extracting
 * it into its own hook:
 *   1. Makes the behaviour unit-testable with renderHook + a fake QueryClient
 *      without mounting the full ArtifactDetailClient (which imports
 *      @miethe/ui, an ESM package that cannot be parsed by Jest's CJS
 *      transform).
 *   2. Keeps ArtifactDetailClient focused on rendering concerns.
 *
 * Usage:
 *
 *   const { handleFieldSave, etag, setEtag } = useArtifactFieldSave({
 *     artifactId: id,
 *     showToast,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { artifactQueryKey } from "@/hooks/useArtifact";
import {
  patchArtifact,
  fetchArtifactEtag,
  ETagMismatchError,
  ArtifactValidationError,
  type ArtifactPatchFields,
} from "@/lib/api/artifacts";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Toast kind — matches the minimal toast system in ArtifactDetailClient
// ---------------------------------------------------------------------------

export type ToastKind = "success" | "error";

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

export interface UseArtifactFieldSaveParams {
  /** The artifact ID whose fields are being edited. */
  artifactId: string;
  /**
   * Callback invoked after every save attempt (success or failure) so the
   * parent can render a toast notification.
   */
  showToast: (kind: ToastKind, text: string) => void;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseArtifactFieldSaveResult {
  /**
   * Save a single editable field.  Performs an optimistic TanStack Query cache
   * update, calls PATCH /api/artifacts/:id with the current ETag, then either
   * commits the server response or rolls back and shows a toast on error.
   *
   * For the `tags_add` pseudo-field the `value` parameter is a
   * `{ tags_add: string[], tags_remove: string[] }` object (assembled by the
   * caller's diff logic); for all other fields it is the new scalar value.
   *
   * Re-throws the error so the inline-edit component can stay in edit mode.
   */
  handleFieldSave: (
    field: keyof ArtifactPatchFields,
    value: unknown,
  ) => Promise<void>;

  /** Current ETag — readable for testing; writable to seed in tests. */
  etag: string;
  setEtag: (e: string) => void;
}

// ---------------------------------------------------------------------------
// Top-level fields on ArtifactDetail that are patched directly (not via JSONB)
// ---------------------------------------------------------------------------

const TOP_LEVEL_FIELDS: ReadonlySet<keyof ArtifactPatchFields> = new Set<keyof ArtifactPatchFields>([
  "title",
  "status",
  "workspace",
]);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtifactFieldSave({
  artifactId,
  showToast,
}: UseArtifactFieldSaveParams): UseArtifactFieldSaveResult {
  const queryClient = useQueryClient();
  const [etag, setEtag] = useState<string>("");

  // Keep a stable ref to showToast so the callback doesn't re-create when
  // the parent re-renders with a new show() identity (common with useCallback
  // returning a new reference each render).
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  });

  // Fetch the ETag once on mount (fire-and-forget; errors leave etag as "").
  useEffect(() => {
    void fetchArtifactEtag(artifactId).then((e) => {
      if (e) setEtag(e);
    });
  }, [artifactId]);

  const handleFieldSave = useCallback(
    async (field: keyof ArtifactPatchFields, value: unknown): Promise<void> => {
      // Build the patch payload.
      // Tags special case: the value object already contains tags_add and
      // tags_remove keys (assembled by EditableMetadataSection.handleTagsSave).
      let patch: Partial<ArtifactPatchFields>;
      if (field === "tags_add") {
        patch = value as Partial<ArtifactPatchFields>;
      } else {
        patch = { [field]: value } as Partial<ArtifactPatchFields>;
      }

      // Snapshot current cache for rollback.
      const prevData = queryClient.getQueryData<ArtifactDetail>(
        artifactQueryKey(artifactId),
      );

      // Optimistic update — only for non-tag fields (tags have add/remove
      // semantics that need the server response to resolve correctly).
      if (field !== "tags_add") {
        queryClient.setQueryData<ArtifactDetail>(
          artifactQueryKey(artifactId),
          (old) => {
            if (!old) return old;
            const updated: ArtifactDetail = { ...old };

            if (TOP_LEVEL_FIELDS.has(field)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (updated as any)[field] = value;
            } else {
              // Frontmatter-backed field — mirror into frontmatter_jsonb.
              updated.frontmatter_jsonb = {
                ...(old.frontmatter_jsonb ?? {}),
                [field]: value,
              };
            }
            return updated;
          },
        );
      }

      try {
        const { data, etag: newEtag } = await patchArtifact(
          artifactId,
          patch,
          etag,
        );
        setEtag(newEtag);
        // Canonical replacement with server response.
        queryClient.setQueryData<ArtifactDetail>(
          artifactQueryKey(artifactId),
          data,
        );
        showToastRef.current("success", "Saved");
      } catch (err) {
        // Roll back optimistic update.
        if (prevData !== undefined) {
          queryClient.setQueryData<ArtifactDetail>(
            artifactQueryKey(artifactId),
            prevData,
          );
        }

        if (err instanceof ETagMismatchError) {
          showToastRef.current(
            "error",
            "Edited elsewhere — refresh to continue",
          );
        } else if (err instanceof ArtifactValidationError) {
          showToastRef.current("error", `Invalid value: ${err.field}`);
        } else {
          showToastRef.current("error", "Save failed");
        }

        // Re-throw so the inline-edit component stays in edit mode.
        throw err;
      }
    },
    // NOTE: `etag` must be in the dependency array because patchArtifact
    // needs the *current* etag value at call time.
    [artifactId, etag, queryClient],
  );

  return { handleFieldSave, etag, setEtag };
}
