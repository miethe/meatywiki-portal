"use client";

/**
 * Synthesis Builder — Step 2: Configure
 *
 * Route: /research/synthesis/configure?ids=...
 *
 * Part of the 2-step wizard (ADR-DPI-005 Option A). Wizard state is
 * URL-encoded for resumability:
 *   ?ids=ID1,ID2,...    — selected artifact IDs (from Step 1)
 *
 * Layout:
 *   Left (main column):
 *     SynthesisTypeBento      — type selection (summary/analysis/compare/synthesize)
 *     SynthesisParameterPanel — depth / tone / constraints / scope / focus
 *   Right (lg+): ContextRail with SynthesisScopeRailPanel (full scope summary)
 *
 * Navigation:
 *   "← Back"    → /research/synthesis/select-scope?ids=...
 *   "Launch"    → POST /api/workflows/synthesize → running phase
 *   "Cancel"    → /research/synthesis
 *
 * After successful POST:
 *   Shows StageTracker + run_id (inline, replacing the configure form).
 *   On workflow_completed: link to new synthesis artifact.
 *
 * Tasks: DP4-02d
 * ADR: ADR-DPI-005
 */

import {
  useState,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SynthesisTypeBento,
  SYNTHESIS_TYPES,
  type SynthesisType,
} from "@/components/research/SynthesisTypeBento";
import {
  SynthesisParameterPanel,
  type SynthesisParameters,
} from "@/components/research/SynthesisParameterPanel";
import { SynthesisScopeRailPanel } from "@/components/research/SynthesisScopeRailPanel";
import { ContextRail, type ContextRailTab } from "@/components/layout/ContextRail";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { useSSE } from "@/hooks/useSSE";
import { submitSynthesis } from "@/lib/api/workflows";
import type { WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function decodeIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Stepper (shared with Step 1)
// ---------------------------------------------------------------------------

function WizardStepper({ step }: { step: 1 | 2 }) {
  return (
    <nav aria-label="Synthesis wizard steps" className="flex items-center gap-2">
      {[
        { num: 1, label: "Select sources" },
        { num: 2, label: "Configure" },
      ].map(({ num, label }, index) => {
        const isActive = num === step;
        const isComplete = num < step;

        return (
          <div key={num} className="flex items-center gap-2">
            {index > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  "h-px w-8 shrink-0",
                  isComplete ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div aria-current={isActive ? "step" : undefined} className="flex items-center gap-1.5">
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {num}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Phase types
// ---------------------------------------------------------------------------

type WizardPhase = "configure" | "running" | "complete" | "error";

interface CompletedRun {
  runId: string;
  artifactId?: string | null;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default parameter values
// ---------------------------------------------------------------------------

const DEFAULT_PARAMS: SynthesisParameters = {
  depth: "standard",
  tone: "neutral",
  constraints: "",
  scope: "",
  focus: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SynthesisConfigurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hydrate selected IDs from URL
  const selectedIds = decodeIds(searchParams.get("ids"));

  // Step 2 state
  const [synthesisType, setSynthesisType] = useState<SynthesisType | null>(null);
  const [params, setParams] = useState<SynthesisParameters>(DEFAULT_PARAMS);
  const [typeError, setTypeError] = useState<string | null>(null);

  // Run state
  const [phase, setPhase] = useState<WizardPhase>("configure");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedRun | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunStatus>("pending");
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastProcessedLength, setLastProcessedLength] = useState(0);

  const handleParamsChange = useCallback((next: Partial<SynthesisParameters>) => {
    setParams((prev) => ({ ...prev, ...next }));
  }, []);

  const handleTypeChange = useCallback((type: SynthesisType) => {
    setSynthesisType(type);
    setTypeError(null);
  }, []);

  // Back to Step 1
  const handleBack = useCallback(() => {
    const encoded = selectedIds.join(",");
    router.push(
      encoded
        ? `/research/synthesis/select-scope?ids=${encodeURIComponent(encoded)}`
        : "/research/synthesis/select-scope",
    );
  }, [router, selectedIds]);

  const handleCancel = useCallback(() => {
    router.push("/research/synthesis");
  }, [router]);

  // ------------------------------------------------------------------
  // SSE — open when phase === "running"
  // ------------------------------------------------------------------

  const sseUrl = activeRunId ? `/api/workflows/${activeRunId}/stream` : undefined;

  const { events } = useSSE<SSEWorkflowEvent>({
    url: sseUrl,
    enabled: phase === "running",
    debounceMs: 100,
  });

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const handleTerminalEvent = useCallback(
    (event: SSEWorkflowEvent) => {
      if (event.type === "workflow_completed") {
        const artifactId = event.artifact_id ?? null;
        const runId = event.run_id ?? activeRunId ?? "";
        setCompleted({ runId, artifactId });
        setRunStatus("complete");
        setPhase("complete");
      } else if (event.type === "workflow_failed") {
        setRunStatus("failed");
        setPhase("error");
        setSubmitError(
          event.error ?? "The synthesis workflow failed. Check the workflow log.",
        );
      } else if (event.type === "stage_completed") {
        setCurrentStage((prev) => prev + 1);
      } else if (event.type === "stage_started") {
        setRunStatus("running");
      }
    },
    [activeRunId],
  );

  if (events.length > lastProcessedLength && latestEvent !== null) {
    setLastProcessedLength(events.length);
    handleTerminalEvent(latestEvent);
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!synthesisType) {
      setTypeError("Please select a synthesis type before launching.");
      return;
    }
    if (selectedIds.length === 0) {
      setSubmitError("No source artifacts selected. Go back to Step 1 and select at least one.");
      return;
    }

    setTypeError(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await submitSynthesis({
        sources: selectedIds,
        type: synthesisType,
        depth: params.depth,
        tone: params.tone,
        constraints: params.constraints || undefined,
        scope: params.scope || undefined,
        focus: params.focus || undefined,
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
  }, [synthesisType, selectedIds, params]);

  const handleReset = useCallback(() => {
    setPhase("configure");
    setSubmitError(null);
    setTypeError(null);
    setActiveRunId(null);
    setCompleted(null);
    setCurrentStage(0);
    setRunStatus("pending");
    setLastProcessedLength(0);
  }, []);

  // ------------------------------------------------------------------
  // ContextRail: scope summary tab
  // ------------------------------------------------------------------

  const synthesisTypeLabel =
    synthesisType
      ? SYNTHESIS_TYPES.find((t) => t.id === synthesisType)?.label
      : undefined;

  const scopeTab: ContextRailTab = {
    id: "scope",
    label: "Scope",
    renderContent: () => (
      <SynthesisScopeRailPanel
        selectedIds={selectedIds}
        scope={params.scope}
        focus={params.focus}
        synthesisType={synthesisTypeLabel}
      />
    ),
  };

  // ------------------------------------------------------------------
  // Running phase
  // ------------------------------------------------------------------

  if (phase === "running" || (phase === "error" && activeRunId)) {
    return (
      <div
        className="flex flex-col gap-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Synthesis Builder
          </h1>
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
              onClick={handleReset}
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
  // Complete phase
  // ------------------------------------------------------------------

  if (phase === "complete") {
    return (
      <div className="flex flex-col gap-6" aria-live="polite">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Synthesis Builder
          </h1>
          <p className="text-base font-semibold text-foreground">
            Synthesis complete
          </p>
          {completed?.runId && (
            <p className="font-mono text-xs text-muted-foreground">
              run_id: {completed.runId}
            </p>
          )}
        </div>

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
          onClick={() => router.push("/research/synthesis")}
          className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Start another synthesis
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Configure phase (main render)
  // ------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Synthesis Builder
          </h1>
          <WizardStepper step={2} />
        </div>

        <button
          type="button"
          aria-label="Cancel synthesis wizard"
          onClick={handleCancel}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
          Cancel
        </button>
      </div>

      {/* No sources guard */}
      {selectedIds.length === 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          No source artifacts selected.{" "}
          <button
            type="button"
            onClick={handleBack}
            className="font-medium underline underline-offset-2"
          >
            Go back to Step 1
          </button>{" "}
          to select artifacts.
        </div>
      )}

      {/* Submit errors (pre-existing) */}
      {submitError && phase === "configure" && (
        <ErrorBanner message={submitError} />
      )}

      {/* Two-column layout: form + rail */}
      <div className="flex gap-6">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* --- Synthesis type --- */}
          <section aria-labelledby="configure-type-heading">
            <h2
              id="configure-type-heading"
              className="mb-3 text-base font-medium text-foreground"
            >
              Synthesis type
              <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
            </h2>
            {typeError && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              >
                {typeError}
              </div>
            )}
            <SynthesisTypeBento
              value={synthesisType}
              onChange={handleTypeChange}
            />
          </section>

          {/* --- Parameters --- */}
          <section aria-labelledby="configure-params-heading">
            <h2
              id="configure-params-heading"
              className="mb-3 text-base font-medium text-foreground"
            >
              Parameters
            </h2>
            <SynthesisParameterPanel
              value={params}
              onChange={handleParamsChange}
            />
          </section>

          {/* Step navigation */}
          <div className="flex items-center gap-3 border-t pt-4">
            <button
              type="button"
              aria-label="Back to Step 1: Select sources"
              onClick={handleBack}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedIds.length === 0}
              aria-busy={isSubmitting}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSubmitting ? (
                "Launching…"
              ) : (
                <>
                  Launch synthesis
                  <ArrowRight aria-hidden="true" className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* ContextRail — scope summary */}
        <aside
          aria-label="Scope context"
          className="hidden w-72 shrink-0 lg:block"
        >
          <ContextRail
            customTabs={[scopeTab]}
            ariaLabel="Synthesis scope"
          />
        </aside>
      </div>
    </div>
  );
}
