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
 * Stitch Reskin P2-02 additions (portal-v1.5-stitch-reskin design spec §3):
 *   - `displayVariant` prop: 'standard' | 'featured' | 'compact' | 'hero'
 *     (default 'standard' — existing callsites rendering 'list'/'grid' are
 *     unchanged; the old `variant` prop continues to control layout direction)
 *   - `excerpt` prop: shown on featured (2-line clamp) and hero (3-line clamp)
 *   - `thumbnail` prop: shown on featured/hero as 16:9 aspect-ratio image
 *   - `typeAccent` prop: when true (default), renders a left-edge stripe
 *     colored per artifact type (3px standard/featured, 2px compact, 4px hero)
 *
 * Stitch reference: §3.1 artifact card hierarchy.
 * WCAG 2.1 AA: interactive card has role="article" + focusable inner link.
 *
 * Shared export: also re-exported from src/components/library/artifact-card.tsx
 * for P5-03/P5-04/P5-05 filtered-view screens.
 */

import type React from "react";
import Link from "next/link";
import { MoreVertical, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactCard as ArtifactCardType, WorkflowRunStatus } from "@/types/artifact";
import { TypeBadge } from "./type-badge";
import { FacetBadge } from "./facet-badge";
import { WorkflowStatusBadge } from "./workflow-status-badge";
import { DerivativeCountBadge } from "./derivative-count-badge";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { ArtifactFreshnessBadge } from "@/components/artifact/freshness-badge";
import { UrgencyBadge } from "./urgency-badge";
import type { UrgencyLevel } from "./urgency-badge";
import type { ArtifactFacet } from "@/types/artifact";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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
 * Display variants for ArtifactCard (Stitch Reskin P2-02, design spec §3).
 * Orthogonal to the existing layout `variant` ('list'|'grid').
 */
export type ArtifactCardDisplayVariant = "standard" | "featured" | "compact" | "hero";

/**
 * Left-edge type-accent stripe colors, derived from the same type→color
 * palette used by TypeBadge (design spec §3.1, §3 Stitch Reskin).
 * Values use CSS custom properties where possible for dark-mode parity.
 */
const TYPE_ACCENT_COLORS: Record<string, string> = {
  raw_note: "hsl(var(--muted-foreground))",
  concept: "#3b82f6",   // blue-500
  entity: "#8b5cf6",    // violet-500
  topic: "#f59e0b",     // amber-500
  synthesis: "#10b981", // emerald-500
  evidence: "#f43f5e",  // rose-500
  glossary: "#64748b",  // slate-500
};

function typeAccentColor(type: string): string {
  return TYPE_ACCENT_COLORS[type] ?? "hsl(var(--border))";
}

/**
 * Map workspace to ArtifactFacet for badge rendering.
 * Workspaces that don't need a badge return null.
 */
function workspaceToFacet(workspace: string): ArtifactFacet | null {
  if (workspace === "blog") return "blog";
  if (workspace === "projects") return "projects";
  return null;
}

/**
 * Inbox group keys that map to contextual CTA labels (P5-02).
 * Matches InboxGroup type in InboxClient.tsx.
 */
export type InboxGroup = "new" | "needs_compile" | "needs_destination";

/** CTA labels per inbox group (P5-02, phase-5-inbox-reskin.md §Task P5-02) */
const INBOX_CTA_LABELS: Record<InboxGroup, string> = {
  new: "Draft",
  needs_compile: "Start Compilation",
  needs_destination: "Review Needed",
};

interface ArtifactCardProps {
  artifact: ArtifactCardType;
  /** Layout direction: "list" for Inbox (full-width row), "grid" for Library grid */
  variant?: "list" | "grid";
  /**
   * Display variant (Stitch Reskin P2-02, design spec §3).
   * Defaults to 'standard' — existing callsites are unaffected.
   *
   * - standard: current behavior + 3px type-accent left stripe
   * - featured: standard + optional 16:9 thumbnail (top) + 2-line excerpt
   * - compact: dense, tighter padding/typography, 2px stripe, no excerpt/thumbnail
   * - hero: large padded, display-font title, 3-line excerpt, shadow-hero, 4px stripe
   */
  displayVariant?: ArtifactCardDisplayVariant;
  /**
   * Excerpt text shown on featured (line-clamp-2) and hero (line-clamp-3) variants.
   * Ignored on standard and compact.
   */
  excerpt?: string;
  /**
   * Thumbnail image URL (16:9, object-cover). Shown on featured and hero variants.
   * Falls back to a neutral placeholder when undefined.
   */
  thumbnail?: string;
  /**
   * When true (default), renders a left-edge stripe colored per artifact type.
   * Width: 2px compact | 3px standard/featured | 4px hero.
   */
  typeAccent?: boolean;
  /**
   * Active workflow run for this artifact, if any.
   * When present and status is pending|running, renders StageTrackerCompact
   * below the title row (DP3-03, Stage Tracker manifest §2.1–2.2).
   * Null/undefined → component not rendered; no placeholder, no layout break.
   */
  activeRun?: ActiveRunShape | null;
  /**
   * Inbox mode (P5-02): when set, overrides card layout to the triage row
   * design — type chip + title (bold) + 1-line preview (truncated) +
   * UrgencyBadge (right-aligned) + contextual CTA button.
   *
   * `inboxGroup` drives the CTA label ("Draft" | "Start Compilation" |
   * "Review Needed") and must match the StatusGroupSection the card lives in.
   * `urgencyLevel` and `urgencyMinutesAgo` are passed through to UrgencyBadge
   * and are computed by InboxClient from artifact.updated / artifact.created.
   */
  inboxGroup?: InboxGroup;
  urgencyLevel?: UrgencyLevel;
  urgencyMinutesAgo?: number;
  /** When provided, replaces the default stub CTA button in the inbox right cluster. */
  ctaSlot?: React.ReactNode;
  /** Called with the artifact ID when the user selects "Archive" from the meatballs menu */
  onArchive?: (id: string) => void;
  /** Called with the artifact ID when the user selects "Delete" from the meatballs menu */
  onDelete?: (id: string) => void;
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
  displayVariant = "standard",
  excerpt,
  thumbnail,
  typeAccent = true,
  activeRun,
  inboxGroup,
  urgencyLevel,
  urgencyMinutesAgo,
  ctaSlot,
  onArchive,
  onDelete,
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
    derivative_count,
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

  // Display variant helpers (P2-02, design spec §3)
  const isHero = displayVariant === "hero";
  const isFeatured = displayVariant === "featured";
  const isCompact = displayVariant === "compact";

  // ---------------------------------------------------------------------------
  // Inbox mode render path (P5-02)
  // ---------------------------------------------------------------------------
  // When `inboxGroup` is provided, we bypass the standard card layout and
  // render the triage row: type chip + title + 1-line preview + urgency badge
  // (right) + contextual CTA button. Existing callsites without `inboxGroup`
  // are completely unaffected.

  if (inboxGroup !== undefined) {
    const ctaLabel = INBOX_CTA_LABELS[inboxGroup];
    const accentColorInbox = typeAccentColor(type);

    return (
      <article
        className={cn(
          "group relative flex items-center gap-3 rounded-md border bg-card p-3",
          "transition-shadow hover:shadow-sm",
          isResearchOrigin && "ring-1 ring-teal-400/50",
          className,
        )}
        style={{
          borderLeftWidth: "3px",
          borderLeftStyle: "solid",
          borderLeftColor: accentColorInbox,
        }}
        aria-label={isResearchOrigin ? `${title} (research origin)` : title}
        data-research-origin={isResearchOrigin ? "true" : undefined}
        data-inbox-group={inboxGroup}
      >
        {/* Stretch link covers the card for navigation */}
        <Link
          href={`/artifact/${id}`}
          aria-label={`View ${title}`}
          className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          tabIndex={0}
        />

        {/* Type chip — left anchor */}
        <div className="pointer-events-none shrink-0">
          <TypeBadge type={type} />
        </div>

        {/* Main content: title + 1-line preview */}
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug text-foreground">
            {title}
          </p>
          {preview && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {preview}
            </p>
          )}
        </div>

        {/* Right cluster: urgency badge + CTA */}
        <div className="pointer-events-none flex shrink-0 items-center gap-2">
          {urgencyLevel && (
            <UrgencyBadge
              level={urgencyLevel}
              minutesAgo={urgencyMinutesAgo}
              className="hidden sm:inline-flex"
            />
          )}
          {ctaSlot ?? (
            <button
              type="button"
              aria-label={`${ctaLabel} — ${title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                "pointer-events-auto inline-flex h-7 items-center rounded-md border px-2.5",
                "text-xs font-medium text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </article>
    );
  }

  // ---------------------------------------------------------------------------
  // Standard / featured / compact / hero render paths (unchanged below)
  // ---------------------------------------------------------------------------

  // Left-edge type-accent stripe: width varies by display variant
  const stripeWidthPx = isHero ? 4 : isCompact ? 2 : 3;
  const accentStyle: React.CSSProperties = typeAccent
    ? {
        borderLeftWidth: `${stripeWidthPx}px`,
        borderLeftStyle: "solid",
        borderLeftColor: typeAccentColor(type),
      }
    : {};

  // Thumbnail: shown on featured + hero when URL provided (or no-op)
  const showThumbnail = (isFeatured || isHero) && !!thumbnail;

  // Excerpt: featured = 2-line clamp, hero = 3-line clamp; ignore on standard/compact
  const excerptText = (isFeatured || isHero) ? (excerpt ?? null) : null;
  const excerptClamp = isHero ? "line-clamp-3" : "line-clamp-2";

  // Show the meatballs menu only when at least one callback is provided
  const hasMeatballsMenu = !!(onArchive || onDelete);

  return (
    <article
      className={cn(
        "group relative border bg-card transition-shadow",
        // Base radius per display variant
        isHero ? "rounded-[var(--radius-editorial,0.75rem)] shadow-[var(--portal-shadow-hero)]" : "rounded-md hover:shadow-sm",
        // Layout direction (existing behavior preserved)
        variant === "list" && !isCompact && "flex items-start gap-3 p-3",
        variant === "grid" && !isHero && !isCompact && "flex flex-col gap-2 p-4",
        // Display variant overrides
        isHero && "flex flex-col gap-3 p-6",
        isCompact && "flex items-center gap-2 p-2",
        // P5-06 research_origin styling hook
        isResearchOrigin && "ring-1 ring-teal-400/50",
        // Accent stripe is applied via inline style (see accentStyle); no extra class needed
        className,
      )}
      style={accentStyle}
      aria-label={isResearchOrigin ? `${title} (research origin)` : title}
      // P5-06 data attribute hook for Lens Badge workspace-aware styling
      data-research-origin={isResearchOrigin ? "true" : undefined}
      data-display-variant={displayVariant}
    >
      {/* Stretch link covers entire card for click; title provides label */}
      <Link
        href={`/artifact/${id}`}
        aria-label={`View ${title}`}
        className={cn(
          "absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isHero ? "rounded-[var(--radius-editorial,0.75rem)]" : "rounded-md",
        )}
        tabIndex={0}
      />

      {/* Thumbnail slot (featured / hero): 16:9 aspect ratio, object-cover */}
      {showThumbnail && (
        <div className="pointer-events-none relative -mx-6 -mt-6 mb-1 aspect-video w-[calc(100%+3rem)] overflow-hidden rounded-t-[var(--radius-editorial,0.75rem)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Content — visually above the stretch link, but pointer-events pass through
          so clicks land on the underlying <Link>.  Interactive children re-enable
          their own pointer events via `pointer-events-auto`. */}
      <div
        className={cn(
          "pointer-events-none relative flex min-w-0 flex-col",
          variant === "list" && !isCompact && "flex-1",
          isCompact ? "gap-0.5" : isHero ? "gap-2" : "gap-1.5",
        )}
      >
        {/*
         * Card header row: badges left, Lens Badge top-right (DP3-03 / Lens Badge
         * manifest §2 rows 4 & 6 — "top-right of card header, right of title").
         * LensBadgeSet renders null when all lens fields absent (layout-stable).
         * Compact variant: omits LensBadgeSet to save space.
         */}
        {!isCompact && (
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
        )}

        {/* Compact: inline single-row badges + title */}
        {isCompact && (
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeBadge type={type} className="shrink-0" />
            {workflow_status && <WorkflowStatusBadge status={workflow_status} className="shrink-0" />}
          </div>
        )}

        {/* Title: hero uses display font + larger size */}
        <h3
          className={cn(
            "leading-snug text-foreground",
            isHero
              ? "font-display text-xl font-semibold tracking-tight"
              : isCompact
              ? "truncate text-xs font-medium"
              : "text-sm font-medium",
          )}
        >
          {title}
        </h3>

        {/*
         * Stage Tracker compact (DP3-03): rendered below title row only when
         * artifact has an active (pending|running) workflow run.
         * density="card" per Stage Tracker manifest §2.1–2.2.
         * Returns null and occupies no space when showStageTracker=false.
         * Not shown in compact variant.
         */}
        {showStageTracker && activeRun && !isCompact && (
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

        {/* Excerpt (featured: 2-line, hero: 3-line). Falls back to preview when no excerpt. */}
        {excerptText && (
          <p className={cn("text-xs text-muted-foreground", excerptClamp)}>
            {excerptText}
          </p>
        )}

        {/* Preview text (standard/grid only — same as existing behavior) */}
        {!excerptText && !isCompact && preview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
        )}

        {/* Footer row: freshness badge + derivative count + timestamps
            Compact shows only updated timestamp inline */}
        {isCompact ? (
          <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            {updated && updatedTime && (
              <time dateTime={updated} title={`Updated: ${new Date(updated).toLocaleDateString()}`}>
                {updatedTime}
              </time>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1">
              {/* Freshness indicator from metadata (P4-04): compact, cards-only */}
              <ArtifactFreshnessBadge freshness={artifact.metadata?.freshness} />
              {/*
               * Derivative count badge (library-source-rollup-v1 FE-03):
               * rendered when artifact has derivatives (rollup view only).
               */}
              {typeof derivative_count === "number" && derivative_count > 0 && (
                <DerivativeCountBadge
                  count={derivative_count}
                  href={`/artifact/${id}?tab=derivatives`}
                />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              {/* Show created date in grid/hero variants (more space); updated in both */}
              {(variant === "grid" || isHero) && created && createdTime && (
                <time dateTime={created} title={`Created: ${new Date(created).toLocaleDateString()}`}>
                  {createdTime}
                </time>
              )}
              {updated && updatedTime && (
                <>
                  {(variant === "grid" || isHero) && created && createdTime && (
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
        )}
      </div>

      {/* Meatballs menu — absolute top-right, visible on group hover only.
          pointer-events-auto re-enables clicks since the parent content div
          uses pointer-events-none. stopPropagation prevents card selection
          click from firing when the menu button or items are clicked. */}
      {hasMeatballsMenu && (
        <div
          className={cn(
            "pointer-events-auto absolute right-2 top-2",
            "opacity-0 group-hover:opacity-100 transition-opacity",
          )}
          // Prevent the card's <li onClick> selection handler from triggering
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Artifact actions"
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md",
                  "bg-card/80 backdrop-blur-sm border text-muted-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                <MoreVertical aria-hidden="true" className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {onArchive && (
                <DropdownMenuItem
                  onClick={() => onArchive(id)}
                  className="gap-2 cursor-pointer"
                >
                  <Archive aria-hidden="true" className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(id)}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}
