/**
 * Synthesis Builder — placeholder screen.
 *
 * P4-02 ships the real implementation: source selection, parameter form,
 * POST /api/workflows/synthesize, SSE progress tracking.
 *
 * This stub renders a clearly-labeled placeholder with the SynthesisBuilder
 * component slot so P4-02 can drop in the real component without touching the
 * route file.
 *
 * P4-01: placeholder. P4-02: real implementation.
 *
 * Stitch reference: "Synthesis Builder" (P4-02 scope)
 */

// SynthesisBuilder will be imported here in P4-02:
// import { SynthesisBuilder } from "@/components/research/synthesis-builder";

export default function SynthesisPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Synthesis Builder
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Synthesize multiple research sources into a compiled artifact
        </p>
      </div>

      {/* SynthesisBuilder slot — replaced in P4-02 */}
      <div
        role="status"
        aria-label="Synthesis Builder coming soon"
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
              d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
        </div>
        <div className="max-w-xs">
          <p className="text-sm font-medium text-foreground">
            Coming in P4-02
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            The Synthesis Builder will let you select source artifacts and
            launch a <code className="font-mono">research_synthesis_v1</code>{" "}
            workflow to compile them into a synthesis artifact.
          </p>
        </div>
      </div>
    </div>
  );
}
