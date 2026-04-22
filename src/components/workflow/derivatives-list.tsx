"use client";

/**
 * DerivativesList — renders a list of derivative artifacts compiled from a
 * source artifact.
 *
 * Each row shows:
 *   - artifact-type chip (TypeBadge, reusing existing type colour mapping)
 *   - title as a Next.js <Link> to /artifact/{id}
 *   - compact Lens badges (fidelity, freshness, verification_state) rendered
 *     directly via the child primitives from lens-badge.tsx
 *
 * Renders all items returned by the hook (up to the limit=50 default). Shows
 * a "{N} total" count header when totalCount > 5.
 *
 * Empty state: "No derivatives yet." when derivatives array is empty.
 *
 * WCAG 2.1 AA: semantic <ul>/<li> list; keyboard-navigable links.
 *
 * library-source-rollup-v1 Phase 3 DETAIL-02 + DETAIL-05.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import {
  FidelityBadge,
  FreshnessBadge,
  VerificationBadge,
} from "@/components/ui/lens-badge";
import type { DerivativeItem } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DerivativesListProps {
  derivatives: DerivativeItem[];
  /** Total count from the envelope — shown in header when > 5 */
  totalCount?: number;
  /** Whether to render a "View all N" link — unused in current implementation
   *  (all hook results are shown inline). Kept for future pagination wiring. */
  showViewAllLink?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <p
      role="status"
      className="py-6 text-center text-sm text-muted-foreground"
    >
      No derivatives yet.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DerivativesList({
  derivatives,
  totalCount,
  className,
}: DerivativesListProps) {
  if (derivatives.length === 0) {
    return <EmptyState />;
  }

  const showCountHeader =
    typeof totalCount === "number" ? totalCount > 5 : derivatives.length > 5;
  const displayCount =
    typeof totalCount === "number" ? totalCount : derivatives.length;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Count header — shown when there are more than 5 derivatives */}
      {showCountHeader && (
        <p className="text-xs text-muted-foreground">
          {displayCount} derivatives total
        </p>
      )}

      {/* Derivative list */}
      <ul
        aria-label="Derivative artifacts"
        className="flex flex-col divide-y divide-border rounded-md border"
      >
        {derivatives.map((d) => (
          <li key={d.id} className="flex items-center gap-2 px-3 py-2">
            {/* Type chip */}
            <TypeBadge type={d.artifact_type} className="shrink-0" />

            {/* Title link — flex-1 so it takes remaining space */}
            <Link
              href={`/artifact/${d.id}`}
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium text-foreground",
                "transition-colors hover:text-primary",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
              )}
            >
              {d.title ?? "(untitled)"}
            </Link>

            {/*
             * Compact Lens badges (DETAIL-05): use child primitives directly
             * for a tight single-row layout in the list context.
             * Each badge renders null when its value is absent — no empty
             * container shown (design spec §3.3 layout-stable invariant).
             */}
            <div
              aria-label="Lens badges"
              className="flex shrink-0 items-center gap-1"
            >
              <FidelityBadge value={d.fidelity} />
              <FreshnessBadge value={d.freshness} />
              <VerificationBadge value={d.verification_state} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
