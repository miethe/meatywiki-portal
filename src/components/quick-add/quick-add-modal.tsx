"use client";

/**
 * QuickAddModal — two-tab intake modal (Note vs URL entry).
 *
 * Built fresh from shadcn/ui primitives per audit finding (#4):
 * "Quick Add Modal standalone not drafted in Stitch; build fresh."
 * Derived from Workflow Initiation Step 1 structure (audit row 13).
 *
 * Tab 1: Note — textarea for raw note text
 * Tab 2: URL  — URL input with optional title override
 *
 * Post-submit: shows SSE progress slot (StageTracker full variant).
 * P3-04 wires the actual POST /api/intake/{note,url} calls + SSE subscription.
 *
 * Design spec §5 (POST /api/intake/{note,url}), §3.2 row 4.
 * Stitch reference: §3.1 Quick Add modal shell.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StageTracker } from "@/components/workflow/stage-tracker";
import type { WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Tab state
// ---------------------------------------------------------------------------

type Tab = "note" | "url";

// ---------------------------------------------------------------------------
// Pending run state (post-submit scaffold)
// ---------------------------------------------------------------------------

interface PendingRun {
  runId: string;
  status: WorkflowRunStatus;
  currentStage?: number | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called on successful submit — receives returned run_id (P3-04 wires this) */
  onSubmit?: (data: { type: Tab; content: string }) => Promise<{ runId: string }>;
}

// ---------------------------------------------------------------------------
// Modal content (dialog element)
// ---------------------------------------------------------------------------

export function QuickAddModal({
  open,
  onOpenChange,
  onSubmit,
}: QuickAddModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("note");
  const [noteText, setNoteText] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (isSubmitting) return; // keep open during active ingest
    onOpenChange(false);
    // Reset on close
    setTimeout(() => {
      setNoteText("");
      setUrlValue("");
      setUrlTitle("");
      setPendingRun(null);
      setError(null);
      setActiveTab("note");
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;

    const content = activeTab === "note" ? noteText : urlValue;
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { runId } = await onSubmit({ type: activeTab, content });
      setPendingRun({ runId, status: "pending", currentStage: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  }

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
        aria-labelledby="quick-add-title"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-card shadow-xl",
          "focus:outline-none",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2
            id="quick-add-title"
            className="text-base font-semibold tracking-tight"
          >
            Quick Add
          </h2>
          <button
            type="button"
            aria-label="Close Quick Add"
            onClick={handleClose}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Intake type"
          className="flex gap-0 border-b"
        >
          {(["note", "url"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`quick-add-${tab}-panel`}
              id={`quick-add-${tab}-tab`}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                "border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "note" ? "Note" : "URL"}
            </button>
          ))}
        </div>

        {/* Panel */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5">
            {/* Note panel */}
            <div
              role="tabpanel"
              id="quick-add-note-panel"
              aria-labelledby="quick-add-note-tab"
              hidden={activeTab !== "note"}
            >
              <label
                htmlFor="quick-add-note-text"
                className="mb-1.5 block text-sm font-medium"
              >
                Note text
              </label>
              <textarea
                id="quick-add-note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Start typing your note…"
                rows={5}
                required={activeTab === "note"}
                disabled={isSubmitting || !!pendingRun}
                className={cn(
                  "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:opacity-50",
                )}
              />
            </div>

            {/* URL panel */}
            <div
              role="tabpanel"
              id="quick-add-url-panel"
              aria-labelledby="quick-add-url-tab"
              hidden={activeTab !== "url"}
              className="flex flex-col gap-3"
            >
              <div>
                <label
                  htmlFor="quick-add-url-value"
                  className="mb-1.5 block text-sm font-medium"
                >
                  URL
                </label>
                <input
                  id="quick-add-url-value"
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://…"
                  required={activeTab === "url"}
                  disabled={isSubmitting || !!pendingRun}
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-50",
                  )}
                />
              </div>
              <div>
                <label
                  htmlFor="quick-add-url-title"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Title{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  id="quick-add-url-title"
                  type="text"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="Override extracted title"
                  disabled={isSubmitting || !!pendingRun}
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-50",
                  )}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* SSE progress slot — activated post-submit (P3-08 wires real SSE) */}
            {pendingRun && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Ingesting…
                </p>
                <StageTracker
                  runId={pendingRun.runId}
                  templateId="source_ingest_v1"
                  status={pendingRun.status}
                  currentStage={pendingRun.currentStage}
                  variant="full"
                  mode="sse"
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!pendingRun && (
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                type="button"
                onClick={handleClose}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
                  "border border-input bg-background text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-4 text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "transition-colors hover:bg-primary/90",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {isSubmitting ? "Adding…" : "Add"}
              </button>
            </div>
          )}

          {pendingRun &&
            (pendingRun.status === "complete" ||
              pendingRun.status === "failed") && (
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-4 text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "transition-colors hover:bg-primary/90",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Done
                </button>
              </div>
            )}
        </form>
      </div>
    </>
  );
}
