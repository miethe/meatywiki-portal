"use client";

/**
 * RoutingRecommendationCard — displays a rule-based workflow routing recommendation
 * for an artifact.
 *
 * Behavior:
 *   - Calls GET /api/artifacts/:artifactId/routing-recommendation on mount.
 *   - When the response has template=null: renders nothing (hidden).
 *   - When a recommendation is present: renders a card with:
 *       - Recommended template name (human-readable label)
 *       - Rationale text
 *       - "Start Workflow" button — opens the Quick Add modal pre-seeded with
 *         the recommended template, or navigates to the workflow initiation flow
 *         (Screen A, deferred to v1.5 — falls back to the Quick Add modal for now).
 *       - "View Prompts" toggle — expands a section that fetches + renders
 *         the recommended template's prompts with placeholder substitution and
 *         per-prompt copy buttons. (FE-06)
 *   - Loading state: skeleton pulse.
 *   - Error state: silent (card hidden on API errors to avoid noise on pages
 *     that embed it as a non-critical widget).
 *
 * WCAG 2.1 AA: card has role="region" + aria-label; button has descriptive text.
 *
 * Design spec: Portal v1.5 Phase 1 (P1.5-1-06).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getRoutingRecommendation } from "@/lib/api/artifacts";
import type { RoutingRecommendation } from "@/lib/api/artifacts";
import {
  getWorkflowTemplate,
  listWorkflowTemplates,
} from "@/lib/api/workflow-templates";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Template label map — human-readable names for template slugs
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: Record<string, string> = {
  research_synthesis_v1: "Research Synthesis",
  verification_workflow_v1: "Verification Workflow",
  compile_v1: "Full Compile",
  lint_scope_v1: "Lint Scope",
  source_ingest_v1: "Source Ingest",
};

function templateLabel(slug: string): string {
  return TEMPLATE_LABELS[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no external dep)
// ---------------------------------------------------------------------------

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function LightBulbIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function ChevronDownIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 animate-spin text-amber-600 dark:text-amber-400"
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

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RoutingCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading routing recommendation"
      aria-busy="true"
      className="animate-pulse rounded-md border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-3.5 w-32 rounded bg-muted" />
      </div>
      <div className="h-3 w-full rounded bg-muted mb-1.5" />
      <div className="h-3 w-4/5 rounded bg-muted mb-3" />
      <div className="h-8 w-36 rounded-md bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt extraction from YAML content
// ---------------------------------------------------------------------------

interface TemplatePrompt {
  label: string;
  text: string;
}

/**
 * Extract prompts from a template's yaml_content.
 *
 * Looks for a top-level `prompts:` block with entries of the form:
 *   prompts:
 *     - label: "Some label"
 *       text: |
 *         Multi-line prompt text here.
 *         Can span multiple lines.
 *     - label: "Another"
 *       text: "Single line text"
 *
 * Falls back to [] when no prompts block is found or parsing fails.
 */
function extractPrompts(yaml: string): TemplatePrompt[] {
  try {
    const lines = yaml.split("\n");
    const prompts: TemplatePrompt[] = [];
    let inPromptsSection = false;
    let currentPrompt: Partial<TemplatePrompt> | null = null;
    let inTextBlock = false;
    let textBlockLines: string[] = [];
    let textBlockIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect the prompts: section start
      if (trimmed === "prompts:") {
        inPromptsSection = true;
        continue;
      }

      // A new top-level key (not indented, not a list item) ends the section
      if (
        inPromptsSection &&
        /^[a-z_][a-z_0-9]*:\s*/.test(trimmed) &&
        !line.match(/^\s/)
      ) {
        inPromptsSection = false;
        // Flush current prompt
        if (currentPrompt) {
          if (inTextBlock) {
            currentPrompt.text = textBlockLines.join("\n").trimEnd();
            inTextBlock = false;
            textBlockLines = [];
          }
          if (currentPrompt.label !== undefined && currentPrompt.text !== undefined) {
            prompts.push(currentPrompt as TemplatePrompt);
          }
          currentPrompt = null;
        }
      }

      if (!inPromptsSection) continue;

      // Handle multi-line text block continuation
      if (inTextBlock) {
        // If line is less indented than the block, the block has ended
        const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (trimmed === "" || lineIndent >= textBlockIndent) {
          // Blank lines are included in block; add with relative indent stripped
          textBlockLines.push(trimmed === "" ? "" : line.slice(textBlockIndent));
          continue;
        } else {
          // Block ended — flush
          if (currentPrompt) {
            currentPrompt.text = textBlockLines.join("\n").trimEnd();
          }
          inTextBlock = false;
          textBlockLines = [];
          // Fall through to process this line normally
        }
      }

      // New list item / new prompt
      if (trimmed.startsWith("- label:")) {
        // Flush previous prompt
        if (currentPrompt?.label !== undefined && currentPrompt.text !== undefined) {
          prompts.push(currentPrompt as TemplatePrompt);
        }
        currentPrompt = {
          label: trimmed.replace("- label:", "").trim().replace(/^["']|["']$/g, ""),
        };
        continue;
      }

      if (currentPrompt) {
        // label on its own line within the item
        const labelMatch = trimmed.match(/^label:\s*(.*)$/);
        if (labelMatch) {
          currentPrompt.label = labelMatch[1].trim().replace(/^["']|["']$/g, "");
          continue;
        }

        // text: | or text: > (block scalar) or text: "inline"
        const textMatch = trimmed.match(/^text:\s*(.*)$/);
        if (textMatch) {
          const rest = textMatch[1].trim();
          if (rest === "|" || rest === ">") {
            // Multi-line block scalar — collect subsequent lines
            inTextBlock = true;
            textBlockLines = [];
            // Determine indent level from next line
            const nextLine = lines[i + 1] ?? "";
            textBlockIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 2;
          } else {
            // Inline text — strip surrounding quotes
            currentPrompt.text = rest.replace(/^["']|["']$/g, "");
          }
          continue;
        }
      }
    }

    // Flush any trailing prompt
    if (currentPrompt) {
      if (inTextBlock && textBlockLines.length > 0) {
        currentPrompt.text = textBlockLines.join("\n").trimEnd();
      }
      if (currentPrompt.label !== undefined && currentPrompt.text !== undefined) {
        prompts.push(currentPrompt as TemplatePrompt);
      }
    }

    return prompts;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Placeholder substitution
// ---------------------------------------------------------------------------

interface ArtifactContext {
  title?: string;
  type?: string;
  tags?: string[];
}

function substitutePlaceholders(text: string, ctx: ArtifactContext): string {
  return text
    .replace(/\{\{artifact_title\}\}/g, ctx.title ?? "")
    .replace(/\{\{artifact_type\}\}/g, ctx.type ?? "")
    .replace(/\{\{tags\}\}/g, (ctx.tags ?? []).join(", "));
}

// ---------------------------------------------------------------------------
// CopyButton — per-prompt copy with brief "Copied!" feedback
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : "Copy prompt text"}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1",
        "text-xs font-medium transition-colors",
        copied
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1",
      )}
    >
      {copied ? (
        <>
          <CheckIcon />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <CopyIcon />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PromptsPanel — expanded panel for the "View Prompts" toggle
// ---------------------------------------------------------------------------

type PromptsPanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; template: WorkflowTemplate; prompts: TemplatePrompt[] }
  | { status: "error"; error: string };

interface PromptsPanelProps {
  templateSlug: string;
  artifactContext: ArtifactContext;
}

function PromptsPanel({ templateSlug, artifactContext }: PromptsPanelProps) {
  const [state, setState] = useState<PromptsPanelState>({ status: "idle" });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setState({ status: "loading" });

    // Try fetching by slug as ID first; fall back to listing and filtering by slug.
    void (async () => {
      try {
        let template: WorkflowTemplate | null = null;

        // Attempt direct fetch by slug (some backends accept slug as ID)
        try {
          template = await getWorkflowTemplate(templateSlug);
        } catch {
          // Slug is not a valid ID — fall back to listing
          const all = await listWorkflowTemplates();
          template = all.find((t) => t.slug === templateSlug) ?? null;
        }

        if (!template) {
          setState({ status: "error", error: "Template not found." });
          return;
        }

        const prompts = extractPrompts(template.yaml_content);
        setState({ status: "loaded", template, prompts });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load template.";
        setState({ status: "error", error: message });
      }
    })();
  }, [templateSlug]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground py-2">
        <SpinnerIcon />
        <span>Loading prompts…</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-3 rounded-md bg-amber-100/60 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        {state.error}
      </div>
    );
  }

  const { prompts } = state;

  if (prompts.length === 0) {
    return (
      <div className="mt-3 rounded-md bg-amber-100/60 dark:bg-amber-900/10 px-3 py-2 text-xs text-muted-foreground">
        No prompts available for this template.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3" role="list" aria-label="Template prompts">
      {prompts.map((prompt, index) => {
        const substituted = substitutePlaceholders(prompt.text, artifactContext);
        return (
          <div
            key={index}
            role="listitem"
            className="rounded-md border border-amber-200/80 dark:border-amber-800/40 bg-white/60 dark:bg-black/20 overflow-hidden"
          >
            {/* Prompt header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-amber-200/60 dark:border-amber-800/30 bg-amber-50/80 dark:bg-amber-950/20">
              <span className="text-xs font-medium text-amber-800 dark:text-amber-300 truncate">
                {prompt.label}
              </span>
              <CopyButton text={substituted} />
            </div>
            {/* Prompt text */}
            <pre className="px-3 py-2.5 text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono leading-relaxed overflow-auto max-h-40">
              {substituted}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoutingRecommendationCardProps {
  /** Artifact ID to fetch the recommendation for. */
  artifactId: string;
  /**
   * Artifact title — used for placeholder substitution in prompts.
   * Optional; when omitted, {{artifact_title}} substitutes to empty string.
   */
  artifactTitle?: string;
  /**
   * Artifact type — used for placeholder substitution in prompts.
   * Optional; when omitted, {{artifact_type}} substitutes to empty string.
   */
  artifactType?: string;
  /**
   * Artifact tags — used for placeholder substitution in prompts.
   * Optional; when omitted, {{tags}} substitutes to empty string.
   */
  artifactTags?: string[];
  /**
   * Callback invoked when the user clicks "Start Workflow".
   * Receives the recommended template slug.
   * When not provided, the button logs a console warning (useful during dev).
   */
  onStart?: (templateSlug: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// RoutingRecommendationCard
// ---------------------------------------------------------------------------

type CardState =
  | { status: "loading" }
  | { status: "no_match" }
  | { status: "match"; recommendation: RoutingRecommendation }
  | { status: "error"; error: string };

export function RoutingRecommendationCard({
  artifactId,
  artifactTitle,
  artifactType,
  artifactTags,
  onStart,
  className,
}: RoutingRecommendationCardProps) {
  const [cardState, setCardState] = useState<CardState>({ status: "loading" });
  const [promptsExpanded, setPromptsExpanded] = useState(false);

  const artifactContext: ArtifactContext = {
    title: artifactTitle,
    type: artifactType,
    tags: artifactTags,
  };

  const fetchRecommendation = useCallback(async () => {
    setCardState({ status: "loading" });
    try {
      const rec = await getRoutingRecommendation(artifactId);
      if (!rec.template) {
        setCardState({ status: "no_match" });
      } else {
        setCardState({ status: "match", recommendation: rec });
      }
    } catch (err) {
      // Silent error — don't render a broken card for a non-critical widget.
      const message =
        err instanceof Error ? err.message : "Failed to load recommendation";
      setCardState({ status: "error", error: message });
    }
  }, [artifactId]);

  useEffect(() => {
    void fetchRecommendation();
  }, [fetchRecommendation]);

  // Loading state
  if (cardState.status === "loading") {
    return <RoutingCardSkeleton />;
  }

  // No match, error, or hidden states — render nothing
  if (cardState.status === "no_match" || cardState.status === "error") {
    return null;
  }

  const { recommendation } = cardState;
  const label = templateLabel(recommendation.template!);

  function handleStart() {
    if (!recommendation.template) return;
    if (onStart) {
      onStart(recommendation.template);
    } else {
      // Dev fallback — Screen A wizard (deferred to v1.5).
      console.warn(
        "[RoutingRecommendationCard] onStart not wired — template:",
        recommendation.template,
      );
    }
  }

  function handleTogglePrompts() {
    setPromptsExpanded((prev) => !prev);
  }

  return (
    <section
      role="region"
      aria-label="Workflow recommendation"
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <LightBulbIcon />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Recommended Workflow
        </span>
      </div>

      {/* Template name */}
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>

      {/* Rationale */}
      {recommendation.rationale && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {recommendation.rationale}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Start button */}
        <button
          type="button"
          onClick={handleStart}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "text-xs font-medium",
            "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
            "transition-colors",
          )}
          aria-label={`Start ${label} workflow`}
        >
          Start Workflow
          <ArrowRightIcon />
        </button>

        {/* View Prompts toggle */}
        <button
          type="button"
          onClick={handleTogglePrompts}
          aria-expanded={promptsExpanded}
          aria-controls="routing-card-prompts-panel"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "text-xs font-medium",
            "border border-amber-300 dark:border-amber-700",
            promptsExpanded
              ? "bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-transparent text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/20",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
            "transition-colors",
          )}
        >
          {promptsExpanded ? "Hide Prompts" : "View Prompts"}
          <ChevronDownIcon expanded={promptsExpanded} />
        </button>
      </div>

      {/* Prompts panel */}
      {promptsExpanded && recommendation.template && (
        <div id="routing-card-prompts-panel">
          <PromptsPanel
            templateSlug={recommendation.template}
            artifactContext={artifactContext}
          />
        </div>
      )}
    </section>
  );
}
