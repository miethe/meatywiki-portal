/**
 * NewEvidenceColumn — skeleton list of recent evidence items.
 *
 * Renders 3–5 skeleton rows with fake timestamp shimmers.
 * Right-inner column on the Research Home editorial layout.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred per OQ-2).
 *
 * TODO: wire GET /api/research/evidence-pulse/new to populate real rows.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shimmer primitive
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton evidence row
// ---------------------------------------------------------------------------

function SkeletonEvidenceRow() {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-1.5 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
    >
      <div className="flex items-center gap-2">
        <Shimmer className="h-3.5 w-10 rounded-full" />
        <Shimmer className="h-3.5 flex-1" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Shimmer className="h-3 w-2/3" />
        {/* timestamp */}
        <Shimmer className="h-3 w-12 shrink-0" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// NewEvidenceColumn
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 4;

export interface NewEvidenceColumnProps {
  className?: string;
}

/**
 * Skeleton list of recent evidence items.
 * Replace skeleton rows with real evidence rows when API ships.
 */
export function NewEvidenceColumn({ className }: NewEvidenceColumnProps) {
  return (
    <section aria-labelledby="new-evidence-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="new-evidence-heading"
          className="text-sm font-semibold text-foreground"
        >
          New Evidence
        </h2>
        <span
          className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          role="note"
          aria-label="Planned feature"
        >
          Planned
        </span>
      </div>

      {/*
       * TODO: Replace skeleton rows with real evidence items from
       * GET /api/research/evidence-pulse/new.
       */}
      <ul
        role="list"
        aria-busy="true"
        aria-label="New evidence items loading"
        className="flex flex-col gap-3"
      >
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonEvidenceRow key={i} />
        ))}
      </ul>
    </section>
  );
}
