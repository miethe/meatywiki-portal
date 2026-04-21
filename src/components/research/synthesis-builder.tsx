"use client";

/**
 * SynthesisBuilder — form for launching a research_synthesis_v1 workflow.
 *
 * P4-02: Synthesis Builder implementation.
 *
 * Phases:
 *   "form"      — user selects sources, fills optional scope + focus, submits.
 *   "running"   — POST accepted (202), SSE stream open, StageTracker updating.
 *   "complete"  — workflow_completed event received; link to new synthesis artifact.
 *   "error"     — POST error or SSE workflow_failed; inline error with retry.
 *
 * Source selection: multi-select textarea (one ULID per line) as the artifact
 * picker. Falls back to typed-list input so the form works without a live
 * search endpoint. A future iteration can swap in an autocomplete picker here.
 *
 * SSE stages for research_synthesis_v1: gathering → synthesizing → complete
 * (displayed via StageTracker full variant bound to useSSE).
 *
 * Design spec §7 (Synthesis Builder), P4-02 task spec.
 * Stitch reference: "Synthesis Builder" (P4-02 scope).
 */

import { useState, useCallback, useId, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { useSSE } from "@/hooks/useSSE";
import { submitSynthesis } from "@/lib/api/workflows";
import type { WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type BuilderPhase = "form" | "running" | "complete" | "error";

interface CompletedRun {
  runId: string;
  artifactId?: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SynthesisBuilderProps {
  /** Optional callback invoked when the synthesis workflow completes. */
  onComplete?: (runId: string, artifactId?: string | null) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Source ID parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse raw textarea value into an array of artifact IDs.
 * Accepts one ID per line, comma-separated IDs on a single line, or both.
 * Trims whitespace; skips blank entries.
 */
function parseSourceIds(raw: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const segment of raw.split(/[\n,]+/)) {
    const trimmed = segment.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      ids.push(trimmed);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
        <span aria-hidden="true" className="ml-0.5 text-red-500">
          *
        </span>
      )}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SynthesisBuilder
// ---------------------------------------------------------------------------

export function SynthesisBuilder({
  onComplete,
  className,
}: SynthesisBuilderProps) {
  // Form state
  const [sourcesRaw, setSourcesRaw] = useState("");
  const [scope, setScope] = useState("");
  const [focus, setFocus] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Phase state
  const [phase, setPhase] = useState<BuilderPhase>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedRun | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunStatus>("pending");
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unique IDs for form accessibility
  const sourcesId = useId();
  const scopeId = useId();
  const focusId = useId();

  // ------------------------------------------------------------------
  // SSE — open when phase === "running"
  // ------------------------------------------------------------------

  const sseUrl = activeRunId
    ? `/api/workflows/${activeRunId}/stream`
    : undefined;

  const { events } = useSSE<SSEWorkflowEvent>({
    url: sseUrl,
    enabled: phase === "running",
    debounceMs: 100,
    // Process incoming events to update stage tracker and detect terminal state
  });

  // Derive current stage + status from SSE events — derived on render,
  // no extra effect needed since events is a stable accumulating array.
  // The terminal detection is handled via a side-effectful dependency on events.
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  // Detect terminal events: workflow_completed / workflow_failed / stage_error.
  // We use a callback to avoid processing the same terminal event twice.
  const handleTerminalEvent = useCallback(
    (event: SSEWorkflowEvent) => {
      if (event.type === "workflow_completed") {
        const artifactId = event.artifact_id ?? null;
        const runId = event.run_id ?? activeRunId ?? "";
        setCompleted({ runId, artifactId });
        setRunStatus("complete");
        setPhase("complete");
        onComplete?.(runId, artifactId);
      } else if (event.type === "workflow_failed") {
        setRunStatus("failed");
        setPhase("error");
        setSubmitError(
          event.error ||
            "The synthesis workflow failed. Check the workflow log for details.",
        );
      } else if (event.type === "stage_completed") {
        // Advance stage indicator on each stage completion
        setCurrentStage((prev) => prev + 1);
      } else if (event.type === "stage_started") {
        setRunStatus("running");
      }
    },
    [activeRunId, onComplete],
  );

  // React to new SSE events: process only the latest one to avoid re-processing
  // already-handled events. The `events` array accumulates; we track the last
  // processed index via the array length we processed.
  // Simple approach: process latestEvent if it's new.
  const [lastProcessedLength, setLastProcessedLength] = useState(0);

  if (events.length > lastProcessedLength && latestEvent !== null) {
    setLastProcessedLength(events.length);
    handleTerminalEvent(latestEvent);
  }

  // ------------------------------------------------------------------
  // Form submission
  // ------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setValidationError(null);
      setSubmitError(null);

      const sources = parseSourceIds(sourcesRaw);
      if (sources.length === 0) {
        setValidationError("Please enter at least one source artifact ID.");
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await submitSynthesis({
          sources,
          scope: scope || undefined,
          focus: focus || undefined,
        });
        setActiveRunId(result.run_id);
        setRunStatus("pending");
        setCurrentStage(0);
        setPhase("running");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setSubmitError(message);
        setPhase("error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [sourcesRaw, scope, focus],
  );

  const handleRetry = useCallback(() => {
    setPhase("form");
    setSubmitError(null);
    setValidationError(null);
    setActiveRunId(null);
    setCompleted(null);
    setCurrentStage(0);
    setRunStatus("pending");
    setLastProcessedLength(0);
  }, []);

  // ------------------------------------------------------------------
  // Render: form phase
  // ------------------------------------------------------------------

  if (phase === "form" || (phase === "error" && !activeRunId)) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        {submitError && <ErrorBanner message={submitError} />}

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Synthesis Builder"
          className="flex flex-col gap-5"
        >
          {/* Source artifacts */}
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={sourcesId} required>
              Source artifacts
            </FieldLabel>
            <textarea
              id={sourcesId}
              name="sources"
              value={sourcesRaw}
              onChange={(e) => {
                setSourcesRaw(e.target.value);
                setValidationError(null);
              }}
              rows={5}
              placeholder={
                "01HXYZ0000000000000000001\n01HXYZ0000000000000000002"
              }
              aria-describedby={`${sourcesId}-hint ${sourcesId}-error`}
              aria-invalid={validationError !== null}
              aria-required="true"
              className={cn(
                "w-full resize-y rounded-md border bg-background px-3 py-2",
                "font-mono text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                validationError
                  ? "border-red-400 focus-visible:ring-red-400"
                  : "border-input",
              )}
            />
            <FieldHint>
              <span id={`${sourcesId}-hint`}>
                Enter one artifact ID per line, or comma-separated. IDs are the
                26-character ULIDs shown in the artifact detail URL.
              </span>
            </FieldHint>
            {validationError && (
              <p
                id={`${sourcesId}-error`}
                role="alert"
                className="text-xs font-medium text-red-600 dark:text-red-400"
              >
                {validationError}
              </p>
            )}
          </div>

          {/* Scope */}
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={scopeId}>Scope</FieldLabel>
            <input
              id={scopeId}
              name="scope"
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="wiki/concepts/** (optional)"
              aria-describedby={`${scopeId}-hint`}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
            <FieldHint>
              <span id={`${scopeId}-hint`}>
                Optional glob or directory path to scope the compile stage (e.g.{" "}
                <code className="font-mono">wiki/concepts/**</code>).
              </span>
            </FieldHint>
          </div>

          {/* Focus */}
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={focusId}>Focus</FieldLabel>
            <input
              id={focusId}
              name="focus"
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. performance benchmarks (optional)"
              aria-describedby={`${focusId}-hint`}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
            <FieldHint>
              <span id={`${focusId}-hint`}>
                Optional free-text hint to guide the synthesis (e.g. a specific
                question or research angle).
              </span>
            </FieldHint>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={cn(
                "rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-60",
                "hover:bg-primary/90 transition-colors",
              )}
            >
              {isSubmitting ? "Launching…" : "Launch synthesis"}
            </button>
            {submitError && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                Reset form
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: running phase
  // ------------------------------------------------------------------

  if (phase === "running" || (phase === "error" && activeRunId)) {
    return (
      <div
        className={cn("flex flex-col gap-6", className)}
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {phase === "running" ? "Synthesizing…" : "Synthesis failed"}
          </p>
          {activeRunId && (
            <p className="font-mono text-xs text-muted-foreground">
              run_id: {activeRunId}
            </p>
          )}
        </div>

        {activeRunId && (
          // DP3-01: research_synthesis_v1 always produces research artifacts;
          // researchOrigin=true applies amber left-accent to the run progress strip.
          <StageTracker
            runId={activeRunId}
            templateId="research_synthesis_v1"
            status={runStatus}
            currentStage={currentStage}
            variant="full"
            events={events}
            mode="sse"
            researchOrigin
          />
        )}

        {phase === "error" && submitError && (
          <>
            <ErrorBanner message={submitError} />
            <button
              type="button"
              onClick={handleRetry}
              className={cn(
                "self-start rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: complete phase
  // ------------------------------------------------------------------

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-foreground">
          Synthesis complete
        </p>
        {completed?.runId && (
          <p className="font-mono text-xs text-muted-foreground">
            run_id: {completed.runId}
          </p>
        )}
      </div>

      {/*
       * DP4-HC-02 (deferred Phase 4 structural): HandoffChain for the produced-
       * synthesis preview card. Will render a horizontal compact lineage strip
       * (backlinked source artifacts → produced synthesis node) once the
       * GET /api/artifacts/:synthesis_id/lineage endpoint is wired.
       * Handoff Chain manifest §3 row 10 owns this integration.
       */}

      {completed?.artifactId ? (
        <Link
          href={`/research/pages/${completed.artifactId}`}
          className={cn(
            "self-start rounded-md border border-input bg-background px-5 py-2",
            "text-sm font-medium text-foreground",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          View synthesis artifact
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          The synthesis artifact will appear in{" "}
          <Link
            href="/research/pages"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Research pages
          </Link>{" "}
          shortly.
        </p>
      )}

      <button
        type="button"
        onClick={handleRetry}
        className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Start another synthesis
      </button>
    </div>
  );
}
