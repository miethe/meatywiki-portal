"use client";

/**
 * ProjectDirModal — Add / Edit modal for project directory records.
 *
 * Modes:
 *   - Create (dir === undefined): blank form, submits POST.
 *   - Edit   (dir defined): pre-populated form, submits PATCH.
 *
 * Fields:
 *   path         required  text input
 *   project_id   required  text input; auto-slugified from path on blur (create only)
 *   workspace    optional  text input
 *   patterns     optional  comma-separated text (normalized to string[])
 *   enabled      boolean   toggle switch
 *   git_branch   optional  text input
 *
 * In Edit mode, auto_detected is shown as a read-only badge.
 *
 * Validation: path + project_id required; shows inline error messages.
 *
 * Uses the project's custom Dialog primitive (dialog.tsx) — no Radix dep needed.
 * Mirrors the TemplateEditorDialog / research wizard pattern for form layout.
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-03.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectDirRead, ProjectDirCreateRequest, ProjectDirUpdateRequest } from "@/lib/api/project-directories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a filesystem path to a slug suitable for project_id. */
function pathToSlug(path: string): string {
  return path
    .replace(/^.*[/\\]/, "") // take last segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Parse comma-separated patterns string → trimmed non-empty array. */
function parsePatterns(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Small shared atoms
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-foreground"
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
      )}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectDirModalProps {
  open: boolean;
  onClose: () => void;
  /** When defined, the modal is in Edit mode. */
  dir?: ProjectDirRead;
  onSubmit: (
    data: ProjectDirCreateRequest | ProjectDirUpdateRequest,
    mode: "create" | "edit",
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectDirModal({
  open,
  onClose,
  dir,
  onSubmit,
}: ProjectDirModalProps) {
  const mode = dir ? "edit" : "create";
  const pathId = useId();
  const projectIdId = useId();
  const workspaceId = useId();
  const patternsId = useId();
  const gitBranchId = useId();
  const enabledId = useId();

  // Form state
  const [path, setPath] = useState(dir?.path ?? "");
  const [projectId, setProjectId] = useState(dir?.project_id ?? "");
  const [workspace, setWorkspace] = useState(dir?.workspace ?? "");
  const [patterns, setPatterns] = useState(
    dir?.patterns ? dir.patterns.join(", ") : "",
  );
  const [enabled, setEnabled] = useState(dir?.enabled ?? true);
  const [gitBranch, setGitBranch] = useState(dir?.git_branch ?? "");

  // Validation errors
  const [pathError, setPathError] = useState<string | null>(null);
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ref to track whether project_id was manually edited (skip auto-slug)
  const projectIdTouchedRef = useRef(false);

  // Reset form when modal is opened/closed or the dir changes
  useEffect(() => {
    if (open) {
      setPath(dir?.path ?? "");
      setProjectId(dir?.project_id ?? "");
      setWorkspace(dir?.workspace ?? "");
      setPatterns(dir?.patterns ? dir.patterns.join(", ") : "");
      setEnabled(dir?.enabled ?? true);
      setGitBranch(dir?.git_branch ?? "");
      setPathError(null);
      setProjectIdError(null);
      setSubmitError(null);
      setSubmitting(false);
      projectIdTouchedRef.current = false;
    }
  }, [open, dir]);

  // Auto-slugify path → project_id in Create mode when project_id not touched
  function handlePathBlur() {
    if (mode === "create" && !projectIdTouchedRef.current && path.trim()) {
      setProjectId(pathToSlug(path.trim()));
    }
  }

  // Validate
  function validate(): boolean {
    let ok = true;
    if (!path.trim()) {
      setPathError("Path is required.");
      ok = false;
    } else {
      setPathError(null);
    }
    if (!projectId.trim()) {
      setProjectIdError("Project ID is required.");
      ok = false;
    } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(projectId.trim()) && projectId.trim().length > 1) {
      setProjectIdError("Project ID must be lowercase alphanumeric with hyphens.");
      ok = false;
    } else {
      setProjectIdError(null);
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "create") {
        const body: ProjectDirCreateRequest = {
          path: path.trim(),
          project_id: projectId.trim(),
          workspace: workspace.trim() || null,
          patterns: parsePatterns(patterns),
          enabled,
          git_branch: gitBranch.trim() || null,
        };
        await onSubmit(body, "create");
      } else {
        const body: ProjectDirUpdateRequest = {
          path: path.trim(),
          workspace: workspace.trim() || null,
          patterns: parsePatterns(patterns),
          enabled,
          git_branch: gitBranch.trim() || null,
        };
        await onSubmit(body, "edit");
      }
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-full max-w-lg px-6 py-6">
        <DialogHeader className="mb-4">
          <DialogTitle>
            {mode === "create" ? "Add Project Directory" : "Edit Project Directory"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Path */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={pathId} required>
              Path
            </FieldLabel>
            <Input
              id={pathId}
              type="text"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setPathError(null);
              }}
              onBlur={handlePathBlur}
              placeholder="/absolute/path/to/project"
              spellCheck={false}
              aria-required="true"
              aria-describedby={pathError ? `${pathId}-error` : undefined}
              aria-invalid={pathError ? "true" : undefined}
              className={cn("font-mono text-sm", pathError && "border-destructive")}
              disabled={submitting}
            />
            <FieldError id={`${pathId}-error`} message={pathError} />
          </div>

          {/* Project ID */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={projectIdId} required>
              Project ID
            </FieldLabel>
            {mode === "edit" ? (
              <div className="flex items-center gap-2">
                <Input
                  id={projectIdId}
                  type="text"
                  value={projectId}
                  readOnly
                  disabled
                  className="font-mono text-sm opacity-60"
                />
                {dir?.auto_detected && (
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                    )}
                  >
                    auto-detected
                  </span>
                )}
              </div>
            ) : (
              <>
                <Input
                  id={projectIdId}
                  type="text"
                  value={projectId}
                  onChange={(e) => {
                    projectIdTouchedRef.current = true;
                    setProjectId(e.target.value);
                    setProjectIdError(null);
                  }}
                  placeholder="my-project-name"
                  spellCheck={false}
                  aria-required="true"
                  aria-describedby={projectIdError ? `${projectIdId}-error` : undefined}
                  aria-invalid={projectIdError ? "true" : undefined}
                  className={cn(
                    "font-mono text-sm",
                    projectIdError && "border-destructive",
                  )}
                  disabled={submitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  Auto-filled from path. Lowercase alphanumeric with hyphens.
                </p>
                <FieldError id={`${projectIdId}-error`} message={projectIdError} />
              </>
            )}
          </div>

          {/* Workspace */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={workspaceId}>Workspace</FieldLabel>
            <Input
              id={workspaceId}
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="wiki, projects, blog… (optional)"
              disabled={submitting}
            />
          </div>

          {/* Patterns */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={patternsId}>File patterns</FieldLabel>
            <Input
              id={patternsId}
              type="text"
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
              placeholder="*.md, *.yaml (comma-separated, optional)"
              spellCheck={false}
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Glob patterns for files to sync. Leave blank to use defaults.
            </p>
          </div>

          {/* Git branch */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={gitBranchId}>Git branch</FieldLabel>
            <Input
              id={gitBranchId}
              type="text"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              placeholder="main (optional)"
              spellCheck={false}
              disabled={submitting}
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id={enabledId}
              role="switch"
              aria-checked={enabled}
              aria-label={`Enabled: ${enabled ? "yes" : "no"}`}
              disabled={submitting}
              onClick={() => setEnabled((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                enabled ? "bg-primary" : "bg-input",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none inline-block size-4 rounded-full bg-white shadow-md ring-0",
                  "transition-transform duration-200 ease-in-out",
                  enabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            <label
              htmlFor={enabledId}
              className="cursor-pointer text-sm text-foreground"
              onClick={() => setEnabled((v) => !v)}
            >
              Enabled
            </label>
          </div>

          {/* Submit error */}
          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner />
                  {mode === "create" ? "Adding…" : "Saving…"}
                </span>
              ) : mode === "create" ? (
                "Add Directory"
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
