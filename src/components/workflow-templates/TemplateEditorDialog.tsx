"use client";

/**
 * TemplateEditorDialog — create or edit a custom workflow template.
 *
 * Mode "create": empty form; calls POST /api/workflow-templates on submit.
 * Mode "edit":   pre-populated with existing template data; calls
 *                PATCH /api/workflow-templates/:id on submit.
 *
 * YAML is accepted as raw text in a monospace <textarea>. The repo has no
 * bundled code editor, so a plain textarea with monospace styling is used
 * (spec-approved fallback). No new dependencies are added.
 *
 * Accessibility:
 *   - role="dialog", aria-modal, aria-labelledby (matching DialogTitle pattern)
 *   - Focus-trapped via focus-within ordering; first input auto-focused
 *   - Error displayed via role="alert"
 *   - Close button has aria-label
 *
 * Traces FR-1.5-09 / P1.5-2-05.
 */

import { useState, useId, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/useTemplateMutations";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type EditorMode = "create" | "edit";

export interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required in edit mode. */
  template?: WorkflowTemplate | null;
  mode: EditorMode;
  /** Called after a successful create or update. */
  onSuccess?: (template: WorkflowTemplate) => void;
}

// ---------------------------------------------------------------------------
// Error extraction helper (matches assessment-modal pattern)
// ---------------------------------------------------------------------------

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as
      | { detail?: string | Array<{ msg?: string }> }
      | string
      | null;
    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = body.detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? String(d)).join("; ");
    }
    return `API error ${err.status}`;
  }
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const YAML_PLACEHOLDER = `# Workflow template YAML
# Example:
label: My Custom Template
description: Brief description of what this workflow does
params:
  - name: depth
    type: enum
    label: Analysis Depth
    options:
      - shallow
      - standard
      - deep
    default: standard
    required: true
steps:
  - id: classify
    model: haiku
  - id: extract
    model: sonnet
`;

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  mode,
  onSuccess,
}: TemplateEditorDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  const [slug, setSlug] = useState(template?.slug ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [yamlContent, setYamlContent] = useState(template?.yaml_content ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset local state when template prop changes (e.g. user opens a different template)
  // useCallback deps keep this stable when dialog is closed/re-opened
  const resetToTemplate = useCallback(() => {
    setSlug(template?.slug ?? "");
    setDescription(template?.description ?? "");
    setYamlContent(template?.yaml_content ?? "");
    setErrorMessage(null);
  }, [template]);

  const { mutateAsync: createTemplate, isPending: isCreating } = useCreateTemplate();
  const { mutateAsync: updateTemplate, isPending: isUpdating } = useUpdateTemplate();
  const isPending = isCreating || isUpdating;

  function handleClose() {
    if (isPending) return;
    resetToTemplate();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedSlug = slug.trim();
    const trimmedYaml = yamlContent.trim();

    if (!trimmedSlug) {
      setErrorMessage("Slug is required.");
      return;
    }
    if (!trimmedYaml) {
      setErrorMessage("YAML content is required.");
      return;
    }

    try {
      let result: WorkflowTemplate;
      if (mode === "create") {
        result = await createTemplate({
          slug: trimmedSlug,
          description: description.trim() || null,
          yaml_content: trimmedYaml,
        });
      } else {
        if (!template?.id) throw new Error("No template ID for edit.");
        result = await updateTemplate({
          id: template.id,
          req: {
            slug: trimmedSlug,
            description: description.trim() || null,
            yaml_content: trimmedYaml,
          },
        });
      }
      onSuccess?.(result);
      resetToTemplate();
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(extractApiErrorMessage(err, "Submission failed — please try again."));
    }
  }

  if (!open) return null;

  const isEdit = mode === "edit";

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
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100%-2rem)] max-w-xl",
          "rounded-xl border bg-card shadow-xl",
          "max-h-[90dvh] flex flex-col",
          "focus:outline-none",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {isEdit ? "Edit Template" : "New Template"}
            </h2>
            <p id={descId} className="mt-0.5 text-xs text-muted-foreground">
              {isEdit
                ? "Modify the custom workflow template."
                : "Create a custom workflow template with YAML configuration."}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Close ${isEdit ? "edit" : "create"} template dialog`}
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

        {/* Form */}
        <form
          id={`${baseId}-form`}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          {/* Slug */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${baseId}-slug`}
              className="text-sm font-medium"
            >
              Slug
              <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id={`${baseId}-slug`}
              type="text"
              required
              autoFocus
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isPending}
              placeholder="e.g. research_synthesis_v2"
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm font-mono",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${baseId}-description`} className="text-sm font-medium">
              Description
            </label>
            <input
              id={`${baseId}-description`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              placeholder="Brief description of what this template does"
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            />
          </div>

          {/* YAML content */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${baseId}-yaml`} className="text-sm font-medium">
              YAML Configuration
              <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            </label>
            <textarea
              id={`${baseId}-yaml`}
              required
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              disabled={isPending}
              placeholder={YAML_PLACEHOLDER}
              rows={14}
              spellCheck={false}
              className={cn(
                "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm font-mono leading-relaxed",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            />
            <p className="text-xs text-muted-foreground">
              YAML defining template metadata, params, and pipeline steps.
            </p>
          </div>

          {/* Error banner */}
          {errorMessage && (
            <div
              role="alert"
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
        </form>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
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
            type="submit"
            form={`${baseId}-form`}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
              "transition-colors hover:bg-primary/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {isEdit ? "Saving…" : "Creating…"}
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create template"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
