"use client";

/**
 * ResearchPackageSummary — Step 3 for external_research_v1 wizard flow.
 *
 * Renders when selectedTemplateId === "external_research_v1" in step-3-configure.tsx.
 * The generic Step3Configure component is left completely unchanged.
 *
 * Displays:
 *   - Selected route card (condensed)
 *   - Topic + research question
 *   - Corpus artifact list (titles, truncated if > 5)
 *   - Generated prompt bundle (read-only text block)
 *   - Copy-to-clipboard button (JSON)
 *   - Download button (Markdown)
 *   - Save package toggle
 *   - Handoff CTA:
 *       "Create Package + Await Result" for external routes
 *       "Launch Internal Synthesis" for internal_synthesis
 *
 * On CTA submit: calls POST /api/workflows/external-research with full
 * ExternalResearchParams. On success, navigates to /workflows/{run_id}.
 * On error, shows inline message; wizard stays open.
 *
 * Phase: P3-04 (portal-v2.1-research-workflow-realignment)
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import type { ResearchPackage, ResearchRouteCard } from "./initiation-wizard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResearchPackageSummaryProps {
  researchPackage: ResearchPackage;
  onPackageChange: (patch: Partial<ResearchPackage>) => void;
  onClose: () => void;
  submitError?: string | null;
  onSubmitError: (error: string | null) => void;
}

// ---------------------------------------------------------------------------
// External venue check
// ---------------------------------------------------------------------------

const INTERNAL_ROUTES = new Set(["internal_synthesis"]);

function isExternalRoute(route: string | null | undefined): boolean {
  if (!route) return false;
  return !INTERNAL_ROUTES.has(route);
}

// ---------------------------------------------------------------------------
// Prompt bundle assembly
// ---------------------------------------------------------------------------

function assemblePromptBundle(pkg: ResearchPackage): string {
  const bundle = {
    topic: pkg.topic,
    research_question: pkg.research_question,
    background_context: pkg.background_context || null,
    selected_venue: pkg.selected_route?.route ?? "auto",
    desired_output: pkg.desired_output,
    corpus_artifact_ids: pkg.selected_artifact_ids,
    prompt_preview: pkg.selected_route?.prompt_preview ?? null,
    rationale: pkg.selected_route?.rationale ?? null,
  };
  return JSON.stringify(bundle, null, 2);
}

function assembleMarkdownBundle(pkg: ResearchPackage): string {
  const lines: string[] = [
    `# Research Package: ${pkg.topic}`,
    "",
    `## Research Question`,
    "",
    pkg.research_question,
    "",
  ];

  if (pkg.background_context) {
    lines.push("## Background Context", "", pkg.background_context, "");
  }

  if (pkg.selected_route) {
    lines.push(
      "## Selected Venue",
      "",
      `**Venue**: ${pkg.selected_route.route}`,
      `**Score**: ${Math.round(pkg.selected_route.score * 100)}%`,
      `**Rationale**: ${pkg.selected_route.rationale}`,
      `**Expected Output**: ${pkg.selected_route.expected_output}`,
      "",
      "### Prompt Preview",
      "",
      "```",
      pkg.selected_route.prompt_preview,
      "```",
      "",
    );
  }

  if (pkg.selected_artifact_ids.length > 0) {
    lines.push(
      "## Corpus Artifacts",
      "",
      ...pkg.selected_artifact_ids.map((id) => `- ${id}`),
      "",
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Condensed route card
// ---------------------------------------------------------------------------

function CondensedRouteCard({ card }: { card: ResearchRouteCard }) {
  const pct = Math.round(card.score * 100);

  const VENUE_LABELS: Record<string, string> = {
    chatgpt: "ChatGPT Deep Research",
    chatgpt_deep_research: "ChatGPT Deep Research",
    perplexity: "Perplexity",
    gemini: "Gemini Research",
    notebooklm: "NotebookLM",
    gemini_notebooklm: "NotebookLM",
    internal_synthesis: "Internal Synthesis",
    custom_manual: "Custom / Manual",
  };

  const label = VENUE_LABELS[card.route] ?? card.route;
  const isInternal = !isExternalRoute(card.route);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border p-3",
        isInternal ? "bg-purple-50 dark:bg-purple-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
          isInternal
            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
        )}
      >
        {pct}%
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{card.expected_output}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corpus list (truncated to 5 with "show more")
// ---------------------------------------------------------------------------

function CorpusList({ artifactIds }: { artifactIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE_AT = 5;
  const shown = expanded ? artifactIds : artifactIds.slice(0, TRUNCATE_AT);
  const hasMore = artifactIds.length > TRUNCATE_AT;

  if (artifactIds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No corpus artifacts selected. The router will use venue defaults.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {shown.map((id) => (
        <div
          key={id}
          className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5"
        >
          <div aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
        </div>
      ))}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-xs text-primary hover:text-primary/80 underline-offset-2 hover:underline transition-colors"
        >
          +{artifactIds.length - TRUNCATE_AT} more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

interface ExternalResearchApiParams {
  topic: string;
  research_question: string;
  project: string[];
  domain: string[];
  selected_artifact_ids: string[];
  route_preference: string;
  desired_output: string;
  freshness_window: string;
  citation_strictness: string;
  save_prompt_package: boolean;
  background_context?: string;
}

interface CreateRunResponse {
  run_id: string;
  task_id: string;
  package_artifact_id: string | null;
  status: string;
}

async function createExternalResearchRun(
  pkg: ResearchPackage,
): Promise<CreateRunResponse> {
  const body: ExternalResearchApiParams = {
    topic: pkg.topic,
    research_question: pkg.research_question,
    project: pkg.project,
    domain: pkg.domain,
    selected_artifact_ids: pkg.selected_artifact_ids,
    route_preference: pkg.selected_route?.route ?? "auto",
    desired_output: pkg.desired_output,
    freshness_window: "current",
    citation_strictness: "advisory",
    save_prompt_package: pkg.save_package,
    ...(pkg.background_context ? { background_context: pkg.background_context } : {}),
  };

  return apiFetch<CreateRunResponse>("/workflows/external-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// ResearchPackageSummary
// ---------------------------------------------------------------------------

export function ResearchPackageSummary({
  researchPackage,
  onPackageChange,
  onClose,
  submitError,
  onSubmitError,
}: ResearchPackageSummaryProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const selectedRoute = researchPackage.selected_route;
  const isExternal = isExternalRoute(selectedRoute?.route);
  const ctaLabel = isExternal ? "Create Package + Await Result" : "Launch Internal Synthesis";

  const jsonBundle = useMemo(
    () => assemblePromptBundle(researchPackage),
    [researchPackage],
  );

  const markdownBundle = useMemo(
    () => assembleMarkdownBundle(researchPackage),
    [researchPackage],
  );

  // Copy to clipboard
  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonBundle);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback: select the textarea
    }
  }, [jsonBundle]);

  // Download Markdown
  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([markdownBundle], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-package-${researchPackage.topic.replace(/\s+/g, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdownBundle, researchPackage.topic]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!selectedRoute) {
      onSubmitError("No venue route selected. Go back and select a route.");
      return;
    }
    setIsSubmitting(true);
    onSubmitError(null);

    try {
      const result = await createExternalResearchRun(researchPackage);
      router.push(`/workflows/${result.run_id}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create research run.";
      onSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [researchPackage, selectedRoute, onSubmitError, router, onClose]);

  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Review & Launch</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Review your research package before creating the run.
        </p>
      </div>

      {/* Selected route */}
      {selectedRoute ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Selected Venue
          </p>
          <CondensedRouteCard card={selectedRoute} />
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          No venue route selected. Go back to Step 2 to choose a route.
        </div>
      )}

      {/* Topic + question */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Topic
          </p>
          <p className="text-sm font-medium text-foreground">{researchPackage.topic}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Desired Output
          </p>
          <p className="text-sm font-medium text-foreground capitalize">
            {researchPackage.desired_output.replace("_", " ")}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Research Question
        </p>
        <p className="text-sm text-foreground leading-relaxed">{researchPackage.research_question}</p>
      </div>

      {/* Corpus */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Corpus ({researchPackage.selected_artifact_ids.length}{" "}
          {researchPackage.selected_artifact_ids.length === 1 ? "artifact" : "artifacts"})
        </p>
        <CorpusList artifactIds={researchPackage.selected_artifact_ids} />
      </div>

      {/* Prompt bundle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prompt Bundle
          </p>
          <div className="flex items-center gap-2">
            {/* Copy JSON */}
            <button
              type="button"
              onClick={() => void handleCopyJson()}
              aria-label="Copy prompt bundle as JSON"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
                "border border-input bg-background transition-colors",
                copySuccess
                  ? "border-emerald-400 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copySuccess ? "Copied!" : "Copy JSON"}
            </button>

            {/* Download Markdown */}
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              aria-label="Download prompt bundle as Markdown"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
                "border border-input bg-background text-muted-foreground",
                "hover:text-foreground hover:bg-accent transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download .md
            </button>
          </div>
        </div>

        <pre
          className={cn(
            "max-h-[180px] overflow-y-auto rounded-md",
            "border border-border bg-muted/40 px-3 py-2.5",
            "text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap",
          )}
          aria-label="Prompt bundle JSON preview"
        >
          {jsonBundle}
        </pre>
      </div>

      {/* Save package toggle */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
        <input
          id="save-package-step3"
          type="checkbox"
          checked={researchPackage.save_package}
          onChange={(e) => onPackageChange({ save_package: e.target.checked })}
          className="mt-0.5 size-4 rounded border-input text-foreground focus:ring-ring"
        />
        <div className="flex-1">
          <label
            htmlFor="save-package-step3"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Save prompt package to vault
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Creates a prompt package artifact in the vault with graph edges to
            corpus artifacts.
          </p>
        </div>
      </div>

      {/* Submission error */}
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}

      {/* Handoff CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !selectedRoute}
          aria-label={ctaLabel}
          className={cn(
            "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold",
            "transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none disabled:opacity-50",
            isExternal
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-purple-700 text-white hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700",
          )}
        >
          {isSubmitting ? (
            <>
              <svg
                aria-hidden="true"
                className="size-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Creating run…
            </>
          ) : (
            ctaLabel
          )}
        </button>
      </div>
    </div>
  );
}
