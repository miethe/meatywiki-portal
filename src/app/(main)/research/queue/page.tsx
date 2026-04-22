/**
 * Review Queue screen — P4-05 implementation.
 *
 * Displays artifacts flagged for review based on staleness and lens freshness
 * scoring. V1 ships a read-only list; action buttons (Promote / Archive / Link)
 * are disabled stubs targeting Portal v1.5.
 *
 * Route: /research/queue
 * Parent layout: (main)/research/layout.tsx (research workspace shell)
 *
 * DP4-02b — context rail (ADR-DPI-002 Option A.1):
 *   Mounts ContextRail in research variant at the page level (right column, lg+).
 *   In v1 no artifact is pre-selected; the rail shows empty/deferred states.
 *   Item-level rail wiring (selecting an item populates the rail) is a v1.6 follow-up
 *   once the row-selection interaction pattern is designed.
 *
 * Gate types emitted in V1:
 *   - freshness  — stale or outdated lens_freshness score
 *   - contradiction — disputed verification_state
 *
 * Other gate types (coverage, completeness, relevance) are schema-present but
 * not yet emitted by the backend — rendered gracefully if they appear.
 *
 * Stitch reference: "Review Queue" (P4-05 scope)
 */

import { ReviewQueue } from "@/components/research/review-queue";
import { ContextRail } from "@/components/layout/ContextRail";

export default function QueuePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Artifacts surfaced for review based on staleness and lens scoring
        </p>
      </div>

      {/* Two-column layout: queue list + context rail (lg+) */}
      <div className="flex gap-6">
        {/* Queue list — flex-1 so it fills remaining space */}
        <div className="min-w-0 flex-1">
          <ReviewQueue />
        </div>

        {/* ContextRail — research variant, no artifact selected in v1.          */}
        {/* Structural slot per ADR-DPI-002 §1. Item-level wiring is v1.6.       */}
        {/* — DP1-04 #2 (Review Queue metadata strip) is owned by DP4-02e, not  */}
        {/*   this file. Touch only the rail slot here to avoid merge conflicts. */}
        <aside
          aria-label="Context rail"
          className="hidden w-72 shrink-0 lg:block"
        >
          <ContextRail
            variant="research"
            ariaLabel="Queue context"
          />
        </aside>
      </div>
    </div>
  );
}
