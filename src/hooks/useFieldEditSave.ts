"use client";

/**
 * useFieldEditSave — thin adapter hook for the P2-03 option-driven field editors.
 *
 * Wraps the existing useArtifactFieldSave hook so the new field components
 * (ProjectComboboxField, TagEditorField, OptionSelectField) receive a stable,
 * predictable save interface without being coupled to the detail-screen's
 * toast infrastructure.
 *
 * Design decisions
 * ----------------
 * 1. **ETag threading**: delegates entirely to useArtifactFieldSave, which
 *    fetches the ETag on mount and forwards If-Match on every PATCH call.
 *    The new field components never touch the ETag directly — they call
 *    `save(field, value)` and react to Promise resolution.
 *
 * 2. **Toast ownership**: the parent surface (ArtifactDetailClient or any
 *    future caller) owns toast rendering. Callers pass a `showToast` callback
 *    with the same `(kind, text) => void` signature used in ArtifactDetailClient.
 *
 * 3. **Field type narrowing**: exposes two helper callbacks derived from the
 *    generic `handleFieldSave`:
 *    - `saveScalar(field, value)` — for single-value fields (project, status, …)
 *    - `saveTags(add, remove)` — assembles the `{ tags_add, tags_remove }` diff
 *      object expected by useArtifactFieldSave's "tags_add" special-case branch.
 *
 * Usage (inside ArtifactDetailClient or a dedicated wrapper):
 *
 *   const { saveScalar, saveTags } = useFieldEditSave({ artifactId, showToast });
 *
 *   // ProjectComboboxField
 *   <ProjectComboboxField
 *     artifactId={artifact.id}
 *     currentProjectId={artifact.project ?? null}
 *     onSave={(projectId) => saveScalar("project", projectId)}
 *   />
 *
 *   // TagEditorField
 *   <TagEditorField
 *     artifactId={artifact.id}
 *     currentTags={artifact.tags ?? []}
 *     onSave={(add, remove) => saveTags(add, remove)}
 *   />
 *
 *   // OptionSelectField
 *   <OptionSelectField
 *     field="status"
 *     value={artifact.status}
 *     onSave={(v) => saveScalar("status", v)}
 *   />
 *
 * Portal v2.6 Phase 2 (P2-03 option-driven field editors).
 */

import { useCallback } from "react";
import {
  useArtifactFieldSave,
  type UseArtifactFieldSaveParams,
  type UseArtifactFieldSaveResult,
} from "@/app/(main)/artifact/[id]/useArtifactFieldSave";
import type { ArtifactPatchFields } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { ToastKind } from "@/app/(main)/artifact/[id]/useArtifactFieldSave";

export type UseFieldEditSaveParams = UseArtifactFieldSaveParams;

/**
 * Return type extending the base result with typed convenience helpers.
 */
export interface UseFieldEditSaveResult extends UseArtifactFieldSaveResult {
  /**
   * Save a single scalar field value.
   *
   * Delegates to handleFieldSave with the correct field key. Re-throws on
   * error so the field component can stay in edit mode.
   */
  saveScalar: (
    field: Exclude<keyof ArtifactPatchFields, "tags_add" | "tags_remove">,
    value: string | null,
  ) => Promise<void>;

  /**
   * Save a tag diff using the backend's add/remove semantics.
   *
   * Assembles `{ tags_add, tags_remove }` and forwards to handleFieldSave
   * via the "tags_add" special-case branch.
   *
   * Re-throws on error so TagEditorField can revert optimistic state.
   */
  saveTags: (tagsAdd: string[], tagsRemove: string[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFieldEditSave(
  params: UseFieldEditSaveParams,
): UseFieldEditSaveResult {
  const base = useArtifactFieldSave(params);

  const saveScalar = useCallback(
    async (
      field: Exclude<keyof ArtifactPatchFields, "tags_add" | "tags_remove">,
      value: string | null,
    ): Promise<void> => {
      await base.handleFieldSave(field, value);
    },
    [base],
  );

  const saveTags = useCallback(
    async (tagsAdd: string[], tagsRemove: string[]): Promise<void> => {
      await base.handleFieldSave("tags_add", {
        tags_add: tagsAdd,
        tags_remove: tagsRemove,
      });
    },
    [base],
  );

  return {
    ...base,
    saveScalar,
    saveTags,
  };
}
