"use client";

/**
 * ReclassifyModal — dialog for changing an artifact's type.
 *
 * Presents an artifact type selector (Select) and an optional "Re-extract"
 * checkbox. On submit calls POST /api/artifacts/{id}/reclassify and:
 *
 *   Success → close modal + success toast with new type
 *   Error   → inline error message in modal (stays open)
 *   Loading → submit button shows "Reclassifying…", disabled
 *
 * Artifact types (canonical list from taxonomy):
 *   concept, entity, topic, summary, synthesis, evidence, glossary_entry
 *
 * WCAG 2.1 AA:
 *   - role="dialog", aria-modal="true", aria-labelledby on heading.
 *   - Focus trap via dialog.tsx DialogContent.
 *   - Escape closes (DialogPortal effect).
 *   - Error region uses role="alert".
 *
 * Follows the AssessmentModal / RouteModal custom-modal pattern (no direct
 * Radix dep; uses the local dialog.tsx primitive).
 *
 * Audit Wave 3 — P4-FE-006.
 */

import { useState, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { reclassifyArtifact } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Artifact type options
// ---------------------------------------------------------------------------

/** Canonical artifact types accepted by the reclassify endpoint. */
const ARTIFACT_TYPES = [
  { value: "concept", label: "Concept" },
  { value: "entity", label: "Entity" },
  { value: "topic", label: "Topic" },
  { value: "summary", label: "Summary" },
  { value: "synthesis", label: "Synthesis" },
  { value: "evidence", label: "Evidence" },
  { value: "glossary_entry", label: "Glossary Entry" },
] as const;

type ArtifactTypeValue = (typeof ARTIFACT_TYPES)[number]["value"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReclassifyModalProps {
  artifactId: string;
  currentType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional callback fired with the updated ArtifactDetail on success.
   * Parent can use this to refresh its local artifact state.
   */
  onSuccess?: (updated: ArtifactDetail) => void;
}

// ---------------------------------------------------------------------------
// Helper: extract a human-readable error message from an ApiError body
// ---------------------------------------------------------------------------

function extractApiErrorMessage(err: ApiError): string {
  const body = err.body as
    | { error?: { message?: string }; detail?: string | Array<{ msg?: string }> }
    | string
    | null;

  if (typeof body === "object" && body !== null) {
    // { error: { code, message } } — reclassify endpoint shape
    if (body.error?.message) return body.error.message;

    // FastAPI validation detail
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => d?.msg ?? String(d)).join("; ");
    }
  }

  return `API error ${err.status}`;
}

// ---------------------------------------------------------------------------
// ReclassifyModal
// ---------------------------------------------------------------------------

export function ReclassifyModal({
  artifactId,
  currentType,
  open,
  onOpenChange,
  onSuccess,
}: ReclassifyModalProps) {
  const baseId = useId();
  const { add: addToast } = useToast();

  // Default selection: current type if it matches a known type, else first option
  const defaultType =
    ARTIFACT_TYPES.find((t) => t.value === currentType)?.value ??
    ARTIFACT_TYPES[0].value;

  const [selectedType, setSelectedType] = useState<ArtifactTypeValue>(defaultType);
  const [reExtract, setReExtract] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onOpenChange(false);
    // Reset error state on close so stale error is not shown on re-open
    setErrorMessage(null);
  }, [isSubmitting, onOpenChange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Nothing changed — close without calling API
    if (selectedType === currentType && !reExtract) {
      handleClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await reclassifyArtifact(artifactId, {
        new_type: selectedType,
        re_extract: reExtract || undefined,
      });

      const typeLabel =
        ARTIFACT_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;

      addToast({
        type: "success",
        message: `Artifact reclassified as "${typeLabel}"`,
      });

      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(extractApiErrorMessage(err));
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Reclassification failed — please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-card shadow-xl",
          "focus:outline-none",
        )}
        // Stop backdrop click propagating through the dialog surface
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2
            id={`${baseId}-title`}
            className="text-base font-semibold tracking-tight"
          >
            Reclassify artifact
          </h2>
          <button
            type="button"
            aria-label="Close reclassify dialog"
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form
          id={`${baseId}-form`}
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 p-5"
        >
          {/* Artifact type selector */}
          <div>
            <label
              htmlFor={`${baseId}-type`}
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Artifact type
            </label>
            <select
              id={`${baseId}-type`}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ArtifactTypeValue)}
              disabled={isSubmitting}
              // autoFocus so keyboard users land here immediately
              autoFocus
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            >
              {ARTIFACT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                  {value === currentType ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Re-extract checkbox */}
          <div className="flex items-start gap-2.5">
            <input
              id={`${baseId}-re-extract`}
              type="checkbox"
              checked={reExtract}
              onChange={(e) => setReExtract(e.target.checked)}
              disabled={isSubmitting}
              className={cn(
                "mt-0.5 size-4 rounded border-input accent-primary",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            />
            <div>
              <label
                htmlFor={`${baseId}-re-extract`}
                className="block text-sm font-medium text-foreground"
              >
                Re-extract content
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Run a fresh extraction pass using the new type&apos;s schema.
              </p>
            </div>
          </div>

          {/* Inline error */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className={cn(
                "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
                "flex items-start gap-2",
              )}
            >
              <svg
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium sm:h-8 sm:min-h-0",
                "border border-input bg-background text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium sm:h-8 sm:min-h-0",
                "bg-primary text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Reclassifying…
                </span>
              ) : (
                "Reclassify"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
