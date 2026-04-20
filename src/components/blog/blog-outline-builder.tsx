"use client";

/**
 * BlogOutlineBuilder — scope selection + outline generation.
 *
 * Triggers a research_synthesis_v1-derived outline workflow.
 * If the underlying compile template is not live, the trigger is stubbed
 * and a static outline structure is rendered per Stitch design.
 *
 * Phases:
 *   "form"     — user fills topic, scope (optional artifact IDs), submits.
 *   "running"  — shows StageTracker compact while workflow runs (stubbed).
 *   "complete" — renders the generated outline (stubbed static structure).
 *   "error"    — inline error with retry.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-outline-builder.html (ID: 9107e33c0ca2490c90d9101f5816b8a8)
 */

import { useState, useCallback, useId } from "react";
import { Loader2, AlertCircle, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageTracker } from "@/components/workflow/stage-tracker";
import type { WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutlinePhase = "form" | "running" | "complete" | "error";

interface OutlineSection {
  heading: string;
  bullets: string[];
}

interface GeneratedOutline {
  title: string;
  sections: OutlineSection[];
}

// ---------------------------------------------------------------------------
// Static outline template (rendered when workflow completes / stub)
// ---------------------------------------------------------------------------

function buildStaticOutline(topic: string): GeneratedOutline {
  return {
    title: topic || "Blog Post Outline",
    sections: [
      {
        heading: "Introduction",
        bullets: [
          "Hook: why this topic matters",
          "Brief overview of what the reader will learn",
          "Context and scope",
        ],
      },
      {
        heading: "Background & Context",
        bullets: [
          "Key definitions and concepts",
          "Historical context or prior work",
          "Current state of the field",
        ],
      },
      {
        heading: "Core Analysis",
        bullets: [
          "Main argument or thesis",
          "Supporting evidence (3–5 points)",
          "Counterarguments addressed",
        ],
      },
      {
        heading: "Synthesis & Implications",
        bullets: [
          "What the evidence tells us",
          "Practical takeaways",
          "Open questions or future directions",
        ],
      },
      {
        heading: "Conclusion",
        bullets: [
          "Summary of key points",
          "Call to action or next step",
          "Final thought / memorable closing",
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Outline display
// ---------------------------------------------------------------------------

function OutlineDisplay({ outline }: { outline: GeneratedOutline }) {
  return (
    <div
      aria-label="Generated outline"
      className="flex flex-col gap-4 rounded-md border bg-card p-4"
    >
      <h2 className="text-base font-semibold text-foreground">{outline.title}</h2>

      <ol
        role="list"
        className="flex flex-col gap-4"
        aria-label="Outline sections"
      >
        {outline.sections.map((section, idx) => (
          <li key={section.heading} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {idx + 1}
              </span>
              <h3 className="text-sm font-semibold text-foreground">
                {section.heading}
              </h3>
            </div>
            <ul
              role="list"
              className="ml-7 flex flex-col gap-1"
              aria-label={`${section.heading} bullets`}
            >
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-0.5 size-3 shrink-0 text-muted-foreground/50"
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlogOutlineBuilder
// ---------------------------------------------------------------------------

export interface BlogOutlineBuilderProps {
  className?: string;
}

export function BlogOutlineBuilder({ className }: BlogOutlineBuilderProps) {
  const topicId = useId();
  const scopeId = useId();

  const [phase, setPhase] = useState<OutlinePhase>("form");
  const [topic, setTopic] = useState("");
  const [scopeInput, setScopeInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunStatus>("pending");
  const [outline, setOutline] = useState<GeneratedOutline | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      if (!topic.trim()) {
        setValidationError("Topic is required.");
        return;
      }

      setPhase("running");
      setSubmitError(null);

      try {
        // Stub: simulate a workflow run
        const stubRunId = `blog-outline-${Date.now()}`;
        setRunId(stubRunId);
        setRunStatus("running");

        // Simulate workflow completing after 2s
        await new Promise<void>((resolve) => setTimeout(resolve, 2_000));

        setRunStatus("complete");
        const generated = buildStaticOutline(topic.trim());
        setOutline(generated);
        setPhase("complete");
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Outline generation failed",
        );
        setPhase("error");
      }
    },
    [topic],
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setTopic("");
    setScopeInput("");
    setRunId(null);
    setRunStatus("pending");
    setOutline(null);
    setSubmitError(null);
    setValidationError(null);
  }, []);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {phase === "form" && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          aria-label="Blog outline builder"
          noValidate
          className="flex flex-col gap-4"
        >
          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={topicId} className="text-sm font-medium text-foreground">
              Topic <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <input
              id={topicId}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="E.g. 'The future of AI-assisted writing'"
              aria-required="true"
              aria-invalid={!!validationError}
              aria-describedby={validationError ? `${topicId}-error` : undefined}
              className={cn(
                "rounded-md border bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "transition-colors",
                validationError && "border-destructive",
              )}
            />
            {validationError && (
              <p
                id={`${topicId}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {validationError}
              </p>
            )}
          </div>

          {/* Scope (optional artifact IDs) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={scopeId} className="text-sm font-medium text-foreground">
              Source artifacts{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional — one ID per line)
              </span>
            </label>
            <textarea
              id={scopeId}
              value={scopeInput}
              onChange={(e) => setScopeInput(e.target.value)}
              placeholder={"01HXYZ000000001\n01HXYZ000000002"}
              rows={4}
              aria-label="Source artifact IDs, one per line"
              className={cn(
                "min-h-[80px] w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "transition-colors",
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              Scope to specific research artifacts. Leave blank to use all
              available research pages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-md border bg-foreground px-4 text-sm font-medium text-background sm:h-9 sm:min-h-0",
                "transition-colors hover:bg-foreground/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <FileText aria-hidden="true" className="size-4" />
              Generate outline
            </button>
          </div>
        </form>
      )}

      {phase === "running" && runId && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border bg-card p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              Generating outline for{" "}
              <span className="italic">&ldquo;{topic}&rdquo;</span>…
            </p>
            <StageTracker
              runId={runId}
              templateId="research_synthesis_v1"
              status={runStatus}
              currentStage={1}
              variant="compact"
            />
          </div>
        </div>
      )}

      {phase === "complete" && outline && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Outline generated for{" "}
              <span className="italic">&ldquo;{topic}&rdquo;</span>
            </p>
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground",
                "transition-colors hover:text-foreground hover:bg-accent/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              New outline
            </button>
          </div>
          <OutlineDisplay outline={outline} />
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
          >
            <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Outline generation failed
              </p>
              {submitError && (
                <p className="mt-1 text-xs text-muted-foreground">{submitError}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 self-start rounded-md border px-3 text-sm font-medium",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <Loader2 aria-hidden="true" className="size-3.5" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
