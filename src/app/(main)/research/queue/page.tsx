/**
 * Review Queue — placeholder screen.
 *
 * P4-05 ships the real implementation: artifacts surfaced for review based on
 * staleness, lens freshness scoring, and workflow OS recommendations.
 *
 * P4-01: placeholder. P4-05: real implementation.
 *
 * Stitch reference: "Review Queue" (P4-05 scope)
 */

// ReviewQueue component will be imported here in P4-05:
// import { ReviewQueue } from "@/components/research/review-queue";

export default function QueuePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Artifacts surfaced for review based on staleness and lens scoring
        </p>
      </div>

      {/* ReviewQueue slot — replaced in P4-05 */}
      <div
        role="status"
        aria-label="Review Queue coming soon"
        className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <svg
            aria-hidden="true"
            className="size-7 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
            />
          </svg>
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-medium text-foreground">Coming in P4-05</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            The Review Queue will surface stale and low-freshness artifacts
            ordered by lens scoring so you can prioritise what needs attention.
          </p>
        </div>
      </div>
    </div>
  );
}
