"use client";

/**
 * PromptPackagePreview — Step 3 "Confirm and Handoff" panel of the external-
 * research wizard.
 *
 * Reads wizard state via useWizardStateContext(). Renders:
 *   1. Package summary card (topic, question, venue details, optional fields).
 *   2. Three action buttons:
 *      - Copy to Clipboard — copies a markdown summary; shows transient "Copied" state.
 *      - Download as JSON  — triggers a Blob download of the full package.
 *      - Handoff           — calls actions.handoff() → POST /api/workflows/external-research
 *                             → dispatches SUBMIT_START / SUBMIT_SUCCESS / SUBMIT_ERROR.
 *                             On success, redirects to /workflows/{run_id}.
 *   3. Back button — dispatches GO_BACK (Step 3 → Step 2 per reducer).
 *
 * No new hook actions were needed:
 *   - is_submitting already exists (WizardState line 116).
 *   - actions.handoff already exists (UseWizardResult line 372).
 *   - SUBMIT_START / SUBMIT_SUCCESS / SUBMIT_ERROR already exist (WizardAction lines 138-140).
 *   - GO_BACK for Step 3 → Step 2 is handled by the reducer (lines 276-282).
 *
 * Redirect: useRouter().push(`/workflows/${run_response.run_id}`)
 * Endpoint:  POST /api/workflows/external-research (called inside actions.handoff)
 * Run detail route: /workflows/[runId]/page.tsx → WorkflowViewerScreen
 *
 * P4-05 (audit-wave-2-phase-4).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";
import {
  ArrowLeft,
  Clipboard,
  ClipboardCheck,
  Download,
  Rocket,
} from "lucide-react";
import type { RouteCard } from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Helpers — slugify for filename
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Helpers — build clipboard markdown
// ---------------------------------------------------------------------------

function buildMarkdownSummary(
  fields: {
    topic: string;
    research_question: string;
    project: string[];
    domain: string[];
    route_preference: string;
    desired_output: string;
    freshness_window: string;
    citation_strictness: string;
  },
  venueCard: RouteCard | null,
  selectedVenue: string,
): string {
  const lines: string[] = [
    `# Research Package: ${fields.topic}`,
    "",
    `**Research Question:** ${fields.research_question}`,
    "",
    "## Venue",
    `- Route: \`${selectedVenue}\``,
  ];

  if (venueCard) {
    const pct = Math.round(venueCard.score * 100);
    lines.push(`- Suitability Score: ${pct}%`);
    lines.push(`- Expected Output: ${venueCard.expected_output}`);
  }

  lines.push("", "## Package Details");

  if (fields.project.length > 0) {
    lines.push(`- Projects: ${fields.project.join(", ")}`);
  }
  if (fields.domain.length > 0) {
    lines.push(`- Domains: ${fields.domain.join(", ")}`);
  }

  lines.push(`- Route Preference: ${fields.route_preference}`);
  lines.push(`- Desired Output: ${fields.desired_output}`);
  lines.push(`- Freshness Window: ${fields.freshness_window}`);
  lines.push(`- Citation Strictness: ${fields.citation_strictness}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sub-component — section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — detail row
// ---------------------------------------------------------------------------

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-xs text-right text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — tag pill list
// ---------------------------------------------------------------------------

interface TagListProps {
  tags: string[];
  label: string;
}

function TagList({ tags, label }: TagListProps) {
  if (tags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">None specified</p>
    );
  }
  return (
    <div role="list" aria-label={label} className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          role="listitem"
          className={cn(
            "inline-flex items-center rounded-full border border-border bg-accent/30",
            "px-2.5 py-0.5 text-[11px] font-medium text-foreground/80",
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — score bar (reuse pattern from VenueCard)
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const fillClass =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-400"
        : "bg-rose-400";
  const badgeClass =
    pct >= 70
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : pct >= 40
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

  return (
    <div className="flex items-center gap-2.5">
      <div
        role="meter"
        aria-label="Suitability score"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          badgeClass,
        )}
        aria-hidden="true"
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function SpinnerIcon({
  className,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptPackagePreview() {
  const router = useRouter();
  const { state, dispatch, actions } = useWizardStateContext();
  const {
    package_fields,
    route_cards,
    selected_venue,
    run_response,
    is_submitting,
    error,
    error_scope,
  } = state;

  // Transient copy feedback state
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After a successful handoff, redirect to the workflow run detail page.
  // run_response is set by SUBMIT_SUCCESS — watch for it.
  useEffect(() => {
    if (run_response !== null) {
      router.push(`/workflows/${run_response.run_id}`);
    }
  }, [run_response, router]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // Resolved venue card from route_cards — never assume selected_venue is a full object.
  const resolvedCard: RouteCard | null =
    selected_venue !== null && route_cards !== null
      ? (route_cards.find((c) => c.route === selected_venue) ?? null)
      : null;

  // -------------------------------------------------------------------------
  // Clipboard
  // -------------------------------------------------------------------------

  const handleCopy = useCallback(async () => {
    const md = buildMarkdownSummary(
      {
        topic: package_fields.topic as string,
        research_question: package_fields.research_question as string,
        project: package_fields.project as string[],
        domain: package_fields.domain as string[],
        route_preference: package_fields.route_preference as string,
        desired_output: package_fields.desired_output as string,
        freshness_window: package_fields.freshness_window as string,
        citation_strictness: package_fields.citation_strictness as string,
      },
      resolvedCard,
      selected_venue ?? "unknown",
    );

    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — degrade silently (the button reverts naturally)
    }
  }, [package_fields, resolvedCard, selected_venue]);

  // -------------------------------------------------------------------------
  // JSON download
  // -------------------------------------------------------------------------

  const handleDownload = useCallback(() => {
    const payload = {
      package: {
        topic: package_fields.topic,
        research_question: package_fields.research_question,
        project: package_fields.project,
        domain: package_fields.domain,
        route_preference: package_fields.route_preference,
        desired_output: package_fields.desired_output,
        freshness_window: package_fields.freshness_window,
        citation_strictness: package_fields.citation_strictness,
        save_prompt_package: package_fields.save_prompt_package,
      },
      selected_venue,
      route_cards,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const topicSlug = slugify(package_fields.topic as string) || "package";
    a.href = url;
    a.download = `research-package-${topicSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [package_fields, selected_venue, route_cards]);

  // -------------------------------------------------------------------------
  // Handoff
  // -------------------------------------------------------------------------

  const handleHandoff = useCallback(() => {
    if (is_submitting) return;
    void actions.handoff();
  }, [is_submitting, actions]);

  // -------------------------------------------------------------------------
  // Back navigation
  // -------------------------------------------------------------------------

  const handleGoBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  const topic = package_fields.topic as string;
  const researchQuestion = package_fields.research_question as string;
  const projects = package_fields.project as string[];
  const domains = package_fields.domain as string[];
  const routePreference = package_fields.route_preference as string;
  const desiredOutput = package_fields.desired_output as string;
  const freshnessWindow = package_fields.freshness_window as string;
  const citationStrictness = package_fields.citation_strictness as string;

  const showSubmitError = error !== null && error_scope === "submit";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col gap-8"
      aria-label="Confirm and handoff — Step 3"
    >
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Confirm Research Package
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the assembled package before handing off to the selected venue.
          You can copy or download the package summary for external use.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Package summary card                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          "rounded-xl border-2 border-border bg-card",
          "divide-y divide-border/60",
        )}
        aria-label="Research package summary"
      >
        {/* Primary fields */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Topic */}
          <div>
            <SectionLabel>Topic</SectionLabel>
            <p className="text-base font-semibold text-foreground leading-snug">
              {topic || <span className="text-muted-foreground italic">Untitled</span>}
            </p>
          </div>

          {/* Research Question */}
          <div>
            <SectionLabel>Research Question</SectionLabel>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {researchQuestion || (
                <span className="text-muted-foreground italic">
                  No question specified
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Selected venue */}
        <div className="px-5 py-4">
          <SectionLabel>Selected Venue</SectionLabel>
          {selected_venue === null ? (
            <p className="text-xs text-muted-foreground italic">
              No venue selected
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-border bg-accent/30 px-2.5 py-0.5 text-xs font-semibold font-mono text-foreground/90">
                  {selected_venue}
                </span>
              </div>

              {resolvedCard !== null && (
                <>
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Suitability
                    </p>
                    <ScoreBar score={resolvedCard.score} />
                  </div>
                  <div>
                    <p className="mb-0.5 text-[11px] text-muted-foreground">
                      Expected Output
                    </p>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {resolvedCard.expected_output}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tags — projects + domains */}
        <div className="px-5 py-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <SectionLabel>Projects</SectionLabel>
            <TagList tags={projects} label="Selected projects" />
          </div>
          <div>
            <SectionLabel>Domain Hints</SectionLabel>
            <TagList tags={domains} label="Selected domains" />
          </div>
        </div>

        {/* Configuration details */}
        <div className="px-5 py-4">
          <SectionLabel>Configuration</SectionLabel>
          <div>
            <DetailRow label="Route Preference" value={routePreference} mono />
            <DetailRow label="Desired Output" value={desiredOutput} mono />
            <DetailRow label="Freshness Window" value={freshnessWindow} />
            <DetailRow
              label="Citation Strictness"
              value={citationStrictness}
              mono
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Secondary actions — Copy + Download                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopy()}
          aria-label={copied ? "Copied to clipboard" : "Copy summary to clipboard"}
          className="gap-2"
        >
          {copied ? (
            <>
              <ClipboardCheck aria-hidden className="size-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                Copied
              </span>
            </>
          ) : (
            <>
              <Clipboard aria-hidden className="size-4" />
              Copy to Clipboard
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          aria-label="Download package as JSON"
          className="gap-2"
        >
          <Download aria-hidden className="size-4" />
          Download JSON
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit error                                                         */}
      {/* ------------------------------------------------------------------ */}
      {showSubmitError && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3",
            "text-sm text-destructive",
          )}
        >
          <span className="font-semibold">Handoff failed: </span>
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation footer                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleGoBack}
          disabled={is_submitting}
          aria-label="Back to venue selection"
          className="gap-1.5"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        <Button
          type="button"
          onClick={handleHandoff}
          disabled={is_submitting || selected_venue === null}
          aria-busy={is_submitting}
          aria-label={
            is_submitting ? "Creating research run…" : "Handoff to venue"
          }
          className="min-w-[160px] gap-2"
        >
          {is_submitting ? (
            <>
              <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
              Creating run…
            </>
          ) : (
            <>
              <Rocket aria-hidden className="size-4" />
              Handoff to Venue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
