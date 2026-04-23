"use client";

/**
 * ArtifactTitleBlock — P4-01 upgraded title section for Artifact Detail.
 *
 * Layout (top to bottom):
 *   1. <Breadcrumbs> — Archive > <workspace> > <title>
 *   2. Eyebrow tag list — uppercase bullet-separated tags/categories
 *      (e.g. "PHILOSOPHY • MATHEMATICS")
 *   3. <h1> as .text-display-lg (36/44, 500, display serif)
 *   4. Metadata strip — created date + updated date + status badge
 *
 * Props:
 *   artifact  — ArtifactDetail (workspace, type, title, status, created,
 *               updated, frontmatter_jsonb)
 *
 * Design spec §6.3 (typography utilities: .text-display-lg, .text-eyebrow).
 * Reuses: Breadcrumbs (ui/breadcrumbs), existing design tokens.
 * Does NOT touch: markdown body, right panel, Handoff Chain, timeline.
 *
 * Dark mode: all tokens are CSS-variable-based; no hardcoded light colors.
 * WCAG AA: h1 has no aria-label override (page heading); status badge uses
 * text+color; eyebrow is presentational (aria-hidden).
 */

import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import type { ArtifactDetail } from "@/types/artifact";
import type { ArtifactStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map workspace slug → human label for breadcrumbs */
const WORKSPACE_LABELS: Record<string, string> = {
  library: "Library",
  research: "Research",
  blog: "Blog",
  projects: "Projects",
  archive: "Archive",
};

function workspaceLabel(workspace: string | null | undefined): string {
  if (!workspace) return "Archive";
  return WORKSPACE_LABELS[workspace] ?? capitalize(workspace);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build breadcrumb items from artifact fields */
function buildBreadcrumbs(artifact: ArtifactDetail): BreadcrumbItem[] {
  const wsLabel = workspaceLabel(artifact.workspace);
  const wsHref = artifact.workspace ? `/${artifact.workspace}` : "/library";

  // Try to extract a category/topic segment from frontmatter for richer crumbs
  const category =
    (artifact.frontmatter_jsonb?.["category"] as string | null) ??
    (artifact.frontmatter_jsonb?.["topic"] as string | null) ??
    null;

  const items: BreadcrumbItem[] = [
    { label: wsLabel, href: wsHref },
  ];

  if (category) {
    items.push({ label: capitalize(category) });
  }

  items.push({ label: artifact.title });

  return items;
}

/**
 * Extract eyebrow tags from artifact.
 * Sources (in priority order):
 *   1. frontmatter_jsonb.tags (array of strings)
 *   2. frontmatter_jsonb.categories (array or string)
 *   3. frontmatter_jsonb.topics (array or string)
 * Falls back to empty array — eyebrow row hidden when no tags.
 */
function extractEyebrowTags(artifact: ArtifactDetail): string[] {
  const fm = artifact.frontmatter_jsonb ?? {};

  const raw =
    fm["tags"] ??
    fm["categories"] ??
    fm["topics"] ??
    null;

  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 6); // cap at 6 to avoid overflow
  }

  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ArtifactStatus, string> = {
  draft:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  archived:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  stale:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

const STATUS_LABELS: Record<ArtifactStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
  stale: "Stale",
};

interface StatusBadgeProps {
  status: ArtifactStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  const label = STATUS_LABELS[status] ?? capitalize(status);

  return (
    <span
      aria-label={`Status: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        style,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ArtifactTitleBlock
// ---------------------------------------------------------------------------

interface ArtifactTitleBlockProps {
  artifact: ArtifactDetail;
  className?: string;
}

export function ArtifactTitleBlock({
  artifact,
  className,
}: ArtifactTitleBlockProps) {
  const breadcrumbs = buildBreadcrumbs(artifact);
  const eyebrowTags = extractEyebrowTags(artifact);
  const createdLabel = formatDate(artifact.created);
  const updatedLabel = formatDate(artifact.updated);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* 1 — Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* 2 — Eyebrow tag list (hidden when no tags) */}
      {eyebrowTags.length > 0 && (
        <p
          aria-hidden="true"
          className="text-eyebrow text-muted-foreground tracking-widest"
        >
          {eyebrowTags.map((tag, i) => (
            <span key={tag}>
              {i > 0 && (
                <span className="mx-1.5 text-muted-foreground/50">•</span>
              )}
              {tag.toUpperCase()}
            </span>
          ))}
        </p>
      )}

      {/* 3 — Display title */}
      <h1 className="text-display-lg text-foreground">
        {artifact.title}
      </h1>

      {/* 4 — Metadata strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta">
        <StatusBadge status={artifact.status} />

        {createdLabel && (
          <span>
            <span className="text-muted-foreground/60">Created</span>{" "}
            <time
              dateTime={artifact.created ?? undefined}
              className="text-muted-foreground"
            >
              {createdLabel}
            </time>
          </span>
        )}

        {updatedLabel && updatedLabel !== createdLabel && (
          <span>
            <span className="text-muted-foreground/60">Updated</span>{" "}
            <time
              dateTime={artifact.updated ?? undefined}
              className="text-muted-foreground"
            >
              {updatedLabel}
            </time>
          </span>
        )}
      </div>
    </div>
  );
}
