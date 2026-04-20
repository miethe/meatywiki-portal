"use client";

/**
 * DeleteTemplateDialog — confirmation dialog for deleting a custom template.
 *
 * Destructive action requires an explicit confirmation step.
 * Calls DELETE /api/workflow-templates/:id on confirm.
 *
 * Accessibility:
 *   - role="alertdialog" (destructive action variant of dialog)
 *   - aria-modal, aria-labelledby, aria-describedby
 *   - Focus defaults to cancel button (safer default for destructive dialogs)
 *   - Error displayed via role="alert"
 *
 * Traces FR-1.5-09 / P1.5-2-05.
 */

import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useDeleteTemplate } from "@/hooks/useTemplateMutations";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeleteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkflowTemplate | null;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeleteTemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: DeleteTemplateDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: deleteTemplate, isPending } = useDeleteTemplate();

  function handleClose() {
    if (isPending) return;
    setErrorMessage(null);
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (!template?.id) return;
    setErrorMessage(null);
    try {
      await deleteTemplate(template.id);
      onSuccess?.();
      setErrorMessage(null);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { detail?: string } | string | null;
        if (typeof body === "object" && body !== null && typeof body.detail === "string") {
          setErrorMessage(body.detail);
        } else {
          setErrorMessage(`API error ${err.status}`);
        }
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Delete failed — please try again.");
      }
    }
  }

  if (!open || !template) return null;

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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100%-2rem)] max-w-sm",
          "rounded-xl border bg-card shadow-xl",
          "flex flex-col",
          "focus:outline-none",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-destructive">
              Delete Template
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close delete confirmation"
            onClick={handleClose}
            disabled={isPending}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p id={descId} className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="font-semibold text-foreground">
              {template.label || template.slug}
            </strong>
            ? This action cannot be undone. Any workflows referencing this template will
            retain their run history.
          </p>

          {/* Error banner */}
          {errorMessage && (
            <div
              role="alert"
              className={cn(
                "mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            autoFocus
            onClick={handleClose}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground",
              "transition-colors hover:bg-destructive/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isPending ? (
              <>
                <svg
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              "Delete template"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
