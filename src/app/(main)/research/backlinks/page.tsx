/**
 * Backlinks Explorer — placeholder screen.
 *
 * P4-03 ships the real implementation: GET /api/artifacts/:id/edges endpoint
 * + a graph-style or list backlinks panel wired to a selected artifact.
 *
 * P4-01: placeholder. P4-03: real implementation.
 *
 * Stitch reference: "Backlinks Panel" (P4-03 scope)
 */

// BacklinksPanel will be imported here in P4-03:
// import { BacklinksPanel } from "@/components/research/backlinks-panel";

export default function BacklinksPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backlinks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Explore inbound links and connections between research artifacts
        </p>
      </div>

      {/* BacklinksPanel slot — replaced in P4-03 */}
      <div
        role="status"
        aria-label="Backlinks Explorer coming soon"
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
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-medium text-foreground">Coming in P4-03</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            The Backlinks Explorer will show inbound artifact references using
            the <code className="font-mono">GET /api/artifacts/:id/edges</code>{" "}
            endpoint, visualised as a linkable panel.
          </p>
        </div>
      </div>
    </div>
  );
}
