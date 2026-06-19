"use client";

/**
 * LintScopeModal — scope picker + results display for artifact lint.
 *
 * Flow:
 *   1. User opens modal → selects scope (frontmatter | content | all).
 *   2. User clicks "Run Lint" → PATCH /api/artifacts/:id/lint-scope.
 *   3a. Success → render violations list grouped by check, with severity
 *       badges and totals. User can re-run with a different scope.
 *   3b. Error → inline error banner; modal stays open.
 *   Loading → submit button disabled + spinner.
 *
 * Design invariants:
 *   - WCAG 2.1 AA: role="dialog", aria-modal, aria-labelledby, role="alert"
 *     for error region. Focus auto-lands on the scope selector.
 *   - Follows the ReclassifyModal custom-modal pattern (no direct Radix dep;
 *     no import of shadcn dialog.tsx — uses the same backdrop + fixed-center
 *     pattern to stay consistent with existing modals).
 *   - Uses the existing apiFetch wrapper via lintArtifactScope().
 *   - State: local — no context dep or TanStack Query needed; lint is
 *     synchronous from the FE perspective (PATCH returns full result).
 *
 * Remediation Bundle v1 — P2-02.
 */

import { useState, useCallback, useId, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { lintArtifactScope } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type {
  LintScope,
  LintSeverity,
  LintScopeResponse,
  LintViolation,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_OPTIONS: { value: LintScope; label: string; description: string }[] = [
  {
    value: "frontmatter",
    label: "Frontmatter",
    description: "Check YAML front-matter fields only",
  },
  {
    value: "content",
    label: "Content",
    description: "Check body content and structure",
  },
  {
    value: "all",
    label: "All",
    description: "Full lint — frontmatter + content",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LintScopeModalProps {
  artifactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractApiErrorMessage(err: ApiError): string {
  const body = err.body as
    | { error?: { message?: string }; detail?: string | Array<{ msg?: string }> }
    | string
    | null;

  if (typeof body === "object" && body !== null) {
    if (body.error?.message) return body.error.message;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => d?.msg ?? String(d)).join("; ");
    }
  }
  return `API error ${err.status}`;
}

function severityColor(severity: LintSeverity): string {
  switch (severity) {
    case "error":
      return "text-destructive";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "ok":
      return "text-emerald-600 dark:text-emerald-400";
  }
}

function severityBg(severity: LintSeverity): string {
  switch (severity) {
    case "error":
      return "border-destructive/30 bg-destructive/10";
    case "warning":
      return "border-amber-400/30 bg-amber-400/10";
    case "ok":
      return "border-emerald-500/30 bg-emerald-500/10";
  }
}

function severityLabel(severity: LintSeverity): string {
  switch (severity) {
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "ok":
      return "OK";
  }
}

// ---------------------------------------------------------------------------
// Sub-component: individual violation row
// ---------------------------------------------------------------------------

function ViolationRow({ violation }: { violation: LintViolation }) {
  return (
    <li
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        severityBg(violation.severity),
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            severityColor(violation.severity),
          )}
          aria-label={`Severity: ${severityLabel(violation.severity)}`}
        >
          {severityLabel(violation.severity).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{violation.message}</p>
          {violation.fix_detail && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium">Fix:</span> {violation.fix_detail}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: results panel (shown after a successful lint run)
// ---------------------------------------------------------------------------

function ResultsPanel({
  result,
  onRerun,
  isRunning,
}: {
  result: LintScopeResponse;
  onRerun: () => void;
  isRunning: boolean;
}) {
  const hasViolations = result.violations.length > 0;

  // Group violations by check name
  const grouped = new Map<string, LintViolation[]>();
  for (const v of result.violations) {
    const bucket = grouped.get(v.check) ?? [];
    bucket.push(v);
    grouped.set(v.check, bucket);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary row */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
          severityBg(result.severity),
        )}
        aria-label={`Lint result: ${severityLabel(result.severity)}`}
      >
        <span
          className={cn("font-semibold", severityColor(result.severity))}
        >
          {severityLabel(result.severity)}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {result.checks_passed}/{result.checks_run} checks passed
        </span>
        {result.total_issues > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className={severityColor(result.severity)}>
              {result.total_issues} issue{result.total_issues !== 1 ? "s" : ""}
            </span>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground capitalize">
          Scope: {result.scope}
        </span>
      </div>

      {/* Violations list */}
      {hasViolations ? (
        <ul className="flex flex-col gap-1.5" aria-label="Lint violations">
          {Array.from(grouped.entries()).map(([check, violations]) => (
            <li key={check}>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {check}
              </p>
              <ul className="flex flex-col gap-1">
                {violations.map((v, i) => (
                  <ViolationRow key={`${check}-${i}`} violation={v} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No violations found — artifact passes all checks for this scope.
        </p>
      )}

      {/* Re-run button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onRerun}
          disabled={isRunning}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
            "border border-input bg-background text-foreground",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          Run again with different scope
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function LintScopeModal({
  artifactId,
  open,
  onOpenChange,
}: LintScopeModalProps) {
  const baseId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  const [selectedScope, setSelectedScope] = useState<LintScope>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<LintScopeResponse | null>(null);

  // Focus the selector when modal opens
  useEffect(() => {
    if (open && !result) {
      // Small delay to allow layout stabilization before focus
      const id = setTimeout(() => selectRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open, result]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onOpenChange(false);
    // Reset for next open
    setErrorMessage(null);
    setResult(null);
    setSelectedScope("all");
  }, [isSubmitting, onOpenChange]);

  const handleRerun = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
    // Focus returns to selector
    setTimeout(() => selectRef.current?.focus(), 50);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const data = await lintArtifactScope(artifactId, selectedScope);
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(extractApiErrorMessage(err));
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Lint request failed — please try again.",
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
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-card shadow-xl",
          // Allow scrolling for long violation lists
          "max-h-[90dvh] overflow-y-auto",
          "focus:outline-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-card px-5 py-4">
          <h2
            id={`${baseId}-title`}
            className="text-base font-semibold tracking-tight"
          >
            Lint artifact
          </h2>
          <button
            type="button"
            aria-label="Close lint scope dialog"
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

        {/* Body */}
        <div className="p-5">
          {result ? (
            /* Results view */
            <ResultsPanel
              result={result}
              onRerun={handleRerun}
              isRunning={isSubmitting}
            />
          ) : (
            /* Scope picker form */
            <form
              id={`${baseId}-form`}
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4"
            >
              {/* Scope selector */}
              <div>
                <label
                  htmlFor={`${baseId}-scope`}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Lint scope
                </label>
                <select
                  id={`${baseId}-scope`}
                  ref={selectRef}
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value as LintScope)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-50",
                  )}
                >
                  {SCOPE_OPTIONS.map(({ value, label, description }) => (
                    <option key={value} value={value}>
                      {label} — {description}
                    </option>
                  ))}
                </select>
                <p
                  id={`${baseId}-scope-hint`}
                  className="mt-1.5 text-xs text-muted-foreground"
                >
                  {SCOPE_OPTIONS.find((o) => o.value === selectedScope)?.description}
                </p>
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
                      Linting…
                    </span>
                  ) : (
                    "Run Lint"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
