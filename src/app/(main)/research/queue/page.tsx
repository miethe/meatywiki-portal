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

export default function QueuePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Artifacts surfaced for review based on staleness and lens scoring
        </p>
      </div>

      <ReviewQueue />
    </div>
  );
}
