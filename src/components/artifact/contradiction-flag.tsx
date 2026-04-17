"use client";

/**
 * ContradictionFlag — compact chip shown when an artifact has ≥1 contradiction edge.
 *
 * Sources data from GET /api/artifacts/:id/edges via useContradictionCount,
 * which composes the useArtifactEdges hook (P4-03).
 *
 * Behaviour:
 *   - count > 0 → renders a red warning chip with tooltip text.
 *   - count === 0 → renders nothing (no DOM node).
 *   - Loading / error → renders nothing (SC-P4-5 graceful degradation).
 *
 * The chip carries an accessible tooltip via the `title` attribute (widely
 * supported) and an aria-label that includes the count for screen readers.
 * In v1 the chip is non-interactive (display-only); click-to-navigate is
 * deferred to v1.5.
 *
 * Visual language: matches the compact pill style of LensBadgeSet / FreshnessBadge
 * so all indicators in the badge row feel visually cohesive.
 *
 * WCAG 2.1 AA: aria-label carries semantic meaning (not colour-only).
 *
 * Phase: P4-04.
 */

import { cn } from "@/lib/utils";
import { useContradictionCount } from "@/hooks/useContradictionCount";

// ---------------------------------------------------------------------------
// Warning icon (inline SVG — no external dep)
// ---------------------------------------------------------------------------

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3 shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM8 5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 5zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContradictionFlagProps {
  /** The artifact ID to check for contradiction edges. */
  artifactId: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a contradiction warning chip when the artifact has ≥1 contradicts edge.
 * Renders nothing when count is 0 or the data is unavailable.
 */
export function ContradictionFlag({
  artifactId,
  className,
}: ContradictionFlagProps) {
  const { count, isLoading } = useContradictionCount(artifactId);

  // Render nothing while loading, on error, or when no contradictions.
  // SC-P4-5: never throw or crash — return null silently.
  if (isLoading || count === 0) return null;

  const label =
    count === 1
      ? "Contradicted by 1 linked artifact"
      : `Contradicted by ${count} linked artifacts`;

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        className,
      )}
    >
      <WarningIcon />
      <span>{count} conflict{count !== 1 ? "s" : ""}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pure display variant (accepts pre-computed count; no data fetching)
// ---------------------------------------------------------------------------

export interface ContradictionFlagPureProps {
  /** Pre-computed count of contradiction edges. */
  contradictionCount: number;
  className?: string;
}

/**
 * Pure presentation variant — accepts a pre-computed contradiction count.
 *
 * Useful when the parent already has edge data and wants to avoid a redundant
 * network request. Renders nothing when count === 0.
 */
export function ContradictionFlagPure({
  contradictionCount,
  className,
}: ContradictionFlagPureProps) {
  if (contradictionCount === 0) return null;

  const label =
    contradictionCount === 1
      ? "Contradicted by 1 linked artifact"
      : `Contradicted by ${contradictionCount} linked artifacts`;

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        className,
      )}
    >
      <WarningIcon />
      <span>{contradictionCount} conflict{contradictionCount !== 1 ? "s" : ""}</span>
    </span>
  );
}
