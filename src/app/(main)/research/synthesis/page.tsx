/**
 * Synthesis Builder screen — research_synthesis_v1 wired.
 *
 * P4-02: Real implementation. Replaces the P4-01 placeholder stub.
 *
 * Route: /research/synthesis
 * Parent layout: (main)/research/layout.tsx (research workspace shell)
 *
 * Renders the SynthesisBuilder component which handles:
 *   - Source artifact selection (multi-line ULID picker)
 *   - Optional scope + focus parameter inputs
 *   - POST /api/workflows/synthesize on submit
 *   - SSE progress tracking via useSSE (stages: gathering → synthesizing → complete)
 *   - Link to new synthesis artifact on completion
 *   - Error state with inline retry
 *
 * DP3-01 (design-pass Phase 3) — cosmetic + contract integration:
 *   - Stage Tracker: already integrated in SynthesisBuilder running phase; researchOrigin=true
 *     added (DP3-01) so the run progress strip shows amber research accent.
 *   - Lens Badge on backlinked artifact rows: deferred — no backlinked-artifact panel exists
 *     (structural gap, all §2.7 deltas are adr-proposal → Phase 4).
 *   - Handoff Chain on produced-synthesis preview: deferred to DP4-HC-02 (Phase 4 structural).
 *   - All §2.7 deltas are adr-proposal (structural) — deferred to Phase 4.
 *
 * Stitch reference: "Synthesis Builder" (P4-02 scope)
 */

import { SynthesisBuilder } from "@/components/research/synthesis-builder";

export default function SynthesisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Synthesis Builder
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Synthesize multiple research sources into a compiled artifact using the{" "}
          <code className="font-mono text-xs">research_synthesis_v1</code>{" "}
          workflow.
        </p>
      </div>

      <SynthesisBuilder />
    </div>
  );
}
