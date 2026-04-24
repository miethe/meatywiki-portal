"use client";

/**
 * OperatorActionsBlock — pause / resume / cancel controls for Screen B.
 *
 * State-conditional rendering:
 *   Pause  — enabled only when status === 'running'
 *   Resume — enabled only when status === 'paused'
 *   Cancel — visible when status in ['running','paused']; wrapped in an
 *            alertdialog confirmation before firing (pattern mirrors
 *            DeleteTemplateDialog).
 *
 * On success the caller's `onAction` callback fires so upstream can refetch
 * run state + audit log.
 *
 * Buttons disabled while any action is in-flight. Errors render inline below
 * the button row.
 *
 * WCAG 2.1 AA:
 *   - role="alertdialog" on cancel confirmation
 *   - aria-disabled on buttons that are conditionally inactive
 *   - role="alert" on error message
 *
 * P7-03 — Screen B operator actions.
 */

import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { useOperatorActions } from "@/hooks/useOperatorActions";
import type { WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OperatorActionsBlockProps {
  runId: string;
  status: WorkflowRunStatus;
  /** Called after any successful operator action — use to trigger refetch. */
  onAction: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Cancel confirmation dialog (mirrors DeleteTemplateDialog pattern)
// ---------------------------------------------------------------------------

interface CancelConfirmDialogProps {
  open: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function CancelConfirmDialog({ open, isPending, onConfirm, onCancel }: CancelConfirmDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={!isPending ? onCancel : undefined}
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
          "rounded-xl border border-border bg-card shadow-xl",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-destructive">
            Cancel Workflow Run?
          </h2>
          <button
            type="button"
            aria-label="Close cancel confirmation"
            onClick={onCancel}
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
            This will permanently stop the workflow run. Any in-progress stage output
            will be discarded. This action cannot be undone.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            Keep Running
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground",
              "transition-colors hover:bg-destructive/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isPending ? (
              <>
                <SpinnerIcon />
                Cancelling…
              </>
            ) : (
              "Cancel run"
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function OperatorActionsBlock({
  runId,
  status,
  onAction,
  className,
}: OperatorActionsBlockProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { isPending, error, pause, resume, cancel } = useOperatorActions(runId, onAction);

  const canPause = status === "running";
  const canResume = status === "paused";
  const canCancel = status === "running" || status === "paused";

  // If neither pause/resume/cancel applies, render nothing.
  if (!canPause && !canResume && !canCancel) return null;

  async function handleCancelConfirm() {
    await cancel();
    setCancelDialogOpen(false);
  }

  return (
    <>
      <div
        className={cn("rounded-xl border border-border bg-card p-4", className)}
        data-testid="operator-actions-block"
      >
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Operator Actions
        </h3>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Workflow run controls">
          {/* Pause — only when running */}
          {canPause && (
            <button
              type="button"
              onClick={() => void pause()}
              disabled={isPending}
              aria-label="Pause workflow run"
              data-testid="operator-pause-button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "border border-amber-300 bg-amber-50 text-amber-800",
                "dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                "transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/60",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                isPending && "animate-pulse",
              )}
            >
              {isPending ? <SpinnerIcon /> : <PauseIcon />}
              Pause
            </button>
          )}

          {/* Resume — only when paused */}
          {canResume && (
            <button
              type="button"
              onClick={() => void resume()}
              disabled={isPending}
              aria-label="Resume workflow run"
              data-testid="operator-resume-button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "border border-emerald-300 bg-emerald-50 text-emerald-800",
                "dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                "transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                isPending && "animate-pulse",
              )}
            >
              {isPending ? <SpinnerIcon /> : <ResumeIcon />}
              Resume
            </button>
          )}

          {/* Cancel — when running or paused */}
          {canCancel && (
            <button
              type="button"
              onClick={() => setCancelDialogOpen(true)}
              disabled={isPending}
              aria-label="Cancel workflow run"
              data-testid="operator-cancel-button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "border border-destructive/40 bg-destructive/5 text-destructive",
                "dark:border-destructive/60 dark:bg-destructive/10",
                "transition-colors hover:bg-destructive/10 dark:hover:bg-destructive/20",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <CancelIcon />
              Cancel
            </button>
          )}
        </div>

        {/* Inline error */}
        {error && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-600 dark:text-red-400"
            data-testid="operator-error"
          >
            {error}
          </p>
        )}
      </div>

      {/* Cancel confirmation */}
      <CancelConfirmDialog
        open={cancelDialogOpen}
        isPending={isPending}
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => { if (!isPending) setCancelDialogOpen(false); }}
      />
    </>
  );
}
