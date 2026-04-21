"use client";

/**
 * ArtifactCard — unified card component for artifact list views.
 *
 * Used in Inbox (list layout) and Library (grid/list toggle).
 * Accepts all optional fields gracefully — missing lens/workflow data
 * renders with stable neutral fallbacks (design spec §3.3 invariant).
 *
 * Props shape matches ArtifactCard DTO from portal.api.schemas; downstream
 * tasks (P3-03, P3-05) wire real data by passing the API response directly.
 *
 * Taxonomy-redesign P5-02 additions:
 *   - FacetBadge shown when workspace is blog or projects
 *   - research_origin styling hook: data-research-origin="true" attribute +
 *     ring-1 ring-teal-400/50 class when research_origin=true. P5-06 can
 *     extend this by targeting [data-research-origin="true"] in CSS or by
 *     checking artifact.research_origin in LensBadgeSet.
 *   - created date shown in footer alongside updated date
 *
 * Stitch reference: §3.1 artifact card hierarchy.
 * WCAG 2.1 AA: interactive card has role="article" + focusable inner link.
 *
 * Shared export: also re-exported from src/components/library/artifact-card.tsx
 * for P5-03/P5-04/P5-05 filtered-view screens.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ArtifactCard as ArtifactCardType, WorkflowRunStatus } from "@/types/artifact";
import { TypeBadge } from "./type-badge";
import { FacetBadge } from "./facet-badge";
import { WorkflowStatusBadge } from "./workflow-status-badge";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { ArtifactFreshnessBadge } from "@/components/artifact/freshness-badge";
import type { ArtifactFacet } from "@/types/artifact";

/**
 * Minimal active-run shape for Stage Tracker integration (DP3-03).
 * Intentionally narrow — only what the card needs to render StageTrackerCompact.
 * Full WorkflowRun type (from @/types/artifact) is a superset of this.
 */
export interface ActiveRunShape {
  id: string;
  status: WorkflowRunStatus;
  current_stage?: number | null;
  template_id?: string | null;
}

/** Workspaces that get a facet badge in the Library view */
const FACET_BADGE_WORKSPACES = new Set<string>(["blog", "projects"]);

/**
 * Map workspace to ArtifactFacet for badge rendering.
 * Workspaces that don't need a badge return null.
 */
function workspaceToFacet(workspace: string): ArtifactFacet | null {
  if (workspace === "blog") return "blog";
  if (workspace === "projects") return "projects";
  return null;
}

interface ArtifactCardProps {
  artifact: ArtifactCardType;
  /** Variant: "list" for Inbox (full-width row), "grid" for Library grid */
  variant?: "list" | "grid";
  /**
   * Active workflow run for this artifact, if any.
   * When present and status is pending|running, renders StageTrackerCompact
   * below the title row (DP3-03, Stage Tracker manifest §2.1–2.2).
   * Null/undefined → component not rendered; no placeholder, no layout break.
   */
  activeRun?: ActiveRunShape | null;
  className?: string;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export function ArtifactCard({
  artifact,
  variant = "list",
  activeRun,
  className,
}: ArtifactCardProps) {
  const {
    id,
    title,
    type,
    workspace,
    created,
    updated,
    workflow_status,
    preview,
    research_origin,
  } = artifact;

  // Stage Tracker contract (DP3-03): render compact tracker only for active runs.
  // Terminal statuses (complete, failed, abandoned, paused) collapse to null.
  const showStageTracker =
    activeRun != null &&
    (activeRun.status === "pending" || activeRun.status === "running");

  const updatedTime = formatRelativeTime(updated);
  const createdTime = formatRelativeTime(created);
  const facet = workspaceToFacet(workspace);
  const isResearchOrigin = research_origin === true;

  return (
    <article
      className={cn(
        "group relative rounded-md border bg-card transition-shadow hover:shadow-sm",
        variant === "list" && "flex items-start gap-3 p-3",
        variant === "grid" && "flex flex-col gap-2 p-4",
        // P5-06 research_origin styling hook: subtle ring to distinguish
        // research-workflow artifacts. P5-06 can extend by targeting
        // [data-research-origin="true"] in CSS or augmenting LensBadgeSet.
        isResearchOrigin && "ring-1 ring-teal-400/50",
        className,
      )}
      aria-label={
        isResearchOrigin ? `${title} (research origin)` : title
      }
      // P5-06 data attribute hook for Lens Badge workspace-aware styling
      data-research-origin={isResearchOrigin ? "true" : undefined}
    >
      {/* Stretch link covers entire card for click; title provides label */}
      <Link
        href={`/artifact/${id}`}
        aria-label={`View ${title}`}
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        tabIndex={0}
      />

      {/* Content — visually above the stretch link, but pointer-events pass through
          so clicks land on the underlying <Link>.  Interactive children re-enable
          their own pointer events via `pointer-events-auto`. */}
      <div className={cn("pointer-events-none relative flex min-w-0 flex-col gap-1.5", variant === "list" && "flex-1")}>
        {/*
         * Card header row: badges left, Lens Badge top-right (DP3-03 / Lens Badge
         * manifest §2 rows 4 & 6 — "top-right of card header, right of title").
         * LensBadgeSet renders null when all lens fields absent (layout-stable).
         */}
        <div className="flex items-start justify-between gap-2">
          {/* Left cluster: type + facet + workflow status */}
          <div className="flex flex-wrap items-center gap-1">
            <TypeBadge type={type} />
            {FACET_BADGE_WORKSPACES.has(workspace) && facet && (
              <FacetBadge facet={facet} />
            )}
            {workflow_status && <WorkflowStatusBadge status={workflow_status} />}
          </div>
          {/* Right: Lens Badge compact (null-safe — renders nothing when all null) */}
          <LensBadgeSet
            artifact={artifact}
            variant="compact"
            researchOrigin={research_origin}
            className="shrink-0"
          />
        </div>

        {/* Title */}
        <h3
          className={cn(
            "font-medium leading-snug text-foreground",
            variant === "list" ? "text-sm" : "text-sm",
          )}
        >
          {title}
        </h3>

        {/*
         * Stage Tracker compact (DP3-03): rendered below title row only when
         * artifact has an active (pending|running) workflow run.
         * density="card" per Stage Tracker manifest §2.1–2.2.
         * Returns null and occupies no space when showStageTracker=false.
         */}
        {showStageTracker && activeRun && (
          <StageTracker
            runId={activeRun.id}
            templateId={activeRun.template_id}
            status={activeRun.status}
            currentStage={activeRun.current_stage}
            variant="compact"
            mode="sse"
            researchOrigin={research_origin}
            className="mt-0.5"
          />
        )}

        {/* Preview text */}
        {preview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
        )}

        {/* Footer row: freshness badge + timestamps */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            {/* Freshness indicator from metadata (P4-04): compact, cards-only */}
            <ArtifactFreshnessBadge
              freshness={artifact.metadata?.freshness}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {/* Show created date in grid variant (more space); updated in both */}
            {variant === "grid" && created && createdTime && (
              <time dateTime={created} title={`Created: ${new Date(created).toLocaleDateString()}`}>
                {createdTime}
              </time>
            )}
            {updated && updatedTime && (
              <>
                {variant === "grid" && created && createdTime && (
                  <span aria-hidden="true">·</span>
                )}
                <time
                  dateTime={updated}
                  title={`Updated: ${new Date(updated).toLocaleDateString()}`}
                >
                  {updatedTime}
                </time>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
